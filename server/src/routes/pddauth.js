// 拼多多 OAuth 授权回调（多多进宝 search 接口需要 access_token）
// 流程：GET /api/pdd/auth 302 到授权页 -> 用户授权 -> 回调 /api/pdd/callback?code=
//       -> pdd.pop.auth.token.create 换 token -> 存 settings -> 搜索链路自动带 token
import { Router } from 'express';
import crypto from 'crypto';
import { getDb, saveDb } from '../services/db.js';
import { saveSetting } from '../services/mysql.js';

const router = Router();
const CID = process.env.PDD_CLIENT_ID || '';
const CSC = process.env.PDD_CLIENT_SECRET || '';
const REDIRECT = process.env.PDD_REDIRECT_URI || '';
const AUTHORIZE_URL = 'https://open.pinduoduo.com/oauth/authorize';
// token 存储键与提前刷新余量（临期 1h 内自动用 refresh_token 续期）
const TOKEN_KEY = 'pddToken';
const REFRESH_MARGIN_MS = 60 * 60 * 1000;

function sign(params) {
  const joined = Object.keys(params)
    .sort()
    .map((k) => k + String(params[k]))
    .join('');
  return crypto.createHash('md5').update(CSC + joined + CSC, 'utf8').digest('hex').toUpperCase();
}

async function routerCall(type, biz = {}) {
  const params = {
    type,
    client_id: CID,
    client_secret: CSC,
    timestamp: Math.floor(Date.now() / 1000),
    ...biz,
  };
  params.sign = sign(params);
  const res = await fetch('https://gw-api.pinduoduo.com/api/router', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(30000),
  });
  return res.json();
}

function readTokenRec() {
  const raw = getDb().settings?.[TOKEN_KEY];
  if (!raw) return null;
  let rec = raw;
  if (typeof raw === 'string') {
    try { rec = JSON.parse(raw); } catch { return null; }
  }
  return rec?.accessToken ? rec : null;
}

function writeTokenRec(rec) {
  getDb().settings[TOKEN_KEY] = rec;
  saveDb();
  saveSetting(TOKEN_KEY, rec).catch((e) => console.error('[pdd] saveSetting:', e.message));
}

export async function getPddToken() {
  const rec = readTokenRec();
  if (!rec) return null;
  // 临期用 refresh_token 刷新（刷新后旧 token 立即失效，服务端单进程串行足够）
  if (rec.expireAt && rec.expireAt - REFRESH_MARGIN_MS < Date.now() && rec.refreshToken) {
    try {
      const j = await routerCall('pdd.pop.auth.token.refresh', { refresh_token: rec.refreshToken });
      const d = j?.pop_auth_token_refresh_response;
      if (d?.access_token) {
        const next = {
          accessToken: d.access_token,
          refreshToken: d.refresh_token || rec.refreshToken,
          expireAt: Date.now() + Number(d.expires_in || 86400) * 1000,
          ownerName: rec.ownerName || '',
          updatedAt: new Date().toISOString(),
        };
        writeTokenRec(next);
        return next;
      }
    } catch { /* 刷新失败继续用旧值，可能仍有效 */ }
  }
  return rec;
}

// 发起授权：302 到拼多多授权页
router.get('/auth', (req, res) => {
  if (!CID || !REDIRECT) return res.status(500).send('PDD_CLIENT_ID / PDD_REDIRECT_URI not configured');
  const state = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', CID);
  url.searchParams.set('redirect_uri', REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  getDb().settings.pddOAuthState = state;
  saveDb();
  saveSetting('pddOAuthState', state).catch(() => {});
  res.redirect(url.toString());
});

// 授权回调：code 换 token
router.get('/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const savedState = getDb().settings?.pddOAuthState;
  if (!code) return res.status(400).send('missing code');
  if (savedState && state && savedState !== state) return res.status(403).send('state mismatch');
  try {
    const j = await routerCall('pdd.pop.auth.token.create', { code, redirect_uri: REDIRECT });
    const d = j?.pop_auth_token_create_response;
    if (!d?.access_token) {
      const msg = JSON.stringify(j?.error_response || j).slice(0, 300);
      return res.status(502).send(`token exchange failed: ${msg}`);
    }
    writeTokenRec({
      accessToken: d.access_token,
      refreshToken: d.refresh_token || '',
      expireAt: Date.now() + Number(d.expires_in || 86400) * 1000,
      ownerName: d.owner_name || '',
      updatedAt: new Date().toISOString(),
    });
    res.send('<html><body style="font-family:sans-serif;text-align:center;padding-top:60px"><h2>拼多多授权成功</h2><p>token 已保存，多多进宝关键词搜索已可用。可以关闭此页面。</p></body></html>');
  } catch (e) {
    res.status(502).send(`token exchange error: ${e.message}`);
  }
});

// token 状态（排查用，脱敏）
router.get('/token/status', (req, res) => {
  getPddToken().then((rec) => {
    if (!rec) return res.json({ configured: false });
    res.json({
      configured: true,
      ownerName: rec.ownerName || '',
      expireAt: rec.expireAt ? new Date(rec.expireAt).toISOString() : null,
      valid: !rec.expireAt || rec.expireAt > Date.now(),
      updatedAt: rec.updatedAt || null,
    });
  });
});

export default router;
