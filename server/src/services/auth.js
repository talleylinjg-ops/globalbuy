// 后台共享鉴权（内存 token，适合演示）
import crypto from 'crypto';

const tokens = new Set();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export function login(password) {
  if (password !== ADMIN_PASSWORD) return null;
  const token = crypto.randomBytes(24).toString('hex');
  tokens.add(token);
  return token;
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!tokens.has(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

export function isValidToken(token) {
  return tokens.has(token);
}
