import { Router } from 'express';
import { searchAndCompare } from '../services/searchService.js';
import { getRates } from '../services/currency.js';
import { isMostlyAscii, translateKeywordToChinese } from '../services/translate.js';
import { getTaxRule, TAX_RULES, CONTINENT_GROUPS, GLOBAL_COUNTRIES, GLOBAL_CURRENCIES } from '../data/tax.js';
import { getShippingRates } from '../data/shipping.js';
import { platformList } from '../platforms/index.js';
import { listMockCategories, HOT_KEYWORDS } from '../data/mockProducts.js';
import linkRouter from './link.js';
import imgRouter from './img.js';
import adminRouter from './admin.js';
import carriersRouter from './carriers.js';
import carrierQuoteRouter from './carrierQuote.js';
import pddAuthRouter from './pddauth.js';
import customerAuthRouter from './customerauth.js';
import { computeCombinedQuote } from '../services/combine.js';
import { resolveCustomerSession } from '../services/customerAuth.js';
import { createRecord, genId, genOrderNo, listCollection, getById } from '../services/db.js';

const router = Router();

router.use('/link', linkRouter);
router.use('/', imgRouter);
router.use('/admin', adminRouter);
router.use('/admin/carriers', carriersRouter);
router.use('/carriers', carrierQuoteRouter);
router.use('/pdd', pddAuthRouter);
router.use('/auth', customerAuthRouter);

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
      // 服务费由买家自选（默认 5%），利润为固定定价加成不走参数
      serviceFeeRate: req.query.serviceFeeRate !== undefined
        ? Math.min(Math.max(parseFloat(req.query.serviceFeeRate) || 0, 0), 0.3)
        : undefined,
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
    const { itemIds, country, currency, serviceFeeRate, carrier } = req.body || {};
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
      serviceFeeRate: serviceFeeRate !== undefined
        ? Math.min(Math.max(Number(serviceFeeRate) || 0, 0), 0.3)
        : undefined,
      carrier: carrier || undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 游客下单：商品 + 数量 + 收货信息 -> 统一计价 -> 订单入库（MySQL）
// 已登录会员下单：自动绑定会员账号；saveAddress=true 时收货地址存入地址簿
router.post('/orders', async (req, res, next) => {
  try {
    const { items, contact, address, country, currency, carrier, serviceFeeRate, saveAddress } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'missing items' });
    }
    // 可选会员会话：带有效 Bearer token 则订单归属当前会员
    let member = null;
    const authHeader = req.headers.authorization || '';
    const memberToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (memberToken) {
      member = resolveCustomerSession(memberToken);
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
      // 服务费由买家确定（0-30%，默认 5%），独立于利润加成
      serviceFeeRate: serviceFeeRate !== undefined
        ? Math.min(Math.max(Number(serviceFeeRate) || 0, 0), 0.3)
        : undefined,
    });
    const b = quote.breakdown;

    // WooCommerce 行为：结账自动创建/复用客户 + 收货地址
    // 会员下单：优先归属登录会员（邮箱不一致时以会员账号为准并回填联系人）
    let customer = null;
    if (member) {
      customer = getById('customers', member.customerId);
    } else {
      customer = listCollection('customers').find(
        (c) => (c.email || '').toLowerCase() === email.toLowerCase()
      );
    }
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
    // 会员 + saveAddress：复用会员地址簿（默认地址匹配则直接引用，避免重复堆积）
    let addressRecord = null;
    if (member && saveAddress) {
      const existing = (listCollection('addresses') || []).filter((a) => a.customerId === customer.id);
      const match = existing.find((a) =>
        String(a.line1 || '').toLowerCase() === line1.toLowerCase()
        && String(a.city || '').toLowerCase() === city.toLowerCase()
      );
      if (match) {
        addressRecord = match;
      } else {
        addressRecord = createRecord('addresses', {
          customerId: customer.id,
          label: String(address?.label || 'Home').trim(),
          recipient: name,
          line1,
          line2: String(address?.line2 || '').trim(),
          city,
          state: String(address?.state || '').trim(),
          postal: String(address?.postal || '').trim(),
          country: destCountry,
          phone: String(contact?.phone || '').trim(),
          isDefault: existing.length === 0,
        });
      }
    } else {
      addressRecord = createRecord('addresses', {
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
    }

    const order = createRecord('orders', {
      customerId: customer.id,
      addressId: addressRecord.id,
      status: 'pending',
      items: quote.perItem.map((it) => ({
        itemId: it.itemId,
        title: it.title,
        platform: it.platform,
        warehouse: it.warehouse,
        quantity: it.quantity,
        priceCny: it.price,
        currency: destCurrency,
      })),
      // 按发货仓拆单：预计包裹数与仓库清单（发货前按此分仓打包）
      warehouses: quote.warehouses,
      expectedParcels: quote.expectedParcels,
      subtotalCny: b.goodsValueCny,
      shippingCny: b.intlShippingCny,
      dutyCny: b.dutyCny,
      vatCny: b.vatCny,
      serviceFeeCny: b.serviceFeeCny,
      paymentFeeCny: b.paymentFeeCny,
      serviceFeeRate: b.serviceFeeRate,
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
      // 按发货仓拆单预告
      expectedParcels: quote.expectedParcels,
      warehouses: quote.warehouses,
    });
  } catch (err) {
    next(err);
  }
});

