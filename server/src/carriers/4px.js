// 递四方（4PX）FOP 开放平台适配器
// 网关：https://open.4px.com/router/api/service（测试环境 open-test.4px.com）
// 公共参数放 URL query：method/app_key/v/timestamp(毫秒)/format=json/access_token(B类客户可不传)/sign/language
// 业务参数放 body，JSON 压缩格式
// 签名（官方规范，已实测验证）：按首字母升序 app_key→format→method→timestamp→v 连接参数名与参数值
// （去掉所有 = 和 &），尾部追加 body 原文与 appSecret，MD5 32 位小写；access_token 与 language 不参与签名
// 响应结构：{ result: '0'失败 | '1'成功 | '2'部分成功, msg, data, errors: [{error_code, error_msg}] }
// 运费试算：ds.xms.estimated_cost.get
//   请求：country_code(二字码) / weight(实重，单位g) / length,width,height(cm，三选一需全填) / cargocode(P包裹,D文件)
//   响应 data[]：logistics_product_code / lump_sum_fee(总费用CNY) / is_volume_cargo(Y/N泡货)
//               charge_weight(如"1.02kg") / estimated_time(如"7-10天") / is_show_track / remarks
import crypto from 'crypto';
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';
import { cnyToCurrency } from '../services/currency.js';

const GATEWAY = 'https://open.4px.com/router/api/service';
const METHOD_ESTIMATED_COST = 'ds.xms.estimated_cost.get';

export class FourPXAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.gateway = (cfg.baseUrl || GATEWAY).replace(/\/$/, '');
    this.appKey = cfg.appKey || cfg.apiKey || '';
    this.appSecret = cfg.appSecret || cfg.apiSecret || '';
    this.accessToken = cfg.appToken || '';
    this.apiVersion = cfg.apiVersion || '1.0';
  }

  get configured() {
    return !!(this.appKey && this.appSecret);
  }

  // 官方签名：升序公共参数 k+v 连接 + body 原文 + appSecret → MD5 小写
  sign(method, timestamp, version, bodyJson) {
    const cause =
      'app_key' + this.appKey +
      'format' + 'json' +
      'method' + method +
      'timestamp' + timestamp +
      'v' + version +
      bodyJson + this.appSecret;
    return crypto.createHash('md5').update(cause, 'utf8').digest('hex');
  }

  async callApi(method, biz) {
    const bodyJson = JSON.stringify(biz);
    const timestamp = String(Date.now());
    const sign = this.sign(method, timestamp, this.apiVersion, bodyJson);
    const qs = new URLSearchParams({
      method,
      app_key: this.appKey,
      v: this.apiVersion,
      timestamp,
      format: 'json',
      access_token: this.accessToken || '',
      sign,
      language: 'cn',
    }).toString();

    let data;
    try {
      data = await httpRequest(`${this.gateway}?${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyJson,
        timeout: 30000,
      });
    } catch (e) {
      const apiMsg = e.data?.message || (typeof e.data === 'string' ? e.data : '');
      if (apiMsg.includes('API接口不存在')) {
        throw new CarrierError('接口不存在（method 名错误或未授权）', 'API_ERROR', e.data);
      }
      throw e;
    }

    if (data && typeof data === 'object' && data.result !== undefined) {
      if (data.result !== '1' && data.result !== '2') {
        const err = Array.isArray(data.errors) && data.errors[0];
        const detail = err ? `${err.error_code} ${err.error_msg}` : (data.msg || '未知错误');
        throw new CarrierError(`4PX ${detail}`, 'API_ERROR', data);
      }
      return data;
    }
    throw new CarrierError(`网关异常: ${String(data).slice(0, 120)}`, 'API_ERROR', data);
  }

  async quote(p) {
    if (!this.configured) throw new CarrierError('4PX 未配置 API 凭据', 'NOT_CONFIGURED');
    const { actualKg, volumetricKg, chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const biz = {
      country_code: p.country,
      weight: Math.round(chargedKg * 1000),
      cargocode: 'P',
    };
    // 长宽高三选一需全填；无尺寸时不传，4PX 按实重计费
    if (p.dims?.lengthCm && p.dims?.widthCm && p.dims?.heightCm) {
      biz.length = Number(p.dims.lengthCm.toFixed(2));
      biz.width = Number(p.dims.widthCm.toFixed(2));
      biz.height = Number(p.dims.heightCm.toFixed(2));
    }

    const data = await this.callApi(METHOD_ESTIMATED_COST, biz);
    // data 可能为 JSON 字符串（接口回传格式），二次解析
    let payload = data?.data;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = []; }
    }
    const rows = Array.isArray(payload) ? payload : [];
    const usable = rows.filter((r) => Number(r.lump_sum_fee ?? 0) > 0);
    if (!usable.length) throw new CarrierError('4PX 无可用渠道报价', 'NO_QUOTE', data);

    const sorted = [...usable].sort((a, b) => Number(a.lump_sum_fee) - Number(b.lump_sum_fee));
    return sorted.slice(0, 6).map((r) => {
      const priceUsd = Number((cnyToCurrency(Number(r.lump_sum_fee), 'USD') * (1 + (this.cfg.markupRate || 0))).toFixed(2));
      const aging = String(r.estimated_time || '');
      const m = aging.match(/(\d+)\s*[-~—]\s*(\d+)/);
      const chargeWeightKg = parseFloat(r.charge_weight) || chargedKg;
      return this.normalize({
        carrier: this.cfg.code,
        carrierName: this.cfg.name,
        productName: r.logistics_product_code || '4PX 渠道',
        priceUsd,
        currency: 'USD',
        daysMin: m ? Number(m[1]) : 5,
        daysMax: m ? Number(m[2]) : 12,
        source: 'api',
        available: true,
        chargedKg: chargeWeightKg,
        actualKg,
        volumetricKg,
        raw: { productCode: r.logistics_product_code, priceCny: r.lump_sum_fee, isVolume: r.is_volume_cargo, remarks: r.remarks },
      }, {});
    });
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少 appKey / appSecret', source: 'api' };
    const t0 = Date.now();
    try {
      const list = await this.quote({ country: 'US', weightKg: 0.5, valueUsd: 20 });
      return { ok: true, message: `连接成功，可用渠道 ${list.length} 个`, latencyMs: Date.now() - t0, source: 'api' };
    } catch (e) {
      const cause = e.cause?.code || e.cause?.message || '';
      const msg = e.message === 'fetch failed' && cause
        ? `网络不可达（${cause}）——检查服务器能否访问 ${this.gateway}`
        : e.message;
      return { ok: false, message: msg, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
