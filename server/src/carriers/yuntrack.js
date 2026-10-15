// 云途物流（YunTrack）国际快递适配器
// 官方开放平台：https://open.yunexpress.cn  API 网关：https://openapi.yunexpress.cn
// 鉴权：POST /openapi/oauth2/token 换取 accessToken（2 小时有效）
// 签名：HMAC-SHA256(appSecret, 原文) 后 Base64；原文：
//   POST："body=<json>&date=<tsMs>&method=POST&uri=<path>"
//   GET ："date=<tsMs>&method=GET&uri=<path?query>"（无 body= 键）
// 运费试算：GET /v1/price-trial/get（参数 snake_case，返回 RMB 费用项列表，按产品聚合求和）
import crypto from 'crypto';
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';
import { cnyToCurrency } from '../services/currency.js';

// accessToken 按 appId 缓存，过期前 2 分钟刷新
const tokenCache = new Map();

export class YunTrackAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || 'https://openapi.yunexpress.cn').replace(/\/$/, '');
    this.appId = cfg.appId || cfg.apiKey || '';
    this.appSecret = cfg.appToken || cfg.apiSecret || '';
  }

  get configured() {
    return !!(this.appId && this.appSecret);
  }

  async getToken() {
    const cached = tokenCache.get(this.appId);
    if (cached && cached.expireAt > Date.now()) return cached.token;
    const data = await httpRequest(`${this.baseUrl}/openapi/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: { grantType: 'client_credentials', appId: this.appId, appSecret: this.appSecret },
      timeout: 12000,
    });
    const token = data?.accessToken || data?.data?.accessToken;
    if (!token) {
      const code = data?.code || '';
      if (code === '0200412101') throw new CarrierError('云途应用id或应用秘钥错误', 'AUTH_FAILED', data);
      throw new CarrierError(`云途获取令牌失败: ${data?.message || '未知错误'}`, 'AUTH_FAILED', data);
    }
    const expiresIn = Number(data?.expiresIn || 7200);
    tokenCache.set(this.appId, { token, expireAt: Date.now() + (expiresIn - 120) * 1000 });
    return token;
  }

  signRequest(method, path, bodyStr, date) {
    const signData = bodyStr
      ? `body=${bodyStr}&date=${date}&method=${method}&uri=${path}`
      : `date=${date}&method=${method}&uri=${path}`;
    return crypto.createHmac('sha256', this.appSecret).update(signData).digest('base64');
  }

  async apiCall(method, path, body) {
    const token = await this.getToken();
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const date = String(Date.now());
    const sign = this.signRequest(method, path, bodyStr, date);
    try {
      return await httpRequest(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Accept-Language': 'zh-CN',
          token,
          sign,
          date,
        },
        body,
        timeout: 12000,
      });
    } catch (e) {
      const errData = e.data || {};
      const code = String(errData.code || '');
      if (code === '0200403101' || code === '0200404001') {
        // 已实测验证：该报错=请求路径不存在（不存在路径无 token 也 401，带 token 访问不存在路径返回此码），云途无 IP 白名单
        throw new CarrierError(`云途接口路径不存在（${path.split('?')[0]}）`, 'API_ERROR', errData);
      }
      if (code === '0200401001' || code === '0200401002') {
        tokenCache.delete(this.appId);
        throw new CarrierError('云途访问令牌无效或已过期', 'AUTH_FAILED', errData);
      }
      if (code === '0200401101') throw new CarrierError('云途缺少访问签名', 'SIGN_FAILED', errData);
      throw e;
    }
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('云途未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const params = new URLSearchParams({
      country_code: p.country,
      weight: Number(chargedKg.toFixed(3)).toString(),
      weight_unit: 'KG',
      // 电商 3C 件默认带电 E；普货 C 可经 cfg.packageType 覆盖
      package_type: this.cfg.packageType || 'E',
    });
    if (p.dims?.lengthCm) params.set('length', Number(p.dims.lengthCm).toFixed(3));
    if (p.dims?.widthCm) params.set('width', Number(p.dims.widthCm).toFixed(3));
    if (p.dims?.heightCm) params.set('height', Number(p.dims.heightCm).toFixed(3));

    const resp = await this.apiCall('GET', `/v1/price-trial/get?${params.toString()}`);
    if (resp?.success === false) {
      throw new CarrierError(`云途运费试算失败: ${resp?.msg || '未知错误'}（${resp?.code || ''}）`, 'API_ERROR', resp);
    }
    const rows = Array.isArray(resp?.result) ? resp.result : [];
    if (!rows.length) throw new CarrierError('云途未返回可用报价', 'NO_QUOTE', resp);

    // 同一产品多条费用项（首重/续重/附加费），按 product_code+price_name 聚合求和
    const groups = new Map();
    for (const r of rows) {
      const key = `${r.product_code}|${r.price_name}`;
      if (!groups.has(key)) {
        groups.set(key, {
          productCode: r.product_code,
          productName: r.product_name,
          intervalDay: r.interval_day,
          total: 0,
        });
      }
      groups.get(key).total += Number(r.convert_amount || 0);
    }

    const quotes = [];
    for (const g of groups.values()) {
      // B2B 大货渠道（香港联邦等）对轻小件电商场景无意义，过滤
      if (String(g.productCode).startsWith('USB2B-')) continue;
      const daysMatch = String(g.intervalDay || '').match(/(\d+)\s*[-~—]\s*(\d+)/);
      const priceUsd = cnyToCurrency(g.total, 'USD');
      if (!priceUsd || priceUsd <= 0) continue;
      quotes.push(this.normalize({
        carrier: this.cfg.code,
        carrierName: this.cfg.name,
        productName: g.productName,
        priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
        currency: 'USD',
        daysMin: Number(daysMatch?.[1] || 5),
        daysMax: Number(daysMatch?.[2] || 12),
        source: 'api',
        available: true,
        chargedKg,
        actualKg: p.weightKg,
        volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
        raw: g,
      }, {}));
    }
    if (!quotes.length) throw new CarrierError('云途报价全部无效', 'NO_QUOTE', resp);
    return quotes;
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 appId / appToken（AppSecret）', source: 'api' };
    const t0 = Date.now();
    try {
      await this.getToken();
      try {
        const quotes = await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 } });
        const cheapest = quotes.reduce((a, b) => (a.priceUsd <= b.priceUsd ? a : b));
        return { ok: true, message: `报价正常：${quotes.length} 个产品，最低 ${cheapest.productName} ${cheapest.priceUsd} USD（${cheapest.daysMin}-${cheapest.daysMax} 天）`, latencyMs: Date.now() - t0, source: 'api' };
      } catch (qe) {
        return { ok: false, message: qe.message, latencyMs: Date.now() - t0, source: 'api' };
      }
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
