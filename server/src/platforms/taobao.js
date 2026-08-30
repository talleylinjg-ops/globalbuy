import { PlatformAdapter } from './base.js';
import { mockSearch } from '../data/mockProducts.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';

// ============ 淘宝/天猫联盟（阿里妈妈 open.taobao.com）============
// 需要：AppKey/AppSecret + AdzoneId（推广位）
// 相关 API: taobao.tbk.dg.material.optional（搜索物料，联盟商品搜索）
export class TaobaoAdapter extends PlatformAdapter {
  constructor(config) {
    super('taobao', config);
    this.apiBase = 'https://eco.taobao.com/router/rest';
  }

  async search(rawKeyword, opts = {}) {
    const keyword = isMostlyAscii(rawKeyword) ? translateKeywordToChinese(rawKeyword) : rawKeyword;
    if (!this.isConfigured()) {
      const items = mockSearch(keyword).filter((p) => p.platform === 'taobao' || p.platform === 'tmall');
      return {
        sourceType: 'mock',
        platform: 'taobao',
        keyword,
        items: items.map((p) => ({ ...p, adapter: 'taobao' })),
      };
    }
    return this._searchApi(keyword);
  }

  async _searchApi(keyword) {
    // 真实实现：签名请求 taobao.tbk.dg.material.optional
    // 需实现 top 签名（HMAC-MD5）。此处给出请求骨架，由配置密钥后启用。
    const params = {
      method: 'taobao.tbk.dg.material.optional',
      app_key: this.config.appKey,
      adzone_id: this.config.adzoneId,
      q: keyword,
      page_size: 20,
      // ...
    };
    // const sign = buildTopSign(params, this.config.appSecret);
    // const res = await fetch(`${this.apiBase}?${qs(params)}&sign=${sign}`)
    // 将返回字段映射为统一结构
    throw new Error('淘宝联盟 API 需要配置有效密钥并实现签名逻辑');
  }
}
