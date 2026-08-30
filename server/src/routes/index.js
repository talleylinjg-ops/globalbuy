import { Router } from 'express';
import { searchAndCompare } from '../services/searchService.js';
import { getRates } from '../services/currency.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';
import { getTaxRule, TAX_RULES } from '../data/tax.js';
import { getShippingRates } from '../data/shipping.js';
import { platformList } from '../platforms/index.js';
import { listMockCategories } from '../data/mockProducts.js';
import linkRouter from './link.js';
import imgRouter from './img.js';
import adminRouter from './admin.js';
import carriersRouter from './carriers.js';
import carrierQuoteRouter from './carrierQuote.js';

const router = Router();

router.use('/link', linkRouter);
router.use('/', imgRouter);
router.use('/admin', adminRouter);
router.use('/admin/carriers', carriersRouter);
router.use('/carriers', carrierQuoteRouter);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// 主搜索接口：/api/search?q=wireless+earbuds&country=US&currency=USD&platforms=taobao,jd
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'missing q' });

    const opts = {
      destCountry: (req.query.country || 'US').toUpperCase(),
      currency: (req.query.currency || 'USD').toUpperCase(),
      profitRate: req.query.profitRate !== undefined ? parseFloat(req.query.profitRate) : undefined,
      platforms: req.query.platforms ? String(req.query.platforms).split(',') : [],
      carrier: req.query.carrier || undefined,
    };

    const translatedKeyword = isMostlyAscii(q) ? translateKeywordToChinese(q) : q;

    const result = await searchAndCompare(q, { ...opts, translatedKeyword });
    res.json({
      ...result,
      inputKeyword: q,
      translatedKeyword,
    });
  } catch (err) {
    next(err);
  }
});

// 元数据：支持的目的国、币种、平台状态
router.get('/meta', (req, res) => {
  res.json({
    platforms: platformList(),
    countries: Object.keys(TAX_RULES).map((code) => ({
      code,
      name: TAX_RULES[code].name,
      currency: TAX_RULES[code].currency,
    })),
    rates: getRates(),
    weights: { price: 0.4, reputation: 0.25, sales: 0.15, speed: 0.1, commission: 0.1 },
  });
});

// 汇率
router.get('/rates', (req, res) => {
  res.json({ rates: getRates(), updatedAt: null });
});

// 目的国税则查询：/api/tax/US
router.get('/tax/:country', (req, res) => {
  const country = req.params.country.toUpperCase();
  const rule = getTaxRule(country);
  res.json({ country, ...rule, shipping: getShippingRates(country) });
});

// 演示分类
router.get('/categories', (req, res) => {
  res.json({ categories: listMockCategories() });
});

export default router;
