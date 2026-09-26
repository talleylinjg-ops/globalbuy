import crypto from 'crypto';
import { PlatformAdapter } from './base.js';
import { mockSearch } from '../data/mockProducts.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';
import { httpRequest } from '../carriers/http.js';

// ============ 拼多多开放平台（多多进宝 DDK）============
// 网关 https://gw-api.pinduoduo.com/api/router，form 表单提交
// 签名：除 sign 外所有参数按参数名升序拼接 k+v，首尾包 client_secret，MD5 转 32 位大写
// 价格单位为「分」；pdd.ddk.goods.search 返回 goods_search_response.goods_list
// 依赖：应用需开通「多多进宝」权限（开放平台 client_id + client_secret）
export class PddAdapter extends PlatformAdapter {
  constructor(config) {
    super('pdd', config);
    this.apiBase = 'https://gw-api.pinduoduo.com/api/router';
  }

  isConfigured() {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  buildSign(params) {
    const joined = Object.keys(params)
      .sort()
      .map((k) => k + String(params[k]))
      .join('');
    return crypto
      .createHash('md5')
      .update(this.config.clientSecret + joined + this.config.clientSecret, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  async callApi(type, biz = {}) {
    const params = {
      type,
      client_id: this.config.clientId,
      version: 'V2.0',
      timestamp: Math.floor(Date.now() / 1000),
      data_type: 'JSON',
      ...biz,
    };
    params.sign = this.buildSign(params);
    const data = await httpRequest(this.apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      timeout: 30000,
    });
    if (data && data.error_response) {
      const err = data.error_response;
      throw new Error(`拼多多 API ${err.error_msg || '错误'}（${err.error_code}）`);
    }
    if (!data || typeof data !== 'object') {
      throw new Error(`拼多多网关响应异常: ${String(data).slice(0, 120)}`);
    }
    return data;
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
    const page = Math.max(1, Number(opts.page) || 1);
    const data = await this.callApi('pdd.ddk.goods.search', {
      keyword,
      page,
      page_size: 20,
      sort_type: 0,
    });
    const list = data?.goods_search_response?.goods_list || [];
    const items = list.map((g) => this.mapGoods(g)).filter((g) => g.price > 0);
    return { sourceType: 'api', platform: 'pdd', keyword, items };
  }

  mapGoods(g) {
    const groupFen = Number(g.min_group_price ?? 0);
    const normalFen = Number(g.min_normal_price ?? groupFen);
    // 拼团价为主售价；单买价更贵，作为原价展示
    const price = groupFen / 100 || normalFen / 100;
    const originalPrice = normalFen / 100 > price ? normalFen / 100 : price;
    const mallName = g.mall_name || '';
    // commission_rate 为千分比（如 50 = 5%）
    const commissionRate = Number(g.commission_rate ?? 0) / 1000;
    return {
      platform: 'pdd',
      itemId: `pdd_${g.goods_sign ?? g.id ?? g.goods_id ?? ''}`,
      imageUrl: g.goods_thumbnail_url || g.goods_image_url || '',
      title: g.goods_name || '',
      price,
      originalPrice,
      sales: parseSalesTip(g.sales_tip),
      rating: 96.5,
      reviews: 0,
      shopName: mallName,
      shopType: mallName.includes('旗舰') ? '旗舰店' : '普通',
      commissionRate,
      weightGrams: 500,
      rawCoupon: g.coupon_min_order_amount ? Number(g.coupon_min_order_amount) / 100 : 0,
    };
  }
}

// sales_tip 形如「已拼2.3万+件」，提取为数值
function parseSalesTip(tip) {
  if (!tip) return 0;
  const m = String(tip).match(/([\d.]+)\s*万/);
  if (m) return Math.round(parseFloat(m[1]) * 10000);
  const n = String(tip).match(/(\d+)/);
  return n ? Number(n[1]) : 0;
}