// 元数据：支持的目的国、币种、平台状态
router.get('/meta', (req, res) => {
  res.json({
    platforms: platformList(),
    countries: CONTINENT_GROUPS.flatMap((g) => g.codes.map((code) => ({
      code,
      continent: g.key,
      priority: g.key === 'priority',
      currency: GLOBAL_COUNTRIES[code].currency,
      name: TAX_RULES[code]?.name,
    }))),
    currencies: GLOBAL_CURRENCIES,
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

// 买家查单：orderNo + email 双因素校验（脱敏返回，支持一单多包裹）
router.get('/orders/track', (req, res) => {
  const orderNo = String(req.query.orderNo || '').trim().toUpperCase();
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!orderNo || !email) return res.status(400).json({ error: 'orderNo and email required' });
  const orders = listCollection('orders').filter((o) => String(o.orderNo || '').toUpperCase() === orderNo);
  if (orders.length === 0) return res.status(404).json({ error: 'order not found' });
  const o = orders[0];
  const orderEmail = String(o.contact?.email || o.customer?.email || '').toLowerCase();
  const customer = getById('customers', o.customerId);
  const custEmail = String(customer?.email || '').toLowerCase();
  if (!orderEmail && !custEmail) return res.status(403).json({ error: 'email mismatch' });
  if (email !== orderEmail && email !== custEmail) return res.status(403).json({ error: 'email mismatch' });

  // 一单多包裹：parcels 数组优先；旧单据回退单包裹字段
  const parcels = Array.isArray(o.parcels) && o.parcels.length > 0
    ? o.parcels
    : (o.trackingNo ? [{ trackingNo: o.trackingNo, carrier: o.carrier, productName: '', items: [] }] : []);
  const totalItems = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const packedItems = parcels.reduce((s, pc) => s + (pc.items || []).reduce((x, it) => x + (Number(it.quantity) || 0), 0), 0);
  const shipped = parcels.length > 0 && parcels.every((pc) => pc.trackingNo);
  res.json({
    orderNo: o.orderNo,
    status: shipped ? 'shipped' : o.status,
    createdAt: o.createdAt,
    currency: o.currency || 'USD',
    total: o.totalCurrency,
    items: (o.items || []).map((it) => ({ title: it.title, platform: it.platform, quantity: it.quantity })),
    parcels: parcels.map((pc) => ({
      trackingNo: pc.trackingNo || '',
      carrier: pc.carrier || o.carrier || '',
      productName: pc.productName || '',
      warehouse: pc.warehouse || '',
      items: (pc.items || []).map((it) => ({ title: it.title, quantity: it.quantity })),
    })),
    shipmentPreview: {
      expectedParcels: (o.expectedParcels) || null,
      warehouses: Array.isArray(o.warehouses) ? o.warehouses : [],
      packed: packedItems,
      totalItems,
    },
  });
});

export default router;
