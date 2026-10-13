// 云途物流（YunTrack）国际快递适配器
// 官方开放平台：https://open.yunexpress.cn  API 网关：https://openapi.yunexpress.cn
// 鉴权：POST /openapi/oauth2/token 换取 accessToken（2 小时有效）
// 签名：HMAC-SHA256(appSecret, "body=<body>&date=<tsMs>&method=<METHOD>&uri=<path>") 后 Base64
import crypto from 'crypto';
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';

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
    const signData = `body=${bodyStr}&date=${date}&method=${method}&uri=${path}`;
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
      if (code === '0200403101') {
        throw new CarrierError('云途接口拒绝访问：调用方 IP 未加入白名单（需在云途用户中心或联系云途客服添加服务器出口 IP）', 'IP_BLOCKED', errData);
      }
      if (code === '0200401001' || code === '0200401002') {
        tokenCache.delete(this.appId);
        throw new CarrierError('云途访问令牌无效或已过期', 'AUTH_FAILED', errData);
      }
      if (code === '0200401101') throw new CarrierError('云途缺少访问签名', 'SIGN_FAILED', errData);
      throw e;
    }
  }

  // 云途业务响应：code 为 "0"/"200"/"success" 视为成功
  static isBizOk(resp) {
    const code = String(resp?.code ?? '').toLowerCase();
    return ['0', '200', 'success', 'true'].includes(code);
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('云途未配置 API 凭据', 'NOT_CONFIGURED');
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const body = {
      countryCode: p.country,
      weight: Number(chargedKg.toFixed(3)),
      length: p.dims?.lengthCm || 0,
      width: p.dims?.widthCm || 0,
      height: p.dims?.heightCm || 0,
      goodsValue: p.valueUsd || 0,
    };

    const resp = await this.apiCall('POST', '/openapi/freight/tryCalculateFreight', body);
    if (!YunTrackAdapter.isBizOk(resp)) {
      throw new CarrierError(`云途运费试算失败: ${resp?.message || resp?.msg || '未知错误'}`, 'API_ERROR', resp);
    }

    // 兼容多种返回结构：data 为报价数组
    const list = resp?.data;
    const items = Array.isArray(list) ? list : Array.isArray(list?.list) ? list.list : [];
    const item = items.find((i) => i.available !== false) || items[0];
    if (!item) throw new CarrierError('云途未返回可用报价', 'NO_QUOTE', resp);

    const priceUsd = Number(item.totalFee || item.totalAmount || item.freight || item.price || 0);
    if (!priceUsd) throw new CarrierError('云途报价为空', 'NO_QUOTE', resp);

    const daysText = String(item.aging || item.efficiency || '');
    const daysMatch = daysText.match(/(\d+)\s*[-~—]\s*(\d+)/);

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: item.productName || item.propertyName || item.channelName || '云途渠道',
      priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
      currency: item.currency || 'USD',
      daysMin: Number(item.daysMin || item.predictDaysMin || daysMatch?.[1] || 5),
      daysMax: Number(item.daysMax || item.predictDaysMax || daysMatch?.[2] || 10),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: resp,
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 appId / appToken（AppSecret）', source: 'api' };
    const t0 = Date.now();
    try {
      // test 先验证鉴权链路，再尝试业务报价
      await this.getToken();
      try {
        await this.quote({ country: 'US', weightKg: 0.5, dims: { lengthCm: 15, widthCm: 10, heightCm: 5 }, valueUsd: 20 });
        return { ok: true, message: '连接成功，报价正常返回', latencyMs: Date.now() - t0, source: 'api' };
      } catch (qe) {
        if (qe.code === 'IP_BLOCKED') {
          return { ok: false, message: `鉴权通过，但 ${qe.message}`, latencyMs: Date.now() - t0, source: 'api' };
        }
        return { ok: false, message: qe.message, latencyMs: Date.now() - t0, source: 'api' };
      }
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
