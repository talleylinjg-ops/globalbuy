import { Router } from 'express';
import { MOCK_PRODUCTS } from '../data/mockProducts.js';

const router = Router();

// 解析主流电商商品链接，提取平台与商品 ID
// 支持：淘宝/天猫 item.taobao.com / detail.tmall.com、京东 item.jd.com、拼多多 mobile.yangkeduo.com / pinduoduo.com、1688 detail.1688.com
function parseItemLink(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;
    let platform = null;
    let itemId = null;

    if (host.endsWith('taobao.com') || host.endsWith('tmall.com') || host === 'detail.tmall.com') {
      platform = 'taobao';
      // /item.htm?id=xxx 或 /item/xxx.htm 或 /i{id}.htm
      const idParam = u.searchParams.get('id');
      const m = path.match(/\/(i|item)\/(\d+)\.htm/) || path.match(/\/(\d{8,})\.htm/);
      itemId = idParam || (m && m[2]) || (m && m[1]) || null;
    } else if (host.endsWith('jd.com')) {
      platform = 'jd';
      // /{id}.html 或 item.jd.com/{id}.html
      const m = path.match(/\/(\d{4,})\.html/);
      itemId = (m && m[1]) || null;
    } else if (host.includes('pinduoduo.com') || host.includes('yangkeduo.com')) {
      platform = 'pdd';
      const m = path.match(/goods_id=(\d+)/) || path.match(/goods\/(\d+)/) || path.match(/\/(\d{6,})\.html/);
      const idParam = u.searchParams.get('goods_id');
      itemId = idParam || (m && m[1]) || null;
    } else if (host.endsWith('1688.com')) {
      platform = '1688';
      // /offer/{id}.html
      const m = path.match(/\/offer\/(\d+)\.html/) || path.match(/(\d{8,})\.html/);
      itemId = (m && m[1]) || null;
    }

    return { platform, itemId, host };
  } catch {
    return { platform: null, itemId: null, host: null };
  }
}

// 根据平台+商品ID 在 mock 数据中反查商品（演示；真实场景调用平台详情 API）
function findMockByItem(platform, itemId) {
  if (!platform || !itemId) return null;
  const candidates = MOCK_PRODUCTS.filter((p) => {
    const pPlatform = p.platform === 'tmall' ? 'taobao' : p.platform;
    return pPlatform === platform && String(p.itemId).includes(itemId);
  });
  if (candidates.length) return candidates[0];
  // 放宽匹配：只按平台匹配第一个
  const byPlatform = MOCK_PRODUCTS.filter((p) => (p.platform === 'tmall' ? 'taobao' : p.platform) === platform);
  return byPlatform[0] || null;
}

router.get('/parse-link', (req, res) => {
  const raw = (req.query.url || '').trim();
  if (!raw) return res.status(400).json({ error: 'missing url' });

  const { platform, itemId, host } = parseItemLink(raw);
  if (!platform || !itemId) {
    return res.json({ ok: false, platform, itemId, error: '无法识别的商品链接' });
  }

  const mock = findMockByItem(platform, itemId);
  res.json({
    ok: true,
    platform,
    itemId,
    host,
    product: mock
      ? {
          itemId: mock.itemId,
          title: mock.title,
          titleEn: mock.title,
          price: mock.price,
          imageUrl: mock.imageUrl,
          shopName: mock.shopName,
          platform: mock.platform,
        }
      : null,
  });
});

export default router;
