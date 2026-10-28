import { Router } from 'express';
import { getRates } from '../services/currency.js';
import {
  listCollection, getById, createRecord, updateRecord, deleteRecord, getDb, saveDb,
} from '../services/db.js';
import {
  login, authMiddleware as auth, requireSuper, verifyPassword, changeOwnPassword, getProfile, updateProfile,
  listAdmins, createAdmin, updateAdmin, deleteAdmin,
} from '../services/auth.js';
import {
  safeCustomer, makeCredentials, adminResetCustomerPassword,
} from '../services/customerAuth.js';

const router = Router();

const normEmail = (e) => String(e || '').trim().toLowerCase();
const normUpper = (v) => String(v || '').trim().toUpperCase();
// 后台会员编辑保护：这些字段只能走凭据流程（注册/改密），直接写入会破坏前台登录
const CREDENTIAL_FIELDS = ['salt', 'passwordHash', 'registeredAt', 'token', 'id', 'createdAt', 'updatedAt'];
const stripCredentials = (body = {}) => {
  const patch = { ...body };
  for (const k of CREDENTIAL_FIELDS) delete patch[k];
  return patch;
};
function assertEmailAvailable(email, exceptId = null) {
  if (!email) return;
  const dup = (getDb().customers || []).find(
    (c) => c.id !== exceptId && String(c.email || '').trim().toLowerCase() === email
  );
  if (dup) throw Object.assign(new Error('email already registered'), { status: 409 });
}

// 登录（username + password；未传 username 兼容默认 admin 账号）
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = login(username, password);
  if (!result) return res.status(401).json({ error: 'invalid credentials' });
  res.json({ ok: true, ...result });
});

router.get('/me', auth, (req, res) => {
  res.json({ ok: true, username: req.admin.username, role: req.admin.role });
});

// ===== 管理员账号管理（仅 super）=====
router.get('/admins', auth, requireSuper, (req, res) => {
  res.json(listAdmins());
});

