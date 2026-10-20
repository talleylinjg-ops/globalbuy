// 会员（买家）My Account API —— 对齐 WooCommerce 账户中心
// 路由挂载于 /api/auth/*
import { Router } from 'express';
import {
  registerCustomer, loginCustomer, logoutCustomer,
  authCustomerMiddleware, getCustomerProfile, updateCustomerProfile,
} from '../services/customerAuth.js';
import { listCollection, getById, createRecord, updateRecord, deleteRecord } from '../services/db.js';

const router = Router();

// ---------- 会话 ----------
router.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const result = registerCustomer({ name, email, password });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/login', (req, res) => {
  const result = loginCustomer(req.body || {});
  if (!result) return res.status(401).json({ error: 'incorrect email or password' });
  res.json({ ok: true, ...result });
});

router.post('/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  res.json(logoutCustomer(token));
});

// ---------- 资料与密码 ----------
router.get('/me', authCustomerMiddleware, (req, res) => {
  res.json(getCustomerProfile(req.customer.id));
});

router.put('/me', authCustomerMiddleware, (req, res) => {
  try {
    res.json(updateCustomerProfile(req.customer.id, req.body || {}));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ---------- 我的订单 ----------
function orderSummary(o) {
  const parcels = Array.isArray(o.parcels) ? o.parcels : [];
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    id: o.id,
    orderNo: o.orderNo,
    status: o.status || 'pending',
    createdAt: o.createdAt,
    currency: o.currency || 'USD',
    total: o.totalCurrency,
    itemsCount: items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
    parcelsCount: parcels.length || o.expectedParcels || 0,
    shipped: parcels.length > 0 && parcels.every((pc) => pc.trackingNo),
    carrier: o.carrier || '',
    daysMin: o.daysMin || null,
    daysMax: o.daysMax || null,
  };
}

router.get('/orders', authCustomerMiddleware, (req, res) => {
  const orders = (listCollection('orders') || [])
    .filter((o) => o.customerId === req.customer.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(orderSummary);
  res.json(orders);
});

router.get('/orders/:id', authCustomerMiddleware, (req, res) => {
  const o = getById('orders', req.params.id);
  if (!o || o.customerId !== req.customer.id) return res.status(404).json({ error: 'order not found' });
  const parcels = Array.isArray(o.parcels) && o.parcels.length > 0
    ? o.parcels
    : (o.trackingNo ? [{ trackingNo: o.trackingNo, carrier: o.carrier, productName: '', items: [] }] : []);
  const packedItems = parcels.reduce((s, pc) => s + (pc.items || []).reduce((x, it) => x + (Number(it.quantity) || 0), 0), 0);
  const totalItems = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  res.json({
    ...orderSummary(o),
    subtotal: o.subtotalCny, // 费用明细以币种折算行展示，这里给 CNY 存档
    breakdown: {
      shippingCny: o.shippingCny,
      dutyCny: o.dutyCny,
      vatCny: o.vatCny,
      serviceFeeCny: o.serviceFeeCny,
      paymentFeeCny: o.paymentFeeCny,
      totalCny: o.totalCny,
      total: o.totalCurrency,
      currency: o.currency,
    },
    items: (o.items || []).map((it) => ({
      title: it.title, platform: it.platform, warehouse: it.warehouse || '',
      quantity: it.quantity, price: it.price,
      skuId: it.skuId || '', skuName: it.skuName || '',
    })),
    parcels: parcels.map((pc) => ({
      trackingNo: pc.trackingNo || '',
      carrier: pc.carrier || o.carrier || '',
      productName: pc.productName || '',
      warehouse: pc.warehouse || '',
      items: (pc.items || []).map((it) => ({ title: it.title, quantity: it.quantity })),
    })),
    shipmentPreview: {
      expectedParcels: o.expectedParcels || null,
      warehouses: Array.isArray(o.warehouses) ? o.warehouses : [],
      packed: packedItems,
      totalItems,
    },
    address: o.address || null,
    notes: o.notes || '',
  });
});

// ---------- 地址簿（WooCommerce Addresses）----------
function ownedAddress(req, id) {
  const a = getById('addresses', id);
  return a && a.customerId === req.customer.id ? a : null;
}

router.get('/addresses', authCustomerMiddleware, (req, res) => {
  const list = (listCollection('addresses') || []).filter((a) => a.customerId === req.customer.id);
  res.json(list);
});

router.post('/addresses', authCustomerMiddleware, (req, res) => {
  const b = req.body || {};
  if (!b.line1 || !b.city || !b.country) {
    return res.status(400).json({ error: 'line1, city and country are required' });
  }
  const rec = createRecord('addresses', {
    customerId: req.customer.id,
    label: String(b.label || 'Address').trim(),
    recipient: String(b.recipient || '').trim(),
    line1: String(b.line1).trim(),
    line2: String(b.line2 || '').trim(),
    city: String(b.city).trim(),
    state: String(b.state || '').trim(),
    postal: String(b.postal || '').trim(),
    country: String(b.country).toUpperCase().trim(),
    phone: String(b.phone || '').trim(),
    isDefault: false,
  });
  if (b.isDefault) setDefaultAddress(req.customer.id, rec.id);
  res.json(getById('addresses', rec.id));
});

function setDefaultAddress(customerId, addressId) {
  const list = (listCollection('addresses') || []).filter((a) => a.customerId === customerId);
  for (const a of list) {
    updateRecord('addresses', a.id, { isDefault: a.id === addressId });
  }
}

router.put('/addresses/:id', authCustomerMiddleware, (req, res) => {
  if (!ownedAddress(req, req.params.id)) return res.status(404).json({ error: 'address not found' });
  const b = req.body || {};
  const patch = {};
  for (const k of ['label', 'recipient', 'line1', 'line2', 'city', 'state', 'postal', 'phone']) {
    if (b[k] !== undefined) patch[k] = String(b[k]).trim();
  }
  if (b.country !== undefined) patch.country = String(b.country).toUpperCase().trim();
  updateRecord('addresses', req.params.id, patch);
  if (b.isDefault) setDefaultAddress(req.customer.id, req.params.id);
  res.json(getById('addresses', req.params.id));
});

router.delete('/addresses/:id', authCustomerMiddleware, (req, res) => {
  if (!ownedAddress(req, req.params.id)) return res.status(404).json({ error: 'address not found' });
  deleteRecord('addresses', req.params.id);
  res.json({ ok: true });
});

router.post('/addresses/:id/default', authCustomerMiddleware, (req, res) => {
  if (!ownedAddress(req, req.params.id)) return res.status(404).json({ error: 'address not found' });
  setDefaultAddress(req.customer.id, req.params.id);
  res.json({ ok: true });
});

export default router;
