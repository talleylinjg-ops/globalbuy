// 会员会话存储：localStorage 持久化 + 订阅通知（登录/登出/资料变更）
import { useState, useEffect } from 'react';
import { apiUrl } from './api.js';

const KEY = 'crossbuy_member';
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(session) {
  if (session) localStorage.setItem(KEY, JSON.stringify(session));
  else localStorage.removeItem(KEY);
  for (const fn of listeners) fn(session);
}

export function getSession() {
  return read();
}

export function setSession(session) {
  write(session);
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 带会员凭据的 fetch；401 时自动清会话
export async function memberFetch(path, opts = {}) {
  const session = read();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(apiUrl(path), { ...opts, headers });
  if (res.status === 401 && session) write(null);
  return res;
}

// React hook：当前会员会话（登录/登出自动重渲染）
export function useMember() {
  const [session, setSession] = useState(read());
  useEffect(() => onAuthChange(setSession), []);
  return session;
}

export async function memberLogin(email, password) {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'login failed');
  setSession({ token: data.token, customer: data.customer });
  return data.customer;
}

export async function memberRegister(name, email, password) {
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'register failed');
  setSession({ token: data.token, customer: data.customer });
  return data.customer;
}

export async function memberLogout() {
  const session = read();
  if (session?.token) {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => {});
  }
  write(null);
}
