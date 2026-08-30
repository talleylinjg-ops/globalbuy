// 云途物流（YunTrack）国际快递适配器
// 官方开放平台：https://open.yuntrack.com  （云途开放平台运费试算接口）
import crypto from 'crypto';
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

export class YunTrackAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://open.yuntrack.com').replace(/\/$/, '');
    this.appId = cfg.appId || cfg.apiKey || '';
    this.appToken = cfg.appToken || cfg.apiSecret || '';
  }

  // 云途签名：md5(appId + appToken + sortedParams + timestamp) 简化示意
  sign(params, timestamp) {
    const keys = Object.keys(params).sort();
    const raw = this.appId + this.appToken + keys.map((k) => `${k}${params[k]}`).join('') + timestamp;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('云途未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = {
      countryCode: p.country,
      weight: chargedKg,
      length: p.dims?.lengthCm || 0,
      width: p.dims?.widthCm || 0,
      height: p.dims?.heightCm || 0,
      declaredValue: p.valueUsd || 0,
    };
    const params = { ...body, appId: this.appId, timestamp };
    const sign = this.sign(params, timestamp);

    const data = await httpRequest(`${this.baseUrl}/open/api/quote/price`, {
      method: 'POST',
      headers: {
        'app-id': this.appId,
        timestamp,
        sign,
        'Content-Type': 'application/json',
      },
      body,
    });

    // 解析：不同渠道可能返回多条报价，取第一条可用的
    const items = data?.data || data?.result || [];
    const item = Array.isArray(items) ? items.find((i) => i.available !== false) || items[0] : data;
    if (!item) throw new CarrierError('云途未返回可用报价', 'NO_QUOTE', data);

    const priceUsd = Number(item.totalFee || item.fee || item.price || 0);
    if (!priceUsd) throw new CarrierError('云途报价为空', 'NO_QUOTE', data);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: item.channelName || item.productName || '云途渠道',
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin: Number(item.predictDaysMin || item.daysMin || 5),
      daysMax: Number(item.predictDaysMax || item.daysMax || 10),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: data,
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 appId / appToken', source: 'api' };
    const t0 = Date.now();
    try {
      await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 }, valueUsd: 20 });
      return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
