import { PlatformAdapter } from './base.js';
import { mockSearch } from '../data/mockProducts.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';

// ============ 1688 分销客（open.1688.com / alimama 跨境）============
// 需要：AppKey/AppSecret
// 相关 API: com.alibaba.fenxiao.crossborder.products.search（跨境商品搜索）
export class Ali1688Adapter extends PlatformAdapter {
  constructor(config) {
    super('1688', config);
    this.apiBase = 'https://gw.open.1688.com/openapi/param2/1/com.alibaba.fenxiao.crossborder/products/search';
  }

  async search(rawKeyword, opts = {}) {
    const keyword = isMostlyAscii(rawKeyword) ? translateKeywordToChinese(rawKeyword) : rawKeyword;
    if (!this.isConfigured()) {
      const items = mockSearch(keyword).filter((p) => p.platform === '1688');
      return {
        sourceType: 'mock',
        platform: '1688',
        keyword,
        items: items.map((p) => ({ ...p, adapter: '1688' })),
      };
    }
    return this._searchApi(keyword);
  }

  async _searchApi(keyword) {
    // 真实实现：com.alibaba.fenxiao.crossborder.products.search
    // 需实现 param2 签名（HMAC-SHA256）。骨架示例：
    const params = {
      appKey: this.config.appKey,
      keyword,
      pageSize: 20,
      // ...
    };
    // const sign = build1688Sign(params, this.config.appSecret);
    // const res = await fetch(`${this.apiBase}?${qs(params)}&_aop_signature=${sign}`)
    throw new Error('1688 分销客 API 需要配置有效密钥并实现签名逻辑');
  }
}
