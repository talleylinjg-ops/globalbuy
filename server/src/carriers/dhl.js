// DHL Express MyDHL API 适配器
// 官方文档：https://developer.dhl.com/api-reference/dhl-express-mydhl-api
// 认证：HTTP Basic（Site ID : Password）；sandbox https://api-mock.dhl.com/mydhlapi，生产 https://express.api.dhl.com/mydhlapi
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

export class DHLAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://express.api.dhl.com/mydhlapi').replace(/\/$/, '');
    this.apiKey = cfg.apiKey || '';
    this.apiSecret = cfg.apiSecret || '';
    this.accountNumber = cfg.accountNumber || cfg.account || '';
    this.originPostal = cfg.originPostal || '518009';
    this.originCity = cfg.originCity || 'Shenzhen';
    this.productCode = cfg.productCode || 'P'; // P=EXPRESS WORLDWIDE (DOC), D=EXPRESS WORLDWIDE (NDO)
  }

  authHeader() {
    return 'Basic ' + Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
  }

  // 统一请求：把 HTTP 错误转成 CarrierError（DHL 错误体为 RFC7807 problem+json：{title, detail, status}）
  async callApi(path, { method = 'GET', params, body } = {}) {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    try {
      return await httpRequest(`${this.baseUrl}${path}${qs}`, {
        method,
        headers: { Authorization: this.authHeader(), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body,
        timeout: 30000,
      });
    } catch (e) {
      const status = e.status || 0;
      if (status === 401 || status === 403) {
        throw new CarrierError(`DHL 认证失败（Site ID/Password 错误或未授权，HTTP ${status}）`, 'AUTH_ERROR', e);
      }
      if (status === 429) {
        throw new CarrierError('DHL 请求频率超限（HTTP 429）', 'API_ERROR', e);
      }
      // httpRequest 的 message 里带响应体前 300 字符（problem+json detail）
      const detail = String(e.message || '').replace(/^HTTP \d+: /, '').slice(0, 200);
      if (status >= 400 && status < 500) {
        throw new CarrierError(`DHL 请求被拒绝（HTTP ${status}）: ${detail}`, 'API_ERROR', e);
      }
      throw new CarrierError(`DHL 服务异常（HTTP ${status || '网络'}）: ${detail}`, 'API_ERROR', e);
    }
  }

  plannedDate(dateOnly = false) {
    const d = new Date(Date.now() + 24 * 3600 * 1000); // 次日揽收
    const iso = d.toISOString();
    if (dateOnly) return iso.slice(0, 10);
    return `${iso.slice(0, 10)}T09:00:00GMT+08:00`;
  }

  // 报价：GET /rates（单件 query 参数版）
  async quote(p) {
    if (!this.configured) throw new CarrierError('DHL 未配置 Site ID/Password', 'NOT_CONFIGURED');
    if (!this.accountNumber) throw new CarrierError('DHL 未配置付款账号 accountNumber', 'NOT_CONFIGURED');
    const { actualKg, volumetricKg, chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const dims = p.dims || {};
    const params = new URLSearchParams({
      accountNumber: String(this.accountNumber),
      originCountryCode: 'CN',
      originPostalCode: this.originPostal,
      originCityName: this.originCity,
      destCountryCode: String(p.country || 'US').toUpperCase(),
      destPostalCode: String(p.postalCode || p.postal || '10001'),
      weight: String(Number(chargedKg.toFixed(3))),
      length: String(dims.lengthCm || 15),
      width: String(dims.widthCm || 10),
      height: String(dims.heightCm || 8),
      plannedShippingDate: this.plannedDate(true),
      unitOfMeasurement: 'metric',
      currencyCode: 'USD',
    });
    const data = await this.callApi('/rates', { method: 'GET', params });
    const products = data?.products || [];
    // 取总价最低的可用产品
    let best = null;
    for (const pr of products) {
      const price = Number(pr?.totalPrice?.[0]?.price || 0);
      if (price <= 0) continue;
      if (!best || price < Number(best?.totalPrice?.[0]?.price || 0)) best = pr;
    }
    if (!best) throw new CarrierError('DHL 未返回可用报价', 'NO_QUOTE', data);

    const priceUsd = Number(best.totalPrice[0].price);
    const deliveryTs = best?.deliveryTime?.timestamp || best?.estimatedDeliveryDate || '';
    let daysMax = this.cfg.daysMax ?? 5;
    if (deliveryTs) {
      const days = Math.ceil((new Date(deliveryTs).getTime() - Date.now()) / 86400000);
      if (Number.isFinite(days) && days > 0 && days < 30) daysMax = days;
    }
    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: best.productCode || 'DHL_EXPRESS_WORLDWIDE',
      productNameEn: best.productName || 'DHL Express Worldwide',
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin: Math.max(2, daysMax - 2),
      daysMax,
      source: 'api',
      available: true,
      chargedKg,
      actualKg,
      volumetricKg,
      raw: data,
    }, {});
  }

  // 创建运单：POST /shipments（参数形状与发货路由对齐）
  async createOrder(p) {
    if (!this.configured) throw new CarrierError('DHL 未配置 Site ID/Password', 'NOT_CONFIGURED');
    if (!this.accountNumber) throw new CarrierError('DHL 未配置付款账号 accountNumber', 'NOT_CONFIGURED');
    const sender = p.sender || {};
    const receiver = p.receiver || {};
    const items = Array.isArray(p.items) && p.items.length ? p.items : [];
    if (!p.orderNo) throw new CarrierError('DHL 下单缺少订单号', 'INVALID_INPUT');
    if (!receiver.country || !receiver.address || !receiver.contact) throw new CarrierError('DHL 下单缺少收件人信息', 'INVALID_INPUT');
    if (!items.length) throw new CarrierError('DHL 下单缺少商品明细', 'INVALID_INPUT');

    const body = {
      plannedShippingDateAndTime: this.plannedDate(),
      productCode: p.productCode || this.productCode,
      accounts: [{ number: String(this.accountNumber), typeCode: 'shipper' }],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: String(sender.postCode || this.originPostal),
            countryCode: String(sender.country || 'CN').toUpperCase(),
            addressLine1: String(sender.address || ''),
            cityName: String(sender.regionSecond || this.originCity),
          },
          contactDetails: {
            personName: String(sender.contact || sender.company || 'CrossBuy'),
            phone: String(sender.telNo || sender.phoneNo || ''),
          },
        },
        receiverDetails: {
          postalAddress: {
            postalCode: String(receiver.postCode || ''),
            countryCode: String(receiver.country || 'US').toUpperCase(),
            addressLine1: String(receiver.address || ''),
            cityName: String(receiver.regionSecond || ''),
            countyCode: String(receiver.regionFirst || '').toUpperCase(),
          },
          contactDetails: {
            personName: String(receiver.contact || ''),
            phone: String(receiver.telNo || receiver.phoneNo || ''),
            email: receiver.email || undefined,
          },
        },
      },
      content: {
        packages: [{
          weight: Number(Number(p.totalWeightKg || 0).toFixed(3)),
          dimensions: p.dims ? {
            length: Number(p.dims.lengthCm || 15),
            width: Number(p.dims.widthCm || 10),
            height: Number(p.dims.heightCm || 8),
          } : undefined,
        }],
        isDutiable: true,
        declaredValue: Number(Number(p.declaredValue || 0).toFixed(2)),
        declaredValueCurrency: p.declaredCurrency || 'USD',
        description: String(items[0]?.name || 'Goods').slice(0, 90),
        unitOfMeasurement: 'metric',
        incoterm: p.incoterm || 'DAP',
      },
      shipmentNotification: [],
      outputImageProperties: { printerDPI: 300, imageFormat: 'PDF' },
    };
    // 明细件数：把 items 摊平为单件（发货路由当前一票一包裹）
    const data = await this.callApi('/shipments', { method: 'POST', body });
    if (!data?.shipmentTrackingNumber) {
      throw new CarrierError('DHL 下单未返回运单号', 'NO_QUOTE', data);
    }
    const doc = (data.documents || []).find((d) => d.imageFormat === 'PDF') || (data.documents || [])[0] || {};
    return {
      customerOrderNo: String(p.orderNo),
      sfWaybillNo: undefined,
      waybillNo: data.shipmentTrackingNumber,
      trackingNo: data.shipmentTrackingNumber,
      trackingUrl: data.trackingUrl || `https://www.dhl.com/track?tracking-id=${data.shipmentTrackingNumber}`,
      agentCode: data.dispatchConfirmationNumber || '',
      agentLabelBase64: doc.content || '',
    };
  }

  // 取消运单
  async cancelOrder({ trackingNo, dispatchConfirmationNumber } = {}) {
    if (!this.configured) throw new CarrierError('DHL 未配置', 'NOT_CONFIGURED');
    if (!trackingNo) throw new CarrierError('DHL 取消缺少运单号', 'INVALID_INPUT');
    const params = new URLSearchParams({ dispatchConfirmationNumber: String(dispatchConfirmationNumber || '') });
    await this.callApi(`/shipments/${encodeURIComponent(trackingNo)}`, { method: 'DELETE', params });
    return { ok: true };
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 Site ID（apiKey）', source: 'api' };
    const t0 = Date.now();
    try {
      await this.quote({ country: 'US', weightKg: 0.5, postalCode: '10001', dims: { lengthCm: 15, widthCm: 10, heightCm: 8 }, valueUsd: 20 });
      return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