router.post('/admins', auth, requireSuper, (req, res) => {
  try {
    res.json(createAdmin(req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/admins/:id', auth, requireSuper, (req, res) => {
  try {
    res.json(updateAdmin(req.params.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/admins/:id', auth, requireSuper, (req, res) => {
  try {
    res.json(deleteAdmin(req.params.id, req.admin.username));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ===== 会员资料 =====
router.get('/profile', auth, (req, res) => {
  res.json(getProfile());
});

router.put('/profile', auth, (req, res) => {
  const { name, email } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  res.json(updateProfile({ name, email }));
});

// ===== 修改密码（登录用户改自己密码）=====
router.put('/password', auth, (req, res) => {
  const { currentPassword: cur, newPassword } = req.body || {};
  if (!cur || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
  const result = changeOwnPassword(req.admin.username, String(cur), String(newPassword));
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

// ===== 客户管理 =====
router.get('/customers', auth, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  let list = listCollection('customers');
  if (q) {
    list = list.filter((c) =>
      [c.name, c.email, c.phone, c.country].some((v) => v && String(v).toLowerCase().includes(q))
    );
  }
  // WooCommerce 风格统计：订单数 / 最近订单 / 累计消费 / 客单价（统一折 USD）
  const orders = listCollection('orders');
  const rates = getRates();
  const usdPerCny = rates.USD || 0.14;
  const toUsd = (cny) => Math.round((Number(cny) || 0) * usdPerCny * 100) / 100;
  list = list.map((c) => {
    const co = orders
      .filter((o) => o.customerId === c.id)
      .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    const spendUsd = toUsd(co.reduce((s, o) => s + (Number(o.totalCny) || 0), 0));
    return {
      ...safeCustomer(c),
      stats: {
        ordersCount: co.length,
        lastOrderAt: co[0]?.createdAt || null,
        lastOrderNo: co[0]?.orderNo || null,
        totalSpendUsd: spendUsd,
        aovUsd: co.length ? Math.round((spendUsd / co.length) * 100) / 100 : 0,
      },
    };
  });
  res.json(list);
});

router.get('/customers/:id', auth, (req, res) => {
  const c = getById('customers', req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(safeCustomer(c));
});

// 后台创建会员：带 password 则同时生成前台登录凭据；不填则为档案型会员
router.post('/customers', auth, (req, res) => {
  const { name, email, phone, country, currency, notes, status, password } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const mail = normEmail(email);
  try {
    assertEmailAvailable(mail);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  if (password && String(password).length < 6) {
    return res.status(400).json({ error: 'password too short (min 6)' });
  }
  const record = createRecord('customers', {
    name,
    email: mail,
    phone: String(phone || '').trim(),
    country: normUpper(country) || 'US',
    currency: normUpper(currency) || 'USD',
    notes: notes || '',
    status: status || 'active',
    registeredAt: new Date().toISOString(),
    ...(password ? makeCredentials(password) : {}),
  });
  res.json(safeCustomer(record));
});

// 后台编辑会员：凭据字段只读保护；newPassword 选填即重置密码
router.put('/customers/:id', auth, (req, res) => {
  const c = getById('customers', req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  const { newPassword, ...body } = req.body || {};
  const patch = stripCredentials(body);
  if (patch.email !== undefined) {
    const mail = normEmail(patch.email);
    try {
      assertEmailAvailable(mail, req.params.id);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
    patch.email = mail;
  }
  if (patch.country !== undefined) patch.country = normUpper(patch.country);
  if (patch.currency !== undefined) patch.currency = normUpper(patch.currency);
  if (newPassword) {
    try {
      adminResetCustomerPassword(req.params.id, newPassword);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }
  const updated = updateRecord('customers', req.params.id, patch);
  res.json(safeCustomer(updated));
});

router.delete('/customers/:id', auth, requireSuper, (req, res) => {
  // 级联删除该客户地址
  const db = getDb();
  db.addresses = (db.addresses || []).filter((a) => a.customerId !== req.params.id);
  saveDb();
  const ok = deleteRecord('customers', req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== 地址管理 =====
router.get('/addresses', auth, (req, res) => {
  const { customerId } = req.query;
  let list = listCollection('addresses');
  if (customerId) list = list.filter((a) => a.customerId === customerId);
  res.json(list);
});

router.get('/addresses/:id', auth, (req, res) => {
  const a = getById('addresses', req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a);
});

router.post('/addresses', auth, (req, res) => {
  const { customerId, label, recipient, line1, city, state, postal, country, phone, isDefault } = req.body || {};
  if (!customerId || !recipient || !line1) return res.status(400).json({ error: 'customerId, recipient, line1 required' });
  const record = createRecord('addresses', {
    customerId, label: label || 'Home', recipient, line1, line2: req.body.line2 || '',
    city: city || '', state: state || '', postal: postal || '', country: country || 'US',
    phone: phone || '', isDefault: !!isDefault,
  });
  res.json(record);
});

router.put('/addresses/:id', auth, (req, res) => {
  const a = updateRecord('addresses', req.params.id, req.body || {});
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a);
});

router.delete('/addresses/:id', auth, requireSuper, (req, res) => {
  const ok = deleteRecord('addresses', req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== 订单管理 =====
router.get('/orders', auth, (req, res) => {
  const { status, q } = req.query;
  let list = listCollection('orders');
  if (status) list = list.filter((o) => o.status === status);
  if (q) {
    const ql = String(q).toLowerCase();
    list = list.filter((o) =>
      o.orderNo.toLowerCase().includes(ql) ||
      o.trackingNo.toLowerCase().includes(ql) ||
      String(o.customerId).toLowerCase().includes(ql)
    );
  }
  // 附带客户信息，按创建时间倒序（最新在前）
  list.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
  list = list.map((o) => {
    const c = getById('customers', o.customerId);
    const a = getById('addresses', o.addressId);
    return { ...o, customer: c ? { name: c.name, email: c.email } : null, address: a };
  });
  res.json(list);
});

router.get('/orders/:id', auth, (req, res) => {
  const o = getById('orders', req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const c = getById('customers', o.customerId);
  const a = getById('addresses', o.addressId);
  res.json({ ...o, customer: c, address: a });
});

router.post('/orders', auth, (req, res) => {
  const { customerId, addressId, items, currency, tipRate, notes } = req.body || {};
  if (!customerId || !addressId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'customerId, addressId, items required' });
  }
  const now = new Date().toISOString();
  const record = createRecord('orders', {
    customerId, addressId, items, currency: currency || 'USD',
    status: req.body.status || 'pending', tipRate: tipRate || 0,
    notes: notes || '', trackingNo: req.body.trackingNo || '',
    carrier: req.body.carrier || '云途专线',
    subtotalCny: req.body.subtotalCny || 0,
    shippingCny: req.body.shippingCny || 0,
    dutyCny: req.body.dutyCny || 0,
    vatCny: req.body.vatCny || 0,
    serviceFeeCny: req.body.serviceFeeCny || 0,
    tipCny: req.body.tipCny || 0,
    totalCny: req.body.totalCny || 0,
    totalCurrency: req.body.totalCurrency || 0,
    createdAt: now,
    updatedAt: now,
  });
  res.json(record);
});

router.put('/orders/:id', auth, (req, res) => {
  const o = updateRecord('orders', req.params.id, req.body || {});
  if (!o) return res.status(404).json({ error: 'not found' });
  res.json(o);
});

// 一键发货：调顺丰国际下单取号，回填运单号（weightKg 由管理员按实际称重传入）
router.post('/orders/:id/ship', auth, async (req, res, next) => {
  try {
    const o = getById('orders', req.params.id);
    if (!o) return res.status(404).json({ error: 'order not found' });
    if (o.trackingNo) return res.status(409).json({ error: `already shipped: ${o.trackingNo}` });

    const { getCarrierConfigs } = await import('../services/carrierStore.js');
    const { createCarrierAdapter } = await import('../carriers/index.js');
    const { cnyToCurrency } = await import('../services/currency.js');
    const cfg = getCarrierConfigs().find((c) => c.code === 'sfintl');
    if (!cfg || !cfg.appKey || !cfg.aesKey) {
      return res.status(400).json({ error: '顺丰国际未配置，无法自动取号' });
    }
    // 缺省寄件仓（后台渠道配置 senderInfo JSON 可覆盖）
    let sender = {
      company: 'CrossBuy', contact: 'Talley', country: 'CN', postCode: '518009',
      regionFirst: 'Guangdong', regionSecond: 'Shenzhen',
      address: 'Huating Road 7# DaLang Street', phoneNo: '13800000000', telNo: '13800000000',
    };
    try { sender = { ...sender, ...(typeof cfg.senderInfo === 'string' ? JSON.parse(cfg.senderInfo) : (cfg.senderInfo || {})) }; } catch { /* 保持缺省 */ }

    const items = Array.isArray(o.items) ? o.items : [];
    const weightKg = Number(req.body?.weightKg) || Math.max(0.3 * Math.max(items.length, 1), 0.5);
    // 申报价值按 USD 换算（订单金额以 CNY 记账，顺丰申报币种独立）
    const declaredValue = Number(req.body?.declaredValue) || Number(cnyToCurrency(
      items.reduce((s, it) => s + (Number(it.priceCny) || 0) * (Number(it.quantity) || 1), 0), 'USD'
    ).toFixed(2));
    const r = await createCarrierAdapter(cfg).createOrder({
      orderNo: o.orderNo,
      totalWeightKg: weightKg,
      declaredValue,
      declaredCurrency: 'USD',
      interProductCode: req.body?.interProductCode,
      items: items.map((it) => ({
        name: String(it.titleEn || it.title || 'Goods').slice(0, 30),
        cName: String(it.title || '').slice(0, 30),
        unit: 'piece',
        amount: Number((cnyToCurrency((Number(it.priceCny) || 0) * (Number(it.quantity) || 1), 'USD')).toFixed(2)),
        currency: 'USD',
        quantity: Number(it.quantity) || 1,
        weightKg: Number((weightKg / Math.max(items.length, 1)).toFixed(3)),
      })),
      sender,
      receiver: {
        company: o.contact?.name || o.address?.line1 || '',
        contact: o.contact?.name || '',
        country: o.address?.country || 'US',
        postCode: o.address?.postal || '',
        regionFirst: o.address?.state || '',
        regionSecond: o.address?.city || '',
        address: [o.address?.line1, o.address?.line2].filter(Boolean).join(' '),
        email: o.contact?.email || '',
        phoneNo: o.contact?.phone || '',
        telNo: o.contact?.phone || '',
      },
    });

    const timeline = Array.isArray(o.timeline) ? o.timeline : [];
    timeline.push({
      at: new Date().toISOString(),
      author: req.admin?.username || 'admin',
      type: 'note',
      content: `顺丰国际取号成功：${r.sfWaybillNo}（${r.directionCode || r.agentCode || ''}）`,
    });
    const updated = updateRecord('orders', o.id, {
      trackingNo: r.sfWaybillNo,
      status: 'shipped',
      shippingMeta: { sfWaybillNo: r.sfWaybillNo, agentCode: r.agentCode, directionCode: r.directionCode, weightKg, declaredValue },
      timeline,
    });
    res.json({ ok: true, trackingNo: r.sfWaybillNo, directionCode: r.directionCode, order: updated });
  } catch (err) {
    next(err);
  }
});

// 订单备注：追加到时间线（WooCommerce order notes 风格）
router.post('/orders/:id/notes', auth, (req, res) => {
  const { content, type } = req.body || {};
  const text = String(content || '').trim();
  if (!text) return res.status(400).json({ error: 'content required' });
  const o = getById('orders', req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const timeline = Array.isArray(o.timeline) ? o.timeline : [];
  timeline.push({
    at: new Date().toISOString(),
    author: req.admin?.username || 'admin',
    type: type === 'customer' ? 'customer' : 'note',
    content: text,
  });
  const updated = updateRecord('orders', req.params.id, { timeline });
  res.json(updated);
});

router.delete('/orders/:id', auth, requireSuper, (req, res) => {
  const ok = deleteRecord('orders', req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== 系统设置 =====
router.get('/settings', auth, (req, res) => {
  res.json(getDb().settings || {});
});

router.put('/settings', auth, requireSuper, (req, res) => {
  const db = getDb();
  db.settings = { ...(db.settings || {}), ...(req.body || {}) };
  saveDb();
  res.json(db.settings);
});

export default router;
