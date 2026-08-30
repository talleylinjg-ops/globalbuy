// 中国邮政 EMS 国际快递适配器
// 邮政小包 / EMS 报价接口（简化示意）
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

export class EMSAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://open.ems.com.cn').replace(/\/$/, '');
    this.userId = cfg.userId || cfg.apiKey || '';
    this.apiKey = cfg.apiKey || '';
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('EMS 未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);

    const body = {
      userId: this.userId,
      countryCode: p.country,
      weight: chargedKg,
      productType: this.cfg.productType || 'EMS',
      length: p.dims?.lengthCm || 0,
      width: p.dims?.widthCm || 0,
      height: p.dims?.heightCm || 0,
    };

    const data = await httpRequest(`${this.baseUrl}/api/quote`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey },
      body,
    });

    const item = data?.data || data?.result || data;
    const priceUsd = Number(item.fee || item.price || item.amount || 0);
    if (!priceUsd) throw new CarrierError('EMS 未返回可用报价', 'NO_QUOTE', data);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: item.productName || (this.cfg.productType === 'EMS' ? 'EMS 国际特快' : '国际小包'),
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin: Number(item.daysMin || 7),
      daysMax: Number(item.daysMax || 15),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: data,
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 userId / apiKey', source: 'api' };
    const t0 = Date.now();
    try {
      await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 }, valueUsd: 20 });
      return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
