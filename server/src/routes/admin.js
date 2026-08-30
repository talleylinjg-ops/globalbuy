import { Router } from 'express';
import {
  listCollection, getById, createRecord, updateRecord, deleteRecord, getDb, saveDb,
} from '../services/db.js';
import { login, authMiddleware as auth } from '../services/auth.js';

const router = Router();

// 登录
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const token = login(password);
  if (!token) return res.status(401).json({ error: 'invalid credentials' });
  res.json({ ok: true, token });
});

router.get('/me', auth, (req, res) => {
  res.json({ ok: true, user: 'admin' });
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
  res.json(list);
});

router.get('/customers/:id', auth, (req, res) => {
  const c = getById('customers', req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

router.post('/customers', auth, (req, res) => {
  const { name, email, phone, country, currency, notes, status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const record = createRecord('customers', {
    name, email: email || '', phone: phone || '', country: country || 'US',
    currency: currency || 'USD', notes: notes || '', status: status || 'active',
  });
  res.json(record);
});

router.put('/customers/:id', auth, (req, res) => {
  const c = updateRecord('customers', req.params.id, req.body || {});
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

router.delete('/customers/:id', auth, (req, res) => {
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

router.delete('/addresses/:id', auth, (req, res) => {
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
  // 附带客户信息
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

router.delete('/orders/:id', auth, (req, res) => {
  const ok = deleteRecord('orders', req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== 系统设置 =====
router.get('/settings', auth, (req, res) => {
  res.json(getDb().settings || {});
});

router.put('/settings', auth, (req, res) => {
  const db = getDb();
  db.settings = { ...(db.settings || {}), ...(req.body || {}) };
  saveDb();
  res.json(db.settings);
});

export default router;
