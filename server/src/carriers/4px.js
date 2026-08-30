// 递四方（4PX）国际快递适配器
// 开放平台：https://open.4px.com  运费试算 API
import crypto from 'crypto';
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

export class FourPXAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://open.4px.com').replace(/\/$/, '');
    this.appKey = cfg.appKey || cfg.apiKey || '';
    this.appSecret = cfg.appSecret || cfg.apiSecret || '';
  }

  // 递四方签名：sha256(appKey + params + timestamp + appSecret) 简化示意
  sign(body, timestamp) {
    const raw = this.appKey + JSON.stringify(body) + timestamp + this.appSecret;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('4PX 未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = {
      routeCode: this.cfg.routeCode || '',
      country: p.country,
      weight: chargedKg,
      length: p.dims?.lengthCm || 0,
      width: p.dims?.widthCm || 0,
      height: p.dims?.heightCm || 0,
    };
    const sign = this.sign(body, timestamp);

    const data = await httpRequest(`${this.baseUrl}/api/shipping/estimate`, {
      method: 'POST',
      headers: {
        'x-app-key': this.appKey,
        'x-timestamp': timestamp,
        'x-sign': sign,
      },
      body,
    });

    const item = data?.data || data?.result || data;
    const priceUsd = Number(item.freight || item.totalPrice || item.price || 0);
    if (!priceUsd) throw new CarrierError('4PX 未返回可用报价', 'NO_QUOTE', data);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: item.routeName || item.productName || '4PX 渠道',
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin: Number(item.deliveryTimeMin || item.daysMin || 5),
      daysMax: Number(item.deliveryTimeMax || item.daysMax || 12),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: data,
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 appKey / appSecret', source: 'api' };
    const t0 = Date.now();
    try {
      await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 }, valueUsd: 20 });
      return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
