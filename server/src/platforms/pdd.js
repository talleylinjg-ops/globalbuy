import crypto from 'crypto';
import { PlatformAdapter } from './base.js';
import { mockSearch } from '../data/mockProducts.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';
import { httpRequest } from '../carriers/http.js';
import { getPddToken } from '../routes/pddauth.js';

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
      throw new Error(`拼多多 API ${err.sub_msg || err.error_msg || '错误'}（${err.error_code}）`);
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
    return this._searchApi(keyword, opts);
  }

  async _searchApi(keyword, opts = {}) {
    const page = Math.max(1, Number(opts.page) || 1);
    // 携带推广位（多多客 ID / PID），返回结果含佣金与推广链接所需字段
    // pid 格式为「数字_数字」，残缺值同样视为未配置
    const pid = /^\d+_\d+$/.test(String(this.config.pid || '')) ? this.config.pid : '';
    if (!pid) {
      // 未配置推广位时 ddk.goods.search 会报 60001（要求 pid 备案），
      // 回退推荐池（免 pid 已验证）：返回拼多多真实热门商品，保证真实数据源可用
      return this._recommendApi(keyword, page);
    }
    // search 接口要求「pid + custom_parameters」与绑定备案时一致，缺一即报 60001
    const token = await getPddToken().catch(() => null);
    try {
      const data = await this.callApi('pdd.ddk.goods.search', {
        keyword,
        page,
        page_size: 20,
        sort_type: 0,
        pid,
        custom_parameters: JSON.stringify({ uid: 'crossbuy' }),
        ...(token ? { access_token: token.accessToken } : {}),
      });
      const list = data?.goods_search_response?.goods_list || [];
      const items = list.map((g) => this.mapGoods(g)).filter((g) => g.price > 0);
      return { sourceType: 'api', platform: 'pdd', keyword, items };
    } catch (e) {
      // 未授权备案（60001）时回退推荐池，保持真实数据源不断供
      if (String(e.message).includes('60001') || String(e.message).includes('备案')) {
        return this._recommendApi(keyword, page);
      }
      throw e;
    }
  }

  async _recommendApi(keyword, page) {
    const data = await this.callApi('pdd.ddk.goods.recommend.get', {
      channel_type: 0,
      page,
      page_size: 20,
    });
    const list = data?.goods_basic_detail_response?.list || [];
    const items = list.map((g) => this.mapGoods(g)).filter((g) => g.price > 0);
    return { sourceType: 'api', platform: 'pdd', keyword, items, recommendPool: true };
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

  // 商品详情 + 图集/描述 + SKU（若有）
  // DDK pdd.ddk.goods.detail 请求参数为 goods_sign 单值；CPS 响应不含 skus（SKU 属商家内部数据，
  // 仅 OEM/商家授权接口可见），故真实商品返回 skus:[]，买家以「规格备注」自由填写颜色/尺码等
  async detail(itemId) {
    const goodsSign = String(itemId).replace(/^pdd_/, '');
    if (!goodsSign) throw new Error('invalid pdd itemId');
    if (!this.isConfigured()) {
      const mock = mockSearch('').find((p) => p.itemId === itemId);
      if (!mock) throw new Error('item not found');
      return {
        platform: 'pdd',
        itemId,
        title: mock.title,
        imageUrl: mock.imageUrl,
        price: mock.price,
        originalPrice: mock.originalPrice,
        gallery: [mock.imageUrl],
        description: '',
        skus: [{ skuId: 'default', spec: '', price: mock.price, thumbUrl: mock.imageUrl, stock: 999 }],
      };
    }
    const data = await this.callApi('pdd.ddk.goods.detail', { goods_sign: goodsSign });
    const g = data?.goods_detail_response?.goods_details?.[0];
    if (!g) throw new Error('pdd detail: goods not found');
    const base = this.mapGoods(g);
    const skus = (g.skus || [])
      .map((s) => {
        const groupFen = Number(s.min_group_price ?? 0);
        const price = groupFen / 100;
        return {
          skuId: String(s.sku_id ?? ''),
          spec: String(s.spec ?? ''),
          price,
          thumbUrl: s.thumb_url || base.imageUrl,
          stock: Number(s.stock ?? 0),
        };
      })
      .filter((s) => s.skuId && s.price > 0);
    return {
      platform: 'pdd',
      itemId,
      title: base.title,
      imageUrl: base.imageUrl,
      price: base.price,
      originalPrice: base.originalPrice,
      sales: base.sales,
      shopName: base.shopName,
      gallery: Array.isArray(g.goods_gallery_urls) ? g.goods_gallery_urls.slice(0, 8) : [],
      description: String(g.goods_desc || g.desc_txt || ''),
      // 全部 SKU 的最低价作为起价；无 SKU 数据时回退主价
      skus: skus.length > 0 ? skus : [],
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
