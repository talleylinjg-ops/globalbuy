// 顺丰国际（SF International OpenAPI，api-ifsp.sf.global）适配器
// 协议（源自官方 JS.zip 样例破解）：
//   1) GET  /openapi/api/token?appKey=&appSecret=  -> accessToken（7200s，需缓存）
//   2) POST /openapi/api/dispatch  公共参数放 HTTP 请求头：msgType/appKey/token/timestamp/nonce/signature/lang
//      body = AES 密文 Base64 纯字符串；签名 = SHA256([token,timestamp,nonce,密文].sort().join())
//   3) 响应 apiResultData 为密文，AES-CBC 解密后得业务 JSON
// 运费试算 msgType：IUOP_ESTIMATE_FEE（电商预估总运费）
import crypto from 'crypto';
import { CarrierAdapter, CarrierError } from './base.js';
import { httpRequest } from './http.js';
import { cnyToCurrency } from '../services/currency.js';
import { sfEncrypt, sfDecrypt, sfSignature } from './sfcrypto.js';

const DEFAULT_BASE = 'https://api-ifsp.sf.global';
const DEFAULT_MSGTYPE = 'IUOP_ESTIMATE_FEE';
const tokenCache = new Map();
const tokenInflight = new Map();

export class SFIntlAdapter extends CarrierAdapter {
  constructor(cfg = {}) {
    super(cfg);
    this.baseUrl = (cfg.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    this.appKey = cfg.appKey || '';
    this.appSecret = cfg.appSecret || '';
    this.aesKey = cfg.aesKey || '';
    this.customerCode = cfg.customerCode || '';
    this.customerType = Number(cfg.customerType || 2);
    // serviceCode 字段复用为运费试算 msgType，默认 IUOP_ESTIMATE_FEE
    this.msgType = cfg.serviceCode || DEFAULT_MSGTYPE;
  }

  get configured() {
    return !!(this.appKey && this.appSecret && this.aesKey && this.customerCode);
  }

  async getToken(force = false) {
    const cached = tokenCache.get(this.appKey);
    if (!force && cached && cached.expireAt > Date.now() + 5 * 60 * 1000) return cached.token;
    // 并发去重：生产 token 为单活跃策略（新 token 使旧 token 失效），
    // 多产品码并行询价时必须共用同一次 token 请求，否则先发出的请求会被判 invalid
    const inflight = tokenInflight.get(this.appKey);
    if (inflight) return inflight;
    const p = (async () => {
      const url = `${this.baseUrl}/openapi/api/token?appKey=${encodeURIComponent(this.appKey)}&appSecret=${encodeURIComponent(this.appSecret)}`;
      const res = await httpRequest(url, { method: 'GET', timeout: 15000 });
      const j = typeof res === 'object' && res !== null ? res : (() => { try { return JSON.parse(res); } catch { return null; } })();
      if (!j || typeof j !== 'object') {
        throw new CarrierError(`token 响应无法解析: ${String(res).slice(0, 120)}`, 'API_ERROR');
      }
      if (j.apiResultCode !== 0) {
        throw new CarrierError(`获取 token 失败: ${j.apiErrorMsg || '未知'}（code=${j.apiResultCode}）`, 'AUTH_ERROR', j);
      }
      const token = j.apiResultData?.accessToken;
      const expireIn = Number(j.apiResultData?.expireIn || 7200);
      if (!token) throw new CarrierError('token 响应缺少 accessToken', 'API_ERROR', j);
      tokenCache.set(this.appKey, { token, expireAt: Date.now() + expireIn * 1000 });
      return token;
    })();
    tokenInflight.set(this.appKey, p);
    try {
      return await p;
    } finally {
      tokenInflight.delete(this.appKey);
    }
  }

  async callApi(msgType, biz, { retried = false } = {}) {
    const token = await this.getToken();
    const encrypted = sfEncrypt(JSON.stringify(biz ?? {}), this.aesKey, this.appKey);
    const timestamp = String(Date.now());
    const nonce = 'n' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);

    const res = await httpRequest(`${this.baseUrl}/openapi/api/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        msgType,
        appKey: this.appKey,
        token,
        timestamp,
        nonce,
        signature: sfSignature(token, timestamp, nonce, encrypted),
        lang: 'zh-CN',
      },
      body: encrypted,
      timeout: 30000,
    });

    const j = typeof res === 'object' && res !== null ? res : (() => { try { return JSON.parse(res); } catch { return null; } })();
    if (!j || typeof j !== 'object') {
      throw new CarrierError(`dispatch 响应无法解析: ${String(res).slice(0, 120)}`, 'API_ERROR');
    }
    if (j.apiResultCode === 500 && String(j.apiErrorMsg || '').includes('token invalid') && !retried) {
      await this.getToken(true);
      return this.callApi(msgType, biz, { retried: true });
    }
    if (j.apiResultCode !== 0) {
      const friendly = {
        1004: '没权限（appKey 未开通对应服务授权）',
        2001: '签名验证错误',
        2002: '请求头缺失',
        2004: 'Content-Type 错误（必须 application/json）',
      };
      const code = Number(j.apiResultCode);
      throw new CarrierError(`顺丰国际: ${friendly[code] || j.apiErrorMsg || '未知'}（code=${j.apiResultCode}）`, code === 1004 ? 'AUTH_ERROR' : 'API_ERROR', j);
    }
    // 业务响应为密文
    let bizText;
    try {
      bizText = sfDecrypt(j.apiResultData, this.aesKey, this.appKey);
    } catch {
      // 部分错误响应（如系统异常）可能直接返回明文 JSON
      if (typeof j.apiResultData === 'string' && j.apiResultData.trim().startsWith('{')) {
        bizText = j.apiResultData;
      } else {
        throw new CarrierError('顺丰国际响应解密失败', 'API_ERROR', j);
      }
    }
    let bizJson;
    try { bizJson = JSON.parse(bizText); } catch {
      throw new CarrierError(`顺丰国际业务响应无法解析: ${bizText.slice(0, 120)}`, 'API_ERROR');
    }
    // 业务层 success=false
    if (bizJson && bizJson.success === false) {
      throw new CarrierError(`顺丰国际: ${bizJson.msg || '业务错误'}（code=${bizJson.code}）`, 'API_ERROR', bizJson);
    }
    return bizJson;
  }

  buildFeeBiz(p) {
    const { chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    const weight = Math.max(Number(chargedKg.toFixed(2)), 0.01);
    const biz = {
      serialNumber: 'CB' + Date.now() + crypto.randomInt(1000),
      customerCode: this.customerCode,
      customerType: this.customerType,
      interProductCode: p.interProductCode || this.cfg.interProductCode || 'INT0263',
      parcelQuantity: 1,
      parcelTotalWeight: weight,
      weightUnit: 'KG',
      lengthUnit: 'CM',
      senderInfo: {
        country: p.originCountry || 'CN',
        postCode: p.originPostCode || '518000',
        regionFirst: 'Guangdong',
        regionSecond: 'Shenzhen',
        address: 'No.1 Test Street',
        cargoType: 2,
      },
      receiverInfo: {
        country: p.country,
        postCode: p.postCode || '90210',
        cargoType: 1,
      },
      paymentInfo: { payMethod: '1', payMonthCard: '', taxPayMethod: '2', taxPayMonthCard: '' },
      cargoInfo: {
        name: (p.name || 'Goods').slice(0, 50),
        cargoNum: 1,
        gdesc: (p.name || 'general goods').slice(0, 100),
        hsCode: '42029290',
        price: 5,
        unit: 'g',
      },
      addServiceInfo: { serviceCodeList: ['EXPRESS'] },
      parcelInfo: {
        parcelWeight: weight,
        parcelLength: p.dims?.lengthCm ? Number(p.dims.lengthCm.toFixed(1)) : 20,
        parcelWidth: p.dims?.widthCm ? Number(p.dims.widthCm.toFixed(1)) : 12,
        parcelHeight: p.dims?.heightCm ? Number(p.dims.heightCm.toFixed(1)) : 3,
      },
    };
    return biz;
  }

  async quote(p) {
    if (!this.configured) {
      throw new CarrierError('顺丰国际未配置 appKey/appSecret/aesKey/customerCode', 'NOT_CONFIGURED');
    }
    const { actualKg, volumetricKg, chargedKg } = CarrierAdapter.chargedWeight(p.weightKg, p.dims);
    // interProductCode 支持逗号分隔多产品码并行询价（如 "INT0014,INT0263"）
    const codes = String(this.cfg.interProductCode || 'INT0263')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const settled = await Promise.allSettled(codes.map(async (code) => {
      const data = await this.callApi(this.msgType, this.buildFeeBiz({ ...p, interProductCode: code }));
      const d = data?.data;
      const totalFee = Number(d?.totalFee ?? d?.totalPayFee ?? 0);
      if (!d || totalFee <= 0) {
        throw new CarrierError(`顺丰国际 ${code} 无可报价`, 'NO_QUOTE', data);
      }
      const currency = String(d.currency || 'CNY').toUpperCase();
      let priceUsd;
      if (currency === 'USD') priceUsd = totalFee;
      else if (currency === 'CNY') priceUsd = cnyToCurrency(totalFee, 'USD');
      else {
        throw new CarrierError(`顺丰国际返回币种 ${currency} 暂不支持换算`, 'NO_QUOTE', data);
      }
      // 产品名只保留产品码（如 INT0014），费用明细为服务端中文描述，拼入名称会在非中文界面造成混排
      return this.normalize({
        carrier: this.cfg.code,
        carrierName: this.cfg.name,
        productName: d.interProductCode || code,
        priceUsd: Number((priceUsd * (1 + (this.cfg.markupRate || 0))).toFixed(2)),
        currency: 'USD',
        daysMin: this.cfg.daysMin ?? 6,
        daysMax: this.cfg.daysMax ?? 12,
        source: 'api',
        available: true,
        chargedKg,
        actualKg,
        volumetricKg,
        raw: d,
      }, {});
    }));
    const quotes = settled
      .filter((s) => s.status === 'fulfilled' && s.value)
      .map((s) => s.value);
    if (quotes.length === 0) {
      const firstErr = settled.find((s) => s.status === 'rejected')?.reason;
      if (firstErr) throw firstErr;
      throw new CarrierError('顺丰国际无可报价', 'NO_QUOTE');
    }
    return quotes;
  }

  async test() {
    if (!this.configured) {
      const missing = [
        !this.appKey && 'appKey',
        !this.appSecret && 'appSecret',
        !this.aesKey && 'aesKey',
        !this.customerCode && 'customerCode',
      ].filter(Boolean).join(' / ');
      return { ok: false, message: `缺少 ${missing}`, source: 'api' };
    }
    const t0 = Date.now();
    try {
      const data = await this.callApi(this.msgType, this.buildFeeBiz({ country: 'US', weightKg: 0.5, name: 'test goods' }));
      const totalFee = data?.data?.totalFee;
      const currency = data?.data?.currency;
      return {
        ok: true,
        message: totalFee > 0
          ? `报价链路打通：0.5kg CN->US = ${totalFee} ${currency}`
          : `接口连通但无报价（feeInfoList 空，检查 interProductCode）`,
        latencyMs: Date.now() - t0,
        source: 'api',
      };
    } catch (e) {
      if (e instanceof CarrierError) return { ok: false, message: e.message, latencyMs: Date.now() - t0, source: 'api' };
      const cause = e.cause?.code || e.cause?.message || '';
      const msg = e.message === 'fetch failed' && cause
        ? `网络不可达（${cause}）——检查服务器能否访问 ${this.baseUrl}`
        : e.message;
      return { ok: false, message: msg, latencyMs: Date.now() - t0, source: 'api' };
    }
  }

  // IECS_CREATE_ORDER 创建电商订单（下单取号）
  // p: { orderNo, items:[{name,cName,unit,amount,currency,quantity,weightKg,hsCode,url}],
  //      totalWeightKg, declaredValue, declaredCurrency, interProductCode,
  //      receiver:{company,contact,country,postCode,regionFirst,regionSecond,regionThird,address,email,telNo,phoneNo},
  //      sender:{company,contact,country,postCode,regionFirst,regionSecond,regionThird,address,telNo,phoneNo,email} }
  buildOrderBiz(p) {
    const sender = p.sender || {};
    const receiver = p.receiver || {};
    const items = Array.isArray(p.items) && p.items.length ? p.items : [];
    if (!p.orderNo) throw new CarrierError('顺丰下单缺少订单号', 'INVALID_INPUT');
    if (!receiver.country || !receiver.address || !receiver.contact) throw new CarrierError('顺丰下单缺少收件人信息', 'INVALID_INPUT');
    if (!items.length) throw new CarrierError('顺丰下单缺少商品明细', 'INVALID_INPUT');
    const biz = {
      apiUsername: this.cfg.apiUsername || this.customerCode,
      customerOrderNo: String(p.orderNo),
      platformOrderId: String(p.orderNo),
      platformCode: 'CrossBuy',
      erpCode: '0000',
      interProductCode: p.interProductCode || String(this.cfg.interProductCode || 'INT0014').split(',')[0].trim(),
      parcelQuantity: 1,
      parcelTotalWeight: Number(Number(p.totalWeightKg || 0).toFixed(3)),
      declaredValue: Number(Number(p.declaredValue || 0).toFixed(2)),
      declaredCurrency: p.declaredCurrency || 'USD',
      isBat: p.isBat ? 1 : 0,
      createOrderType: '1',
      senderInfo: {
        company: sender.company || sender.contact || 'CrossBuy',
        contact: sender.contact || 'CrossBuy',
        country: sender.country || 'CN',
        postCode: sender.postCode || '518000',
        regionFirst: sender.regionFirst || 'Guangdong',
        regionSecond: sender.regionSecond || 'Shenzhen',
        regionThird: sender.regionThird || '',
        address: sender.address || '',
        telNo: sender.telNo || sender.phoneNo || '',
        phoneNo: sender.phoneNo || sender.telNo || '',
        email: sender.email || '',
      },
      receiverInfo: {
        company: receiver.company || receiver.contact || '',
        contact: receiver.contact || '',
        country: receiver.country,
        postCode: receiver.postCode || '',
        regionFirst: receiver.regionFirst || '',
        regionSecond: receiver.regionSecond || '',
        regionThird: receiver.regionThird || '',
        address: receiver.address,
        email: receiver.email || '',
        telNo: receiver.telNo || receiver.phoneNo || '',
        phoneNo: receiver.phoneNo || receiver.telNo || '',
      },
      parcelInfoList: items.map((it) => ({
        name: String(it.name || 'Goods').slice(0, 30),
        cName: String(it.cName || it.name || '商品').slice(0, 30),
        unit: it.unit || 'piece',
        amount: Number(Number(it.amount || 0).toFixed(2)),
        currency: it.currency || 'USD',
        quantity: Number(it.quantity || 1),
        weight: Number(Number(it.weightKg || 0).toFixed(3)),
        hsCode: it.hsCode || '42029290',
        originCountry: it.originCountry || 'CN',
        goodsUrl: it.url ? String(it.url).slice(0, 2000) : undefined,
      })),
    };
    if (!biz.senderInfo.address) throw new CarrierError('顺丰下单缺少寄件地址（后台配置顺丰寄件信息）', 'NOT_CONFIGURED');
    if (!biz.parcelTotalWeight) throw new CarrierError('顺丰下单缺少包裹重量', 'INVALID_INPUT');
    return biz;
  }

  async createOrder(p) {
    if (!this.configured) {
      throw new CarrierError('顺丰国际未配置 appKey/appSecret/aesKey/customerCode', 'NOT_CONFIGURED');
    }
    const data = await this.callApi('IECS_CREATE_ORDER', this.buildOrderBiz(p));
    if (data && data.success === false) {
      throw new CarrierError(`顺丰下单失败: ${data.msg || '未知'}（code=${data.code}）`, 'API_ERROR', data);
    }
    const d = data?.data || {};
    if (!d.sfWaybillNo) {
      throw new CarrierError('顺丰下单未返回运单号', 'NO_QUOTE', data);
    }
    return {
      customerOrderNo: d.customerOrderNo || p.orderNo,
      sfWaybillNo: d.sfWaybillNo,
      agentWaybillNo: d.agentWaybillNo || '',
      agentCode: d.agentCode || '',
      directionCode: d.directionCode || '',
      agentLabelBase64: d.agentLabelBase64 || '',
    };
  }
}
