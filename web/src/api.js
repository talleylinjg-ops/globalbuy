// 静态托管：构建时用 VITE_API_BASE 指向后端（如 https://api.example.com）；开发模式同源走 vite 代理
export const API_BASE = import.meta.env.VITE_API_BASE || '';
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

// ===== 静态快照降级层（学习镜像站架构：后端不可达时前台 100% 可浏览） =====
// 后端（"原站"）休眠/未部署时，读取构建期抓取的演示快照，访客端始终有完整浏览体验
// 速度策略：GET 快查 2.5s 超时；任一请求失败即全局降级（后续 0ms 走快照），后台每 60s 探活自动恢复
const GET_TIMEOUT = 2500;
const SLOW_TIMEOUT = 8000;

let backendDown = false;
let lastProbeAt = 0;

async function fetchWithTimeout(url, ms = GET_TIMEOUT) {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}

async function probeBackend() {
  if (!backendDown || Date.now() - lastProbeAt < 60000) return;
  lastProbeAt = Date.now();
  try {
    const res = await fetchWithTimeout(apiUrl('/api/meta'), 1500);
    if (res.ok) backendDown = false;
  } catch {
    // 仍不可达，保持降级
  }
}

// 模块加载即预热：meta + 默认搜索快照并行预取（demo 模式首屏零等待）
const DEFAULT_SNAPSHOT = 'search-wireless-earbuds';
if (typeof window !== 'undefined') {
  loadDemoSnapshot('meta').catch(() => {});
  loadDemoSnapshot(DEFAULT_SNAPSHOT).catch(() => {});
}

