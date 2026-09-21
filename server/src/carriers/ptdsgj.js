// PTD 国际速递（ptdsgj）新智慧 TMS v5 适配器
// 文档：https://ptdsgj.nextsls.com/api/v5/docs
// 认证：Authorization: Bearer <token>（API 密钥）
// 查价：POST {gateway}/api/v5/shipment/calculator，返回各渠道 CNY 总价 + 时效
// 连接测试：POST {gateway}/api/v5/shipment/get_services
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';
import { cnyToCurrency } from '../services/currency.js';

export class PtdsgjAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://ptdsgj.nextsls.com').replace(/\/$/, '');
    this.token = cfg.token || cfg.apiKey || '';
    // 收货区域（API 账号需在对方后台绑定该区域，否则 calculator 返回 0 渠道）
    this.pickupZone = cfg.pickupZone || '深圳';
  }

  get configured() {
    return !!this.token;
  }

  // "10-20" → { daysMin: 10, daysMax: 20 }；单个数字按同值处理
  parseAging(str) {
    const m = String(str || '').match(/(\d+)\s*[-~—]\s*(\d+)/);
    if (m) return { daysMin: Number(m[1]), daysMax: Number(m[2]) };
    const d = String(str || '').match(/\d+/);
    return d ? { daysMin: Number(d[0]), daysMax: Number(d[0]) } : { daysMin: 5, daysMax: 12 };
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('PTD 未配置 token', 'NOT_CONFIGURED');
    // calculator 要求长宽高必填且大于 0；询价链路无箱型时用默认箱（20x15x10cm，体积重 0.5kg）
    const dims = p.dims || {};
    const len = Number(dims.lengthCm) > 0 ? Number(dims.lengthCm) : 20;
    const wid = Number(dims.widthCm) > 0 ? Number(dims.widthCm) : 15;
    const hei = Number(dims.heightCm) > 0 ? Number(dims.heightCm) : 10;
    const body = {
      shipment: {
        pickup_zone: this.pickupZone,
        to_country: p.country,
        postcode: p.postcode || '',
        parcels: [{
          client_weight: p.weightKg,
          client_length: len,
          client_width: wid,
          client_height: hei,
        }],
      },
    };
    const data = await httpRequest(`${this.baseUrl}/api/v5/shipment/calculator`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      timeout: 20000,
    });
    if (!data || data.status !== 1) {
      throw new CarrierError(data?.info || 'PTD 查价请求失败', 'API_ERROR', data);
    }
    const rows = Array.isArray(data.data) ? data.data.filter((r) => Number(r.total_charge) > 0) : [];
    if (!rows.length) {
      throw new CarrierError('PTD 无可用渠道（请确认对方已为该账号绑定收货区域）', 'NO_QUOTE', data);
    }

    // 多渠道取 CNY 总价最低的一条作为该快递商报价
    const best = [...rows].sort((a, b) => Number(a.total_charge) - Number(b.total_charge))[0];
    const { daysMin, daysMax } = this.parseAging(best.service_aging);
    const priceCny = Number(best.total_charge);
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: best.service_name || best.service_code || 'PTD 渠道',
      priceUsd: Number((cnyToCurrency(priceCny, 'USD') * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: 'USD',
      daysMin,
      daysMax,
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: { serviceCode: best.service_code, detailCharge: best.detail_charge, priceCny },
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 token', source: 'api' };
    const t0 = Date.now();
    try {
      const data = await httpRequest(`${this.baseUrl}/api/v5/shipment/get_services`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: { services: { type: 'all' } },
        timeout: 15000,
      });
      const count = Array.isArray(data?.data?.services) ? data.data.services.length : 0;
      if (data?.status !== 1) return { ok: false, message: data?.info || 'PTD 鉴权失败', latencyMs: Date.now() - t0, source: 'api' };
      return {
        ok: true,
        message: count ? `连接成功，可用渠道 ${count} 个` : '连接成功，暂无可用渠道',
        latencyMs: Date.now() - t0,
        source: 'api',
      };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
