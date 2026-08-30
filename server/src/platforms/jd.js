import { PlatformAdapter } from './base.js';
import { mockSearch } from '../data/mockProducts.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';

// ============ 京东联盟（union.jd.com）============
// 需要：AppKey/AppSecret + UnionId
// 相关 API: jd.union.open.goods.query（联盟商品查询/搜索）
export class JdAdapter extends PlatformAdapter {
  constructor(config) {
    super('jd', config);
    this.apiBase = 'https://api.jd.com/routerjson';
  }

  async search(rawKeyword, opts = {}) {
    const keyword = isMostlyAscii(rawKeyword) ? translateKeywordToChinese(rawKeyword) : rawKeyword;
    if (!this.isConfigured()) {
      const items = mockSearch(keyword).filter((p) => p.platform === 'jd');
      return {
        sourceType: 'mock',
        platform: 'jd',
        keyword,
        items: items.map((p) => ({ ...p, adapter: 'jd' })),
      };
    }
    return this._searchApi(keyword);
  }

  async _searchApi(keyword) {
    // 真实实现：jd.union.open.goods.query
    // 需实现 md5 签名。骨架示例：
    const body = {
      goodsReqDTO: {
        keyword,
        pageIndex: 1,
        pageSize: 20,
      },
    };
    // const sign = buildJdSign(body, this.config.appSecret);
    // const res = await fetch(`${this.apiBase}?method=jd.union.open.goods.query&app_key=${appKey}&sign=${sign}&timestamp=...&param_json=${encodeURIComponent(JSON.stringify(body))}`)
    throw new Error('京东联盟 API 需要配置有效密钥并实现签名逻辑');
  }
}
