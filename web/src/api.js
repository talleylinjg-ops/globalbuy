async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
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
  const res = await fetch(url, { ...options, headers });
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

export async function adminLogin(password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('invalid credentials');
  const data = await res.json();
  setAdminToken(data.token);
  return data;
}

export async function adminVerify() {
  return adminFetch('/api/admin/me');
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
  const res = await fetch('/api/carriers/quote', {
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
  return getJSON('/api/meta');
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
  return getJSON(`/api/search?${qs.toString()}`);
}

export async function parseLink(url) {
  return getJSON(`/api/link/parse-link?url=${encodeURIComponent(url)}`);
}
