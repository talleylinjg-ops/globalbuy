import { Router } from 'express';
import { searchAndCompare } from '../services/searchService.js';
import { getRates } from '../services/currency.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';
import { getTaxRule, TAX_RULES } from '../data/tax.js';
import { getShippingRates } from '../data/shipping.js';
import { platformList } from '../platforms/index.js';
import { listMockCategories, HOT_KEYWORDS } from '../data/mockProducts.js';
import linkRouter from './link.js';
import imgRouter from './img.js';
import adminRouter from './admin.js';
import carriersRouter from './carriers.js';
import carrierQuoteRouter from './carrierQuote.js';
import { computeCombinedQuote } from '../services/combine.js';
import { createRecord, genId, genOrderNo, listCollection } from '../services/db.js';

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

// 多商品合并包裹统一计价：统一运费 + 统一关税/增值税
router.post('/combine', async (req, res, next) => {
  try {
    const { itemIds, country, currency, profitRate, carrier } = req.body || {};
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'missing itemIds' });
    }
    if (itemIds.length > 20) {
      return res.status(400).json({ error: 'too many items (max 20)' });
    }
    const result = await computeCombinedQuote({
      itemIds,
      country: (country || 'US').toUpperCase(),
      currency: (currency || 'USD').toUpperCase(),
      profitRate: profitRate !== undefined ? profitRate / 100 : undefined,
      carrier: carrier || undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 游客下单：商品 + 数量 + 收货信息 -> 统一计价 -> 订单入库（MySQL）
router.post('/orders', async (req, res, next) => {
  try {
    const { items, contact, address, country, currency, carrier } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'missing items' });
    }
    const name = String(contact?.name || '').trim();
    const email = String(contact?.email || '').trim();
    const line1 = String(address?.line1 || '').trim();
    const city = String(address?.city || '').trim();
    if (!name || !email || !line1 || !city) {
      return res.status(400).json({ error: 'contact name, email, address line1 and city are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid email' });
    }

    const destCountry = String(address?.country || country || 'US').toUpperCase();
    const destCurrency = String(currency || 'USD').toUpperCase();

    const quote = await computeCombinedQuote({
      items: items.map((i) => ({ itemId: String(i.itemId || ''), quantity: Number(i.quantity) || 1 })),
      country: destCountry,
      currency: destCurrency,
      carrier: carrier || undefined,
    });
    const b = quote.breakdown;

    // WooCommerce 行为：结账自动创建/复用客户 + 收货地址
    let customer = listCollection('customers').find(
      (c) => (c.email || '').toLowerCase() === email.toLowerCase()
    );
    if (!customer) {
      customer = createRecord('customers', {
        name,
        email,
        phone: String(contact?.phone || '').trim(),
        country: destCountry,
        currency: destCurrency,
        status: 'active',
        notes: 'Created from storefront checkout',
        registeredAt: new Date().toISOString(),
      });
    }
    const addressRecord = createRecord('addresses', {
      customerId: customer.id,
      label: 'Default',
      recipient: name,
      line1,
      line2: String(address?.line2 || '').trim(),
      city,
      state: String(address?.state || '').trim(),
      postal: String(address?.postal || '').trim(),
      country: destCountry,
      phone: String(contact?.phone || '').trim(),
      isDefault: true,
    });

    const order = createRecord('orders', {
      customerId: customer.id,
      addressId: addressRecord.id,
      status: 'pending',
      items: quote.perItem.map((it) => ({
        itemId: it.itemId,
        title: it.title,
        platform: it.platform,
        quantity: it.quantity,
        priceCny: it.price,
        currency: destCurrency,
      })),
      subtotalCny: b.goodsValueCny,
      shippingCny: b.intlShippingCny,
      dutyCny: b.dutyCny,
      vatCny: b.vatCny,
      serviceFeeCny: Number((b.goodsValueCny * 0.05).toFixed(2)),
      paymentFeeCny: Number((b.goodsValueCny * 0.03).toFixed(2)),
      profitCny: Number((b.totalCny - b.goodsValueCny - b.intlShippingCny - b.dutyCny - b.vatCny
        - b.goodsValueCny * 0.05 - b.goodsValueCny * 0.03).toFixed(2)),
      totalCny: b.totalCny,
      totalCurrency: b.total,
      currency: destCurrency,
      carrier: quote.carrier,
      daysMin: quote.daysMin,
      daysMax: quote.daysMax,
      trackingNo: '',
      contact: { name, email, phone: String(contact?.phone || '').trim() },
      address: {
        line1,
        line2: String(address?.line2 || '').trim(),
        city,
        state: String(address?.state || '').trim(),
        postal: String(address?.postal || '').trim(),
        country: destCountry,
      },
      notes: '',
      source: 'storefront',
    });

    res.json({
      ok: true,
      orderNo: order.orderNo,
      id: order.id,
      customerId: customer.id,
      total: b.total,
      currency: destCurrency,
      carrier: quote.carrier,
      daysMin: quote.daysMin,
      daysMax: quote.daysMax,
      breakdown: b,
      taxNote: quote.taxNote,
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
    categories: listMockCategories(),
    hotKeywords: HOT_KEYWORDS,
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

// 演示分类与热门搜索词
router.get('/categories', (req, res) => {
  res.json({ categories: listMockCategories(), hotKeywords: HOT_KEYWORDS });
});

export default router;
