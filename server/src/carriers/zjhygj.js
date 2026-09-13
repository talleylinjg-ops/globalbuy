// 浙江华源国际（zjhygj）ollogistic 国际物流系统适配器
// 文档：apifox project-3436758
//   业务接口域名：https://business.logistic.mobi
//   查价接口域名：https://calcquery.logistic.mobi
// 流程：登录（POST /api/Client/PostLoginAsync?branchId=租户ID, loginType 必填 5）获取 JWT token，
//       之后查价走 POST /api/Calculate/GetClientPriceOnce（Bearer token，requestKey 每次唯一）
import crypto from 'crypto';
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';
import { cnyToCurrency } from '../services/currency.js';

export class ZjhygjAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.businessBaseUrl = (cfg.businessBaseUrl || 'https://business.logistic.mobi').replace(/\/$/, '');
    this.calcBaseUrl = (cfg.calcBaseUrl || 'https://calcquery.logistic.mobi').replace(/\/$/, '');
    this.account = cfg.account || cfg.apiKey || '';
    this.password = cfg.password || cfg.apiSecret || '';
    this.branchId = Number(cfg.branchId || 0);
    this._token = null;
    this._tokenExp = 0;
  }

  get configured() {
    return !!(this.account && this.password && this.branchId);
  }

  // "7-9" → { daysMin: 7, daysMax: 9 }；单个数字按同值处理
  parseAging(str) {
    const m = String(str || '').match(/(\d+)\s*[-~—]\s*(\d+)/);
    if (m) return { daysMin: Number(m[1]), daysMax: Number(m[2]) };
    const d = String(str || '').match(/\d+/);
    return d ? { daysMin: Number(d[0]), daysMax: Number(d[0]) } : { daysMin: 7, daysMax: 15 };
  }

  // 登录并缓存 token（JWT 自带 exp，提前 60s 过期视为失效）
  async getToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExp - 60000) return this._token;
    const data = await httpRequest(
      `${this.businessBaseUrl}/api/Client/PostLoginAsync?branchId=${this.branchId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: {
          userCode: this.account,
          userPwd: this.password,
          branchId: this.branchId,
          loginType: 5,
        },
        timeout: 45000,
      },
    );
    if (!data || data.code !== 200 || !data.data?.token) {
      throw new CarrierError(data?.message || '华源国际登录失败', 'AUTH_FAILED', data);
    }
    this._token = data.data.token;
    try {
      const payload = JSON.parse(Buffer.from(this._token.split('.')[1], 'base64').toString());
      this._tokenExp = (payload.exp || 0) * 1000;
    } catch {
      this._tokenExp = now + 30 * 60 * 1000;
    }
    return this._token;
  }

  async quote(p) {
    if (!this.configured) {
      throw new CarrierError('华源国际未配置凭据（账号/密码/租户ID）', 'NOT_CONFIGURED');
    }
    const token = await this.getToken();
    const body = {
      body: {
        destCode: p.country,
        goodsType: 1, // 1=包裹 2=袋子 3=文件
        typeAndServices: [],
        likeWeight: p.weightKg,
        boxWeightSizes: [{
          weight: p.weightKg,
          l: p.dims?.lengthCm || 0,
          w: p.dims?.widthCm || 0,
          h: p.dims?.heightCm || 0,
          pcs: 1,
        }],
      },
      requestKey: crypto.randomUUID(),
    };
    const data = await httpRequest(`${this.calcBaseUrl}/api/Calculate/GetClientPriceOnce`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      timeout: 55000,
    });
    if (!data || data.code !== 200) {
      throw new CarrierError(data?.message || '华源国际查价失败', 'API_ERROR', data);
    }
    const arr = Array.isArray(data.data) ? data.data : [];
    // 实际响应为 camelCase（文档示例为 PascalCase），两种都兼容
    const routes = arr
      .map((x) => x?.recPriceTemp || x?.RecPriceTemp)
      .filter(Boolean);
    if (!routes.length) throw new CarrierError('华源国际无可用报价', 'NO_QUOTE', data);

    // 响应币种多为 RMB，统一换算为 USD；每个渠道一条报价（按运费+附加费升序，最多取 6 条）
    const pick = (obj, camel, pascal) => obj[camel] ?? obj[pascal];
    const parsed = routes
      .map((r) => {
        const fee = pick(r, 'currentFee', 'CurrentFee') || {};
        return {
          routeName: pick(r, 'routeName', 'RouteName'),
          routeCode: pick(r, 'routeCode', 'RouteCode'),
          routeId: pick(r, 'routeId', 'RouteId'),
          chargeWeight: pick(r, 'chargeWeight', 'ChargeWeight'),
          estimatedTime: pick(r, 'estimatedTime', 'EstimatedTime') ?? pick(fee, 'estimatedTime', 'EstimatedTime'),
          currency: pick(fee, 'currency', 'Currency'),
          totalFee: Number(pick(fee, 'fee', 'Fee') || 0) + Number(pick(fee, 'otherFee', 'OtherFee') || 0),
        };
      })
      .filter((r) => r.totalFee > 0)
      .sort((a, b) => a.totalFee - b.totalFee)
      .slice(0, 6);
    if (!parsed.length) throw new CarrierError('华源国际报价为空', 'NO_QUOTE', data);

    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);

    // 多渠道报价：每条渠道独立成档，供三档挑选与渠道列表展示
    const quotes = parsed.map((r) => {
      const currency = String(r.currency || 'RMB').toUpperCase();
      const priceUsd = currency === 'USD' ? r.totalFee : cnyToCurrency(r.totalFee, 'USD');
      const { daysMin, daysMax } = this.parseAging(r.estimatedTime);
      return this.normalize({
        carrier: this.cfg.code,
        carrierName: this.cfg.name,
        productName: r.routeName || r.routeCode || '华源国际渠道',
        priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
        currency: 'USD',
        daysMin,
        daysMax,
        source: 'api',
        available: true,
        chargedKg: Number(r.chargeWeight) || chargedKg,
        actualKg: p.weightKg,
        volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
        raw: { routeCode: r.routeCode, routeId: r.routeId, priceCny: currency !== 'USD' ? r.totalFee : undefined },
      }, {});
    });
    return quotes;
  }

  async test() {
    if (!this.configured) {
      return { ok: false, message: '缺少账号 / 密码 / 租户ID（branchId）', source: 'api' };
    }
    const t0 = Date.now();
    try {
      await this.getToken();
      return { ok: true, message: '登录成功，token 已获取', latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
