// 后台鉴权：多管理员账号 + 角色权限（super/operator），内存 token（演示级）
import crypto from 'crypto';
import { getDb, saveDb } from './db.js';

const tokens = new Map(); // token -> {username, role}

const ROLES = ['super', 'operator'];

export const PERMISSIONS = {
  // operator 可访问的管理资源；其余（管理员管理、系统设置、快递商配置写操作）仅 super
  operator: ['customers', 'addresses', 'orders', 'profile', 'password'],
};

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

// 账号迁移：旧单密码体系 -> 多账号（默认 admin / super）
function ensureAdmins() {
  const db = getDb();
  db.settings = db.settings || {};
  if (!Array.isArray(db.settings.admins) || db.settings.admins.length === 0) {
    const legacy = db.settings.adminPassword || process.env.ADMIN_PASSWORD || 'admin123';
    db.settings.admins = [{
      id: 'admin_1',
      username: 'admin',
      role: 'super',
      createdAt: new Date().toISOString(),
      ...makeCredentials(legacy),
    }];
    saveDb();
  }
}

export function listAdmins() {
  ensureAdmins();
  const db = getDb();
  return db.settings.admins.map(({ salt, passwordHash, ...safe }) => safe);
}

export function createAdmin({ username, password, role }) {
  ensureAdmins();
  const db = getDb();
  const name = String(username || '').trim();
  if (!name || !/^[a-zA-Z0-9_-]{2,32}$/.test(name)) {
    throw Object.assign(new Error('invalid username (2-32 chars, a-z0-9_-)'), { status: 400 });
  }
  if (String(password || '').length < 6) {
    throw Object.assign(new Error('password too short (min 6)'), { status: 400 });
  }
  if (!ROLES.includes(role)) {
    throw Object.assign(new Error('invalid role'), { status: 400 });
  }
  if (db.settings.admins.some((a) => a.username === name)) {
    throw Object.assign(new Error('username already exists'), { status: 409 });
  }
  const rec = {
    id: `admin_${Date.now().toString(36)}`,
    username: name,
    role,
    createdAt: new Date().toISOString(),
    ...makeCredentials(password),
  };
  db.settings.admins.push(rec);
  saveDb();
  const { salt, passwordHash, ...safe } = rec;
  return safe;
}

export function updateAdmin(id, { password, role }) {
  ensureAdmins();
  const db = getDb();
  const admin = db.settings.admins.find((a) => a.id === id);
  if (!admin) throw Object.assign(new Error('admin not found'), { status: 404 });
  if (password !== undefined) {
    if (String(password).length < 6) throw Object.assign(new Error('password too short (min 6)'), { status: 400 });
    Object.assign(admin, makeCredentials(password));
  }
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw Object.assign(new Error('invalid role'), { status: 400 });
    // 保证系统至少保留一个 super
    if (admin.role === 'super' && role !== 'super') {
      const supers = db.settings.admins.filter((a) => a.role === 'super');
      if (supers.length <= 1) throw Object.assign(new Error('at least one super admin required'), { status: 400 });
    }
    admin.role = role;
  }
  saveDb();
  const { salt, passwordHash, ...safe } = admin;
  return safe;
}

export function deleteAdmin(id, currentUsername) {
  ensureAdmins();
  const db = getDb();
  const admin = db.settings.admins.find((a) => a.id === id);
  if (!admin) throw Object.assign(new Error('admin not found'), { status: 404 });
  if (admin.username === currentUsername) {
    throw Object.assign(new Error('cannot delete yourself'), { status: 400 });
  }
  if (admin.role === 'super' && db.settings.admins.filter((a) => a.role === 'super').length <= 1) {
    throw Object.assign(new Error('at least one super admin required'), { status: 400 });
  }
  db.settings.admins = db.settings.admins.filter((a) => a.id !== id);
  // 踢掉被删账号的在线 token
  for (const [tk, u] of tokens.entries()) {
    if (u.username === admin.username) tokens.delete(tk);
  }
  saveDb();
  return { ok: true };
}

export function login(username, password) {
  ensureAdmins();
  const db = getDb();
  const name = String(username || '').trim() || 'admin';
  const admin = db.settings.admins.find((a) => a.username === name);
  if (!admin || !verifyCredentials(password, admin.salt, admin.passwordHash)) return null;
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, { username: admin.username, role: admin.role });
  return { token, username: admin.username, role: admin.role };
}

export function verifyPassword(password, username) {
  ensureAdmins();
  const db = getDb();
  const name = String(username || '').trim();
  const admin = db.settings.admins.find((a) => a.username === name);
  return !!admin && verifyCredentials(password, admin.salt, admin.passwordHash);
}

// 登录用户改自己密码
export function changeOwnPassword(username, currentPassword, newPassword) {
  ensureAdmins();
  const db = getDb();
  const admin = db.settings.admins.find((a) => a.username === username);
  if (!admin) return { ok: false, error: 'account not found' };
  if (!verifyCredentials(currentPassword, admin.salt, admin.passwordHash)) {
    return { ok: false, error: 'current password incorrect' };
  }
  if (String(newPassword).length < 6) return { ok: false, error: 'new password too short (min 6)' };
  Object.assign(admin, makeCredentials(newPassword));
  saveDb();
  return { ok: true };
}

export function getProfile() {
  const db = getDb();
  return db.settings?.adminProfile || { name: 'Administrator', email: 'admin@crossbuy.com' };
}

export function updateProfile(data) {
  const db = getDb();
  const prev = db.settings?.adminProfile || { name: 'Administrator', email: 'admin@crossbuy.com' };
  db.settings = {
    ...(db.settings || {}),
    adminProfile: {
      ...prev,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
    },
  };
  saveDb();
  return db.settings.adminProfile;
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = tokens.get(token);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.admin = user;
  next();
}

// super 专属操作守卫
export function requireSuper(req, res, next) {
  if (req.admin?.role !== 'super') {
    return res.status(403).json({ error: 'forbidden (super admin only)' });
  }
  next();
}

export function isValidToken(token) {
  return tokens.has(token);
}