let demoSnapshotCache = {};
async function loadDemoSnapshot(name) {
  if (demoSnapshotCache[name]) return demoSnapshotCache[name];
  const res = await fetch(`${import.meta.env.BASE_URL}demo/${name}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  demoSnapshotCache[name] = j;
  return j;
}

// 快照内商品图片随快照打包在 /demo/images/，降级时改写路径避免 404
function rewriteDemoImages(data) {
  const base = import.meta.env.BASE_URL;
  (data?.results || []).forEach((r) => {
    if (r.imageUrl && !r.imageUrl.startsWith(`${base}demo/`)) r.imageUrl = `${base}demo${r.imageUrl}`;
  });
  return data;
}

function demoSearchSnapshot(keyword) {
  const k = (keyword || '').toLowerCase();
  const rules = [
    [/(case|壳)/, 'search-phone-case'],
    [/(watch|手表)/, 'search-smart-watch'],
    [/(luggage|suitcase|行李|箱)/, 'search-luggage'],
    [/(keyboard|键盘)/, 'search-keyboard'],
    [/(shoe|sneaker|鞋)/, 'search-sneakers'],
  ];
  const name = rules.find(([re]) => re.test(k))?.[1] || 'search-wireless-earbuds';
  return loadDemoSnapshot(name).then(rewriteDemoImages);
}

async function getJSON(url, { fallback } = {}) {
  if (backendDown) {
    probeBackend();
    if (fallback) return fallback(new Error('backend down'));
    throw new Error('backend down');
  }
  try {
    const res = await fetchWithTimeout(apiUrl(url));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    backendDown = false;
    return res.json();
  } catch (e) {
    backendDown = true;
    lastProbeAt = Date.now();
    if (fallback) return fallback(e);
    throw e;
  }
}

// ===== 后台管理 API =====
const ADMIN_TOKEN_KEY = 'cb_admin_token';

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function adminFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAdminToken()}`,
    ...(options.headers || {}),
  };
  const res = await fetch(apiUrl(url), { ...options, headers });
  if (res.status === 401) {
    setAdminToken(null);
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function adminLogin(username, password) {
  const res = await fetch(apiUrl('/api/admin/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('invalid credentials');
  const data = await res.json();
  setAdminToken(data.token);
  return data;
}

// ===== 管理员账号管理（super）=====
export async function adminListAdmins() {
  return adminFetch('/api/admin/admins');
}
export async function adminCreateAdmin(data) {
  return adminFetch('/api/admin/admins', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateAdmin(id, data) {
  return adminFetch(`/api/admin/admins/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminDeleteAdmin(id) {
  return adminFetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
}

export async function adminVerify() {
  return adminFetch('/api/admin/me');
}

// 会员资料 / 密码
export async function adminGetProfile() {
  return adminFetch('/api/admin/profile');
}
export async function adminUpdateProfile(data) {
  return adminFetch('/api/admin/profile', { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminUpdatePassword(currentPassword, newPassword) {
  return adminFetch('/api/admin/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// 客户
export async function adminListCustomers(q) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return adminFetch(`/api/admin/customers${qs}`);
}
export async function adminCreateCustomer(data) {
  return adminFetch('/api/admin/customers', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateCustomer(id, data) {
  return adminFetch(`/api/admin/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminDeleteCustomer(id) {
  return adminFetch(`/api/admin/customers/${id}`, { method: 'DELETE' });
}

// 地址
export async function adminListAddresses(customerId) {
  const qs = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
  return adminFetch(`/api/admin/addresses${qs}`);
}
export async function adminCreateAddress(data) {
  return adminFetch('/api/admin/addresses', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateAddress(id, data) {
  return adminFetch(`/api/admin/addresses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminDeleteAddress(id) {
  return adminFetch(`/api/admin/addresses/${id}`, { method: 'DELETE' });
}

// 订单
export async function adminListOrders(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  const str = qs.toString();
  return adminFetch(`/api/admin/orders${str ? `?${str}` : ''}`);
}
export async function adminGetOrder(id) {
  return adminFetch(`/api/admin/orders/${id}`);
}
export async function adminCreateOrder(data) {
  return adminFetch('/api/admin/orders', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateOrder(id, data) {
  return adminFetch(`/api/admin/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminDeleteOrder(id) {
  return adminFetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
}
export async function adminAddOrderNote(id, content, type = 'note') {
  return adminFetch(`/api/admin/orders/${id}/notes`, { method: 'POST', body: JSON.stringify({ content, type }) });
}

// 设置
export async function adminGetSettings() {
  return adminFetch('/api/admin/settings');
}
export async function adminUpdateSettings(data) {
  return adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
}

// ===== 快递商管理 =====
export async function adminListCarriers() {
  return adminFetch('/api/admin/carriers');
}
export async function adminGetCarrierMeta() {
  return adminFetch('/api/admin/carriers/meta');
}
export async function adminCreateCarrier(data) {
  return adminFetch('/api/admin/carriers', { method: 'POST', body: JSON.stringify(data) });
}
export async function adminUpdateCarrier(id, data) {
  return adminFetch(`/api/admin/carriers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminDeleteCarrier(id) {
  return adminFetch(`/api/admin/carriers/${id}`, { method: 'DELETE' });
}
export async function adminTestCarrier(id) {
  return adminFetch(`/api/admin/carriers/${id}/test`, { method: 'POST' });
}

// ===== 公开快递报价 =====
export async function fetchCarriers() {
  return getJSON('/api/carriers');
}
export async function quoteCarriers(params) {
  const res = await fetch(apiUrl('/api/carriers/quote'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchMeta() {
  const meta = await getJSON('/api/meta', {
    fallback: async () => ({ ...(await loadDemoSnapshot('meta')), demo: true }),
  });
  return meta;
}

export async function fetchTax(country) {
  return getJSON(`/api/tax/${encodeURIComponent(country)}`);
}

export async function searchProducts(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) qs.set(k, v.join(','));
    } else {
      qs.set(k, String(v));
    }
  }
  if (backendDown) {
    probeBackend();
    const snap = await demoSearchSnapshot(params.q);
    return { ...snap, inputKeyword: params.q || snap.inputKeyword, keyword: params.q || snap.keyword, demo: true };
  }
  try {
    const res = await fetchWithTimeout(apiUrl(`/api/search?${qs.toString()}`));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    backendDown = false;
    return res.json();
  } catch (e) {
    // 后端不可达：全局降级 + 内置演示快照（标注 demo，保留用户关键词）
    backendDown = true;
    lastProbeAt = Date.now();
    const snap = await demoSearchSnapshot(params.q);
    return {
      ...snap,
      inputKeyword: params.q || snap.inputKeyword,
      keyword: params.q || snap.keyword,
      demo: true,
    };
  }
}

export async function parseLink(url) {
  return getJSON(`/api/link/parse-link?url=${encodeURIComponent(url)}`);
}
