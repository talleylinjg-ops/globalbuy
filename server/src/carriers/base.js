// 国际快递适配器基类
// 所有适配器统一实现 quote() 与 test()，返回标准化报价结构
export class CarrierAdapter {
  constructor(cfg = {}) {
    this.cfg = cfg; // { id, name, code, apiKey, apiSecret, baseUrl, account, enabled, markupRate, ... }
  }

  // 是否已配置真实凭据（未配置时调用方回退到估算/mock）
  get configured() {
    return !!(this.cfg.apiKey || this.cfg.appKey);
  }

  /**
   * 报价
   * @param {object} p
   * @param {string} p.country 目的国 ISO alpha-2
   * @param {number} p.weightKg 实际重量
   * @param {object} p.dims { lengthCm, widthCm, heightCm }
   * @param {number} p.valueUsd 申报货值 USD
   * @param {string} [p.currency] 期望报价币种
   * @returns {Promise<object>} 标准化报价
   */
  async quote(p) {
    throw new Error('quote() not implemented');
  }

  // 测试连接，返回 { ok, message, latencyMs }
  async test() {
    return { ok: false, message: 'not implemented' };
  }

  // 子类可覆写：把各家原始响应归一化
  normalize(partial, base) {
    return { ...base, ...partial };
  }

  // 体积重（长cm*宽cm*高cm/6000），取较大者作为计费重
  static chargedWeight(weightKg, dims = {}) {
    const { lengthCm = 0, widthCm = 0, heightCm = 0 } = dims;
    const volKg = (lengthCm * widthCm * heightCm) / 6000;
    return {
      actualKg: weightKg,
      volumetricKg: Number(volKg.toFixed(3)),
      chargedKg: Number(Math.max(weightKg, volKg).toFixed(3)),
    };
  }
}

// 统一错误：供应商 API 调用失败时抛出，供服务层捕获
export class CarrierError extends Error {
  constructor(message, code = 'CARRIER_ERROR', detail) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}
