// 会员（买家）认证体系：注册 / 登录 / 会话 / 资料与密码管理
// 复用管理端 scrypt 凭据模式；客户 token 与管理员 token 完全隔离
import crypto from 'crypto';
import { getDb, saveDb, createRecord, updateRecord, getById } from './db.js';

const customerTokens = new Map(); // token -> { customerId, email }
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天会话（对齐 WooCommerce「记住我」）

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

function makeCredentials(password) {
  const salt = crypto.randomBytes(12).toString('hex');
  return { salt, passwordHash: hashPassword(password, salt) };
}

function verifyCredentials(password, salt, passwordHash) {
  try {
    const h = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(passwordHash));
  } catch {
    return false;
  }
}

const normEmail = (e) => String(e || '').trim().toLowerCase();

function findCustomerByEmail(email) {
  const db = getDb();
  const target = normEmail(email);
  return (db.customers || []).find((c) => normEmail(c.email) === target) || null;
}

function safeCustomer(c) {
  if (!c) return null;
  const { salt, passwordHash, ...safe } = c;
  return safe;
}

export function registerCustomer({ name, email, password }) {
  const mail = normEmail(email);
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    throw Object.assign(new Error('invalid email'), { status: 400 });
  }
  if (String(password || '').length < 6) {
    throw Object.assign(new Error('password too short (min 6)'), { status: 400 });
  }
  const existing = findCustomerByEmail(mail);
  if (existing) {
    // 游客下单创建过资料的邮箱：首次注册即绑定密码转正式会员
    if (existing.passwordHash) {
      throw Object.assign(new Error('email already registered'), { status: 409 });
    }
    const updated = updateRecord('customers', existing.id, {
      ...(name ? { name: String(name).trim() } : {}),
      ...makeCredentials(password),
      status: 'active',
    });
    return issueSession(updated.id);
  }
  const rec = createRecord('customers', {
    name: String(name || '').trim() || mail.split('@')[0],
    email: mail,
    phone: '',
    country: '',
    currency: '',
    status: 'active',
    notes: 'Registered from storefront account',
    registeredAt: new Date().toISOString(),
    ...makeCredentials(password),
  });
  return issueSession(rec.id);
}

export function loginCustomer({ email, password }) {
  const customer = findCustomerByEmail(email);
  if (!customer || !customer.passwordHash) return null;
  if (!verifyCredentials(password, customer.salt, customer.passwordHash)) return null;
  return issueSession(customer.id);
}

function issueSession(customerId) {
  const c = getById('customers', customerId);
  const token = crypto.randomBytes(24).toString('hex');
  customerTokens.set(token, { customerId, email: normEmail(c.email), at: Date.now() });
  return { token, customer: safeCustomer(c) };
}

export function logoutCustomer(token) {
  customerTokens.delete(token);
  return { ok: true };
}

// 游客下单联动：轻量校验 token 返回会话（未登录返回 null，不拦截请求）
export function resolveCustomerSession(token) {
  const session = customerTokens.get(token);
  if (!session || Date.now() - session.at > TOKEN_TTL_MS) return null;
  session.at = Date.now();
  return { customerId: session.customerId, email: session.email };
}

export function authCustomerMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = customerTokens.get(token);
  if (!session || Date.now() - session.at > TOKEN_TTL_MS) {
    if (session) customerTokens.delete(token);
    return res.status(401).json({ error: 'unauthorized' });
  }
  session.at = Date.now(); // 活跃会话滑动续期
  req.customer = { id: session.customerId, email: session.email };
  req.customerToken = token;
  next();
}

export function getCustomerProfile(customerId) {
  return safeCustomer(getById('customers', customerId));
}

export function updateCustomerProfile(customerId, data) {
  const patch = {};
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.phone !== undefined) patch.phone = String(data.phone).trim();
  if (data.country !== undefined) patch.country = String(data.country).toUpperCase().trim();
  if (data.currency !== undefined) patch.currency = String(data.currency).toUpperCase().trim();
  if (data.currentPassword !== undefined || data.newPassword !== undefined) {
    const c = getById('customers', customerId);
    if (!c) throw Object.assign(new Error('account not found'), { status: 404 });
    if (!verifyCredentials(String(data.currentPassword || ''), c.salt, c.passwordHash)) {
      throw Object.assign(new Error('current password incorrect'), { status: 400 });
    }
    if (String(data.newPassword || '').length < 6) {
      throw Object.assign(new Error('new password too short (min 6)'), { status: 400 });
    }
    Object.assign(patch, makeCredentials(data.newPassword));
  }
  const updated = updateRecord('customers', customerId, patch);
  return safeCustomer(updated);
}

// 管理员重置会员密码（后台操作）
export function adminResetCustomerPassword(customerId, newPassword) {
  if (String(newPassword || '').length < 6) {
    throw Object.assign(new Error('password too short (min 6)'), { status: 400 });
  }
  const c = getById('customers', customerId);
  if (!c) throw Object.assign(new Error('customer not found'), { status: 404 });
  updateRecord('customers', customerId, makeCredentials(newPassword));
  // 踢掉该客户全部会话
  for (const [tk, s] of customerTokens.entries()) {
    if (s.customerId === customerId) customerTokens.delete(tk);
  }
  return { ok: true };
}
