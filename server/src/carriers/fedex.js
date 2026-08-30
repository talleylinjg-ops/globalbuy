// FedEx 国际快递适配器
// Rate API: https://developer.fedex.com  POST /rate/v1/rates/quotes
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

export class FedExAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://apis.fedex.com').replace(/\/$/, '');
    this.apiKey = cfg.apiKey || '';
    this.apiSecret = cfg.apiSecret || '';
    this.accountNumber = cfg.accountNumber || '';
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('FedEx 未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);

    const body = {
      accountNumber: { value: this.accountNumber },
      requestedShipment: {
        shipper: { address: { postalCode: this.cfg.originPostal || '518000', countryCode: 'CN' } },
        recipient: { address: { postalCode: this.cfg.receiverPostal || '10001', countryCode: p.country } },
        pickuptype: 'DROPOFF_AT_FEDEX_LOCATION',
        serviceType: this.cfg.serviceType || 'INTERNATIONAL_PRIORITY',
        requestedPackageLineItems: [
          {
            weight: { units: 'KG', value: chargedKg },
            dimensions: {
              length: p.dims?.lengthCm || 10,
              width: p.dims?.widthCm || 10,
              height: p.dims?.heightCm || 10,
              units: 'CM',
            },
          },
        ],
      },
    };

    const data = await httpRequest(`${this.baseUrl}/rate/v1/rates/quotes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'x-locale': 'en_US',
      },
      body,
    });

    const quotes = data?.output?.rateReplyDetails || [];
    const q = quotes[0];
    if (!q) throw new CarrierError('FedEx 未返回可用报价', 'NO_QUOTE', data);

    const priceUsd = Number(q.ratedShipmentDetails?.[0]?.totalNetCharge || 0);
    if (!priceUsd) throw new CarrierError('FedEx 报价为空', 'NO_QUOTE', data);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: q.serviceName || 'FedEx International',
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin: Number(q.commit?.transitTime || 3),
      daysMax: Number(q.commit?.transitTime || 5),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: data,
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 apiKey / apiSecret', source: 'api' };
    const t0 = Date.now();
    try {
      await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 }, valueUsd: 20 });
      return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
