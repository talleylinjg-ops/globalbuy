import { PlatformAdapter } from './base.js';
import { mockSearch } from '../data/mockProducts.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';

// ============ 拼多多多多客（jinbao.pinduoduo.com）============
// 需要：ClientId/ClientSecret + PID
// 相关 API: pdd.ddk.goods.search（多多进宝商品搜索）
export class PddAdapter extends PlatformAdapter {
  constructor(config) {
    super('pdd', config);
    this.apiBase = 'https://gw-api.pinduoduo.com/api/router';
  }

  async search(rawKeyword, opts = {}) {
    const keyword = isMostlyAscii(rawKeyword) ? translateKeywordToChinese(rawKeyword) : rawKeyword;
    if (!this.isConfigured()) {
      const items = mockSearch(keyword).filter((p) => p.platform === 'pdd');
      return {
        sourceType: 'mock',
        platform: 'pdd',
        keyword,
        items: items.map((p) => ({ ...p, adapter: 'pdd' })),
      };
    }
    return this._searchApi(keyword);
  }

  async _searchApi(keyword) {
    // 真实实现：pdd.ddk.goods.search
    // 需实现 sign（MD5 排序参数 + 拼接 client_secret）。骨架示例：
    const payload = {
      type: 'pdd.ddk.goods.search',
      client_id: this.config.clientId,
      keyword,
      page: 1,
      page_size: 20,
    };
    // const sign = buildPddSign(payload, this.config.clientSecret);
    // payload.sign = sign;
    // const res = await fetch(this.apiBase, { method: 'POST', body: new URLSearchParams(payload) })
    throw new Error('拼多多多多客 API 需要配置有效密钥并实现签名逻辑');
  }
}
