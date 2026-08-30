// UPS 国际快递适配器
// Rate API: https://www.ups.com/upsdeveloperkit  POST /api/rating/v1/Shop
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

export class UPSAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://onlinetools.ups.com/api').replace(/\/$/, '');
    this.clientId = cfg.clientId || cfg.apiKey || '';
    this.clientSecret = cfg.clientSecret || cfg.apiSecret || '';
    this.accountNumber = cfg.accountNumber || '';
  }

  // 获取 OAuth token（简化：直接用 clientId 作为 Bearer 演示；真实应先换 token）
  async token() {
    if (this.cfg.accessToken) return this.cfg.accessToken;
    if (!this.clientSecret) return this.clientId;
    const form = `grant_type=client_credentials`;
    const data = await httpRequest(`${this.baseUrl}/security/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-merchant-id': this.clientId,
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: form,
      // 允许非 JSON body
    }).catch(() => null);
    return data?.access_token || this.clientId;
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('UPS 未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const token = await this.token();

    const body = {
      ShipmentRequest: {
        Request: { RequestOption: 'Rate' },
        Shipment: {
          Shipper: {
            ShipperNumber: this.accountNumber || this.cfg.originPostal || '',
            Address: { CountryCode: 'CN', PostalCode: this.cfg.originPostal || '518000' },
          },
          ShipTo: {
            Name: 'Receiver',
            Address: { CountryCode: p.country, PostalCode: this.cfg.receiverPostal || '10001' },
          },
          Package: [
            {
              PackageWeight: {
                UnitOfMeasurement: { Code: 'KGS' },
                Weight: String(chargedKg),
              },
            },
          ],
        },
      },
    };

    const data = await httpRequest(`${this.baseUrl}/rating/v1/Shop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        transId: String(Date.now()),
        transactionSrc: 'crossbuy',
      },
      body,
    });

    const wrapper = data?.RateResponse || data?.ShipmentResponse || data;
    const services = wrapper?.RatedShipment || [];
    const svc = services[0];
    if (!svc) throw new CarrierError('UPS 未返回可用报价', 'NO_QUOTE', data);

    const priceUsd = Number(svc.TotalCharges?.MonetaryValue || 0);
    if (!priceUsd) throw new CarrierError('UPS 报价为空', 'NO_QUOTE', data);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: svc.Service?.Name || 'UPS Worldwide',
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin: Number(svc.ScheduledDelivery?.TimeInTransit || 3),
      daysMax: Number(svc.ScheduledDelivery?.TimeInTransit || 6),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: data,
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 clientId / clientSecret', source: 'api' };
    const t0 = Date.now();
    try {
      await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 }, valueUsd: 20 });
      return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
