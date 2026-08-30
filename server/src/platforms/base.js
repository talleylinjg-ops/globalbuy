// 平台适配器基类
export class PlatformAdapter {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  isConfigured() {
    return Object.values(this.config).some((v) => typeof v === 'string' && v.length > 0);
  }

  // 搜索商品：子类实现
  async search(keyword, opts = {}) {
    throw new Error('search not implemented');
  }

  // 平台搜索接口是否走真实 API（未配置密钥则走 mock）
  get sourceType() {
    return this.isConfigured() ? 'api' : 'mock';
  }
}
