// 估算适配器：未配置真实 API 凭据时的演示/兜底报价
// 基于静态国际费率表，按快递类型（经济/标准/特快）叠加倍率生成差异化报价
import { CarrierAdapter } from './base.js';
import { getShippingRates } from '../data/shipping.js';

const MODES = {
  economy: { factor: 1.0, daysFactor: 1.0, label: '经济专线' },
  standard: { factor: 1.35, daysFactor: 0.8, label: '标准快递' },
  express: { factor: 1.8, daysFactor: 0.55, label: '特快专递' },
};

export class EstimateAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super({ ...cfg, mode: cfg.mode || 'standard' });
  }

  get configured() {
    return false; // 估算器始终可用，但标记为估算数据
  }

  async quote(p) {
    const mode = MODES[this.cfg.mode] || MODES.standard;
    const ship = getShippingRates(p.country);
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);

    // 基础运费 = base + perKg * 计费重，乘快递倍率，再乘商户加价
    const baseUsd = Math.max(ship.base + ship.perKg * chargedKg, ship.min);
    const priceUsd = baseUsd * mode.factor * (1 + (this.cfg.markupRate || 0));
    const daysMin = Math.max(1, Math.round(ship.daysMin * mode.daysFactor));
    const daysMax = Math.max(daysMin, Math.round(ship.daysMax * mode.daysFactor));

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: `${this.cfg.name} ${mode.label}`,
      priceUsd: Number(priceUsd.toFixed(2)),
      currency: 'USD',
      daysMin,
      daysMax,
      source: 'estimate',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
    }, {});
  }

  async test() {
    return { ok: true, message: '估算模式（未配置 API）', latencyMs: 0, source: 'estimate' };
  }
}
