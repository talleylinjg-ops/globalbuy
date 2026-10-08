// 中国邮政 EMS 适配器
// 对接《中小电商企业接口规范 V2.7》（中邮信息科技）
// 公共请求参数：apiCode / senderNo / authorization / msgType / timeStamp / version / logitcsInterface / userCode
// 公共返回参数：retCode(00000 成功) / retMsg / retBody / retDate / serialNo
// 说明：本规范的预估邮费(050005)面向国内寄递资费（返回人民币），
//       跨境段资费待邮政国际产品接入后通过 productCode 配置切换。
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';
import { cnyToCurrency } from '../services/currency.js';

const API_FREIGHT_ESTIMATE = '050005';

// 默认产品代码：电商标快（V2.7 5.24 产品代码表）
const DEFAULT_PRODUCT_CODE = '115104300000691';

function timeStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export class EMSAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || '').trim().replace(/\/$/, '');
  }

  // 网关地址 + 客户代码 + 授权码齐备才视为可用（V2.7 文档不含网关地址，需邮政接入函提供）
  get configured() {
    return !!(this.baseUrl && this.cfg.senderNo && this.cfg.authorization);
  }

  // V2.7 4.1 公共请求信封
  envelope(apiCode, bizBody) {
    const env = {
      apiCode,
      senderNo: this.cfg.senderNo,
      authorization: this.cfg.authorization,
      msgType: '0',
      timeStamp: timeStamp(),
      version: 'V1.0.0',
      logitcsInterface: bizBody,
    };
    if (this.cfg.userCode) env.userCode = this.cfg.userCode;
    return env;
  }

  async call(apiCode, bizBody) {
    if (!this.configured) {
      throw new CarrierError('EMS 未配置（需网关地址 baseUrl、客户代码 senderNo、授权码 authorization）', 'NOT_CONFIGURED');
    }
    let data;
    try {
      data = await httpRequest(this.baseUrl, {
        method: 'POST',
        body: this.envelope(apiCode, bizBody),
        timeout: 8000,
      });
    } catch (e) {
      throw new CarrierError(`EMS 网关请求失败：${e.message}`, 'CARRIER_ERROR');
    }
    const retCode = String(data?.retCode ?? '');
    if (retCode !== '00000') {
      throw new CarrierError(`EMS ${apiCode} 返回 ${retCode || '无 retCode'}：${data?.retMsg || '未知错误'}`, 'NO_QUOTE', data);
    }
    return data.retBody ?? data;
  }

  // V2.7 5.24 预估邮费接口（productCode / weight克 / senderInfo / receiveInfo）
  async quote(p) {
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const receiveInfo = p.receiveInfo || this.cfg.defaultReceiveInfo;
    if (!this.cfg.senderAddress || !receiveInfo) {
      throw new CarrierError('EMS 预估邮费需配置寄件地址(senderAddress)与默认收件地址(defaultReceiveInfo)', 'NOT_CONFIGURED');
    }
    const bizBody = {
      productCode: this.cfg.productCode || DEFAULT_PRODUCT_CODE,
      weight: String(Math.round(chargedKg * 1000)),
      senderInfo: this.cfg.senderAddress,
      receiveInfo,
    };
    const ret = await this.call(API_FREIGHT_ESTIMATE, bizBody);
    const realFee = Number(ret?.realFee ?? ret?.totalFee ?? 0);
    if (!realFee) throw new CarrierError('EMS 未返回可用邮资', 'NO_QUOTE', ret);

    const priceCny = Number((realFee * (1 + (this.cfg.markupRate || 0))).toFixed(2));
    const priceUsd = Number(cnyToCurrency(priceCny, 'USD').toFixed(2));

    return this.normalize({
      carrier: this.cfg.code,
      carrierName: this.cfg.name,
      productName: 'EMS 邮政快递',
      priceUsd,
      currency: 'USD',
      daysMin: Number(this.cfg.daysMin || 7),
      daysMax: Number(this.cfg.daysMax || 15),
      source: 'api',
      available: true,
      chargedKg,
      actualKg: p.weightKg,
      volumetricKg: CarrierAdapter.chargedWeight(p.weightKg, p.dims).volumetricKg,
      raw: { ret, bizBody },
    }, {});
  }

  async test() {
    if (!this.configured) return { ok: false, message: '缺少网关地址 / 客户代码(senderNo) / 授权码(authorization)', source: 'api' };
    if (!this.cfg.senderAddress) return { ok: false, message: '缺少寄件地址(senderAddress)', source: 'api' };
    const t0 = Date.now();
    try {
      const r = await this.quote({
        country: 'CN',
        weightKg: 0.5,
        dims: { lengthCm: 15, widthCm: 10, heightCm: 5 },
        valueUsd: 20,
      });
      const raw = r.raw?.ret || {};
      return {
        ok: true,
        message: `连接成功：0.5kg 预估邮费 ${raw.realFee ?? raw.totalFee} 元（标准资费 ${raw.standardFee ?? '-'}）`,
        latencyMs: Date.now() - t0,
        source: 'api',
      };
    } catch (e) {
      return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
    }
  }
}
