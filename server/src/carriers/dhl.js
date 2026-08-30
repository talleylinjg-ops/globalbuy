// DHL Express 国际快递适配器
// 官方统一费率 API（Unified Rate Tool）：https://api-mock.dhl.com/mydhlapi/
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

export class DHLAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://api-mock.dhl.com/mydhlapi').replace(/\/$/, '');
    this.apiKey = cfg.apiKey || '';
    this.apiSecret = cfg.apiSecret || '';
    this.plannedShippingDate = cfg.plannedShippingDate || (() => new Date().toISOString());
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('DHL 未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);

    const body = {
      plannedShippingDateAndTime: this.plannedShippingDate(),
      productType: this.cfg.productType || 'DHL_EXPRESS_WORLDWIDE',
      accounts: this.cfg.accountNumber ? [{ number: this.cfg.accountNumber, typeCode: 'shipper' }] : [],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: this.cfg.originPostal || '518000',
            countryCode: 'CN',
          },
        },
        receiverDetails: {
          postalAddress: {
            postalCode: this.cfg.receiverPostal || '10001',
            cityName: this.cfg.receiverCity || 'New York',
            countryCode: p.country,
          },
        },
      },
      packages: [
        {
          weight: chargedKg,
          dimensions: {
            length: p.dims?.lengthCm || 10,
            width: p.dims?.widthCm || 10,
            height: p.dims?.heightCm || 10,
          },
        },
      ],
    };

    const data = await httpRequest(
      `${this.baseUrl}/rates?shipperCountryCode=CN&receiverCountryCode=${p.country}&plannedShippingDate=${encodeURIComponent(this.plannedShippingDate())}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body,
      }
    );

    const products = data?.products || [];
    const best = products[0];
    if (!best) throw new CarrierError('DHL 未返回可用报价', 'NO_QUOTE', data);

    const priceUsd = Number(best?.totalPrice?.[0]?.price || 0);
    if (!priceUsd) throw new CarrierError('DHL 报价为空', 'NO_QUOTE', data);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: best.productName || 'DHL Express Worldwide',
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin: Number(best.deliveryTime || 3),
      daysMax: Number(best.deliveryTime || 5),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: data,
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 apiKey', source: 'api' };
    const t0 = Date.now();
    try {
      await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 }, valueUsd: 20 });
      return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
