import { useState, useEffect, useCallback } from 'react';
import { useMember, memberFetch, memberLogin, memberRegister, memberLogout } from '../authStore.js';

// 会员中心（WooCommerce My Account 对齐）
// 未登录：Login / Register 两栏；登录后：Dashboard / Orders / Addresses / Account details / Logout
const NAV = [
  ['dashboard', 'account.dashboard', 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10'],
  ['orders', 'account.orders', 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8'],
  ['addresses', 'account.addresses', 'M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z'],
  ['details', 'account.details', 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0'],
];

const emptyAddress = { label: '', recipient: '', line1: '', line2: '', city: '', state: '', postal: '', country: '', phone: '', isDefault: false };

function NavIcon({ d }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function statusPill(status, t) {
  const cls = { shipped: 'pill good', completed: 'pill good', processing: 'pill warn', pending: 'pill warn', cancelled: 'pill' }[status] || 'pill';
  return <span className={cls}>{t(`account.status.${status}`) !== `account.status.${status}` ? t(`account.status.${status}`) : status}</span>;
}

function fmt(n, symbol, currency) {
  if (n == null) return '—';
  return `${symbol || currency || ''}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AccountPage({ t, lang }) {
  const session = useMember();
  const [mode, setMode] = useState('login'); // login | register
  const [tab, setTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [orders, setOrders] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [addrForm, setAddrForm] = useState(null); // null | {id?, ...fields}
  const [detailForm, setDetailForm] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadOrders = useCallback(async () => {
    setOrders(null);
    const res = await memberFetch('/api/auth/orders');
    if (res.ok) setOrders(await res.json());
  }, []);
  const loadAddresses = useCallback(async () => {
    setAddresses(null);
    const res = await memberFetch('/api/auth/addresses');
    if (res.ok) setAddresses(await res.json());
  }, []);

  useEffect(() => {
    if (!session) return;
    loadOrders();
    loadAddresses();
    setDetailForm(null);
  }, [session, loadOrders, loadAddresses]);

  const submitAuth = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await memberLogin(form.email, form.password);
      else await memberRegister(form.name, form.email, form.password);
      setForm({ name: '', email: '', password: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openOrderDetail = async (id) => {
    setOpenOrder(id);
    setOrderDetail(null);
    const res = await memberFetch(`/api/auth/orders/${id}`);
    if (res.ok) setOrderDetail(await res.json());
  };

  const saveAddress = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const a = addrForm;
      const body = JSON.stringify({ ...a, isDefault: !!a.isDefault });
      const res = await memberFetch(a.id ? `/api/auth/addresses/${a.id}` : '/api/auth/addresses', {
        method: a.id ? 'PUT' : 'POST',
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      setAddrForm(null);
      loadAddresses();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (id) => {
    await memberFetch(`/api/auth/addresses/${id}`, { method: 'DELETE' });
    loadAddresses();
  };

  const setDefaultAddress = async (id) => {
    await memberFetch(`/api/auth/addresses/${id}/default`, { method: 'POST' });
    loadAddresses();
  };

  const saveDetails = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { ...detailForm };
      if (!body.newPassword) {
        delete body.newPassword;
        delete body.currentPassword;
      }
      const res = await memberFetch('/api/auth/me', { method: 'PUT', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      const { setSession, getSession } = await import('../authStore.js');
      setSession({ ...(getSession() || {}), customer: data });
      setDetailForm(null);
      setTab('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- 未登录：Login / Register ----------
  if (!session) {
    return (
      <div className="account-wrap">
        <div className="account-hero account-hero-guest">
          <div className="track-hero-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />
            </svg>
          </div>
          <h2>{t('account.title')}</h2>
          <p>{t('account.loginHint')}</p>
        </div>
        <div className="card account-auth-card">
          <div className="account-auth-tabs">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>{t('account.signIn')}</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>{t('account.register')}</button>
          </div>
          <form onSubmit={submitAuth} className="account-auth-form">
            {mode === 'register' && (
              <label className="settings-label">
                {t('account.name')}
                <input className="settings-control" required value={form.name} onChange={(e) => set('name', e.target.value)} />
              </label>
            )}
            <label className="settings-label">
              {t('account.email')}
              <input className="settings-control" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>
            <label className="settings-label">
              {t('account.password')}
              <input className="settings-control" type="password" required minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)} />
            </label>
            {error && <div className="account-error">{error}</div>}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? t('account.working') : mode === 'login' ? t('account.signIn') : t('account.register')}
            </button>
            {mode === 'register' && <p className="muted account-hint">{t('account.registerHint')}</p>}
          </form>
        </div>
      </div>
    );
  }

  const customer = session.customer || {};
  const shownOrders = (orders || []).slice(0, tab === 'dashboard' ? 3 : undefined);
  const displayName = customer.name || customer.email || '';
  const initial = (customer.name || customer.email || '?').charAt(0).toUpperCase();

  // ---------- 登录后：My Account ----------
  return (
    <div className="account-wrap">
      <div className="account-hero-banner">
        <div className="account-hero-avatar" aria-hidden="true">{initial}</div>
        <div className="account-hero-info">
          <h2>{t('account.greeting', { name: displayName })}</h2>
          <p>{customer.email}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm account-hero-logout" onClick={async () => { await memberLogout(); setTab('dashboard'); }}>
          {t('account.logout')}
        </button>
      </div>

      <div className="account-layout">
        <nav className="account-nav card">
          {NAV.map(([key, label, icon]) => (
            <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setOpenOrder(null); setError(''); }}>
              <NavIcon d={icon} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>

        <div className="account-content">
          {error && <div className="account-error">{error}</div>}

          {tab === 'dashboard' && (
            <div className="account-dash">
              <div className="account-stat-grid">
                <div className="card account-stat-card">
                  <span className="account-stat-value">{orders ? orders.length : '—'}</span>
                  <span className="account-stat-label">{t('account.orders')}</span>
                </div>
                <div className="card account-stat-card">
                  <span className="account-stat-value">{addresses ? addresses.length : '—'}</span>
                  <span className="account-stat-label">{t('account.addresses')}</span>
                </div>
              </div>
              <div className="card account-card">
                <p className="muted">{t('account.dashboardHint')}</p>
                <h4>{t('account.recentOrders')}</h4>
              {orders && orders.length === 0 && <p className="muted">{t('account.noOrders')}</p>}
              {shownOrders && shownOrders.length > 0 && (
                <table className="account-table">
                  <thead>
                    <tr><th>{t('account.order')}</th><th>{t('account.date')}</th><th>{t('account.statusLabel')}</th><th>{t('account.total')}</th><th /></tr>
                  </thead>
                  <tbody>
                    {shownOrders.map((o) => (
                      <tr key={o.id}>
                        <td><button type="button" className="account-link" onClick={() => { setTab('orders'); openOrderDetail(o.id); }}>{o.orderNo}</button></td>
                        <td>{String(o.createdAt || '').slice(0, 10)}</td>
                        <td>{statusPill(o.status, t)}</td>
                        <td>{fmt(o.total, '', o.currency)} {o.currency}</td>
                        <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTab('orders'); openOrderDetail(o.id); }}>{t('account.view')}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="card account-card">
              {openOrder && orderDetail ? (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenOrder(null)}>← {t('account.backToOrders')}</button>
                  <div className="account-order-summary">
                    <div>
                      <div className="account-order-no">{orderDetail.orderNo} {statusPill(orderDetail.status, t)}</div>
                      <p className="muted">{orderDetail.createdAt && String(orderDetail.createdAt).slice(0, 10)}{orderDetail.carrier ? ` · ${orderDetail.carrier} · ${orderDetail.daysMin}-${orderDetail.daysMax} ${t('result.days')}` : ''}</p>
                    </div>
                    <div className="account-order-total">
                      <span className="account-order-total-value">{orderDetail.currency} {fmt(orderDetail.breakdown?.total, '', '')}</span>
                    </div>
                  </div>
                  <table className="account-table">
                    <thead><tr><th>{t('account.item')}</th><th>{t('order.quantity')}</th><th>{t('account.total')}</th></tr></thead>
                    <tbody>
                      {orderDetail.items.map((it, i) => (
                        <tr key={i}><td>{it.title}</td><td>x{it.quantity}</td><td>{fmt(it.price * it.quantity, '', 'CNY')} CNY</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {orderDetail.parcels.length > 0 && (
                    <>
                      <h4>{t('track.parcels', { count: orderDetail.parcels.length })}</h4>
                      {orderDetail.parcels.map((pc, i) => (
                        <div className="account-parcel" key={i}>
                          <b>{pc.trackingNo || '—'}</b>
                          <span className="muted">{[pc.carrier, pc.productName].filter(Boolean).join(' · ')}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {orderDetail.parcels.length === 0 && (orderDetail.shipmentPreview?.expectedParcels || 0) > 1 && (
                    <p className="muted">{t('track.warehouseSplitPreview', { n: orderDetail.shipmentPreview.expectedParcels, warehouses: (orderDetail.shipmentPreview.warehouses || []).join(' / ') })}</p>
                  )}
                  <h4>{t('account.breakdown')}</h4>
                  <table className="account-table account-breakdown">
                    <tbody>
                      <tr><td>{t('result.shipping')}</td><td>{fmt(orderDetail.breakdown.shippingCny, '¥', 'CNY')}</td></tr>
                      <tr><td>{t('result.duty')}</td><td>{fmt(orderDetail.breakdown.dutyCny, '¥', 'CNY')}</td></tr>
                      <tr><td>{t('result.vat')}</td><td>{fmt(orderDetail.breakdown.vatCny, '¥', 'CNY')}</td></tr>
                      <tr><td>{t('result.serviceFee')}</td><td>{fmt(orderDetail.breakdown.serviceFeeCny, '¥', 'CNY')}</td></tr>
                      <tr className="account-total-row"><td>{t('account.total')}</td><td>{fmt(orderDetail.breakdown.total, '', orderDetail.currency)} {orderDetail.currency}</td></tr>
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  <h4>{t('account.orders')}</h4>
                  {orders === null && <p className="loading">...</p>}
                  {orders && orders.length === 0 && <p className="muted">{t('account.noOrders')}</p>}
                  {orders && orders.length > 0 && (
                    <table className="account-table">
                      <thead>
                        <tr><th>{t('account.order')}</th><th>{t('account.date')}</th><th>{t('account.statusLabel')}</th><th>{t('account.parcels')}</th><th>{t('account.total')}</th><th /></tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr key={o.id}>
                            <td><button type="button" className="account-link" onClick={() => openOrderDetail(o.id)}>{o.orderNo}</button></td>
                            <td>{String(o.createdAt || '').slice(0, 10)}</td>
                            <td>{statusPill(o.status, t)}</td>
                            <td>{o.parcelsCount || '—'}</td>
                            <td>{fmt(o.total, '', o.currency)} {o.currency}</td>
                            <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => openOrderDetail(o.id)}>{t('account.view')}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'addresses' && (
            <div className="card account-card">
              <div className="account-addr-head">
                <h4>{t('account.addresses')}</h4>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddrForm({ ...emptyAddress })}>{t('account.addAddress')}</button>
              </div>
              {addresses === null && <p className="loading">...</p>}
              {addresses && addresses.length === 0 && !addrForm && <p className="muted">{t('account.noAddresses')}</p>}
              <div className="account-addr-grid">
                {(addresses || []).map((a) => (
                  <div className="account-addr-card" key={a.id}>
                    <div className="account-addr-label">
                      {a.label || 'Home'}
                      {a.isDefault && <span className="pill good">{t('account.default')}</span>}
                    </div>
                    <div>{a.recipient}</div>
                    <div className="muted">{[a.line1, a.line2, a.city, a.state, a.postal, a.country].filter(Boolean).join(', ')}</div>
                    <div className="muted">{a.phone}</div>
                    <div className="account-addr-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddrForm({ ...a })}>{t('account.edit')}</button>
                      {!a.isDefault && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDefaultAddress(a.id)}>{t('account.setDefault')}</button>}
                      <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => removeAddress(a.id)}>{t('account.delete')}</button>
                    </div>
                  </div>
                ))}
              </div>
              {addrForm && (
                <form onSubmit={saveAddress} className="account-addr-form">
                  <h4>{addrForm.id ? t('account.editAddress') : t('account.addAddress')}</h4>
                  <div className="form-grid">
                    <label className="settings-label">{t('account.addrLabel')}
                      <input className="settings-control" value={addrForm.label} onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.recipient')}
                      <input className="settings-control" value={addrForm.recipient} onChange={(e) => setAddrForm((f) => ({ ...f, recipient: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.line1')} *
                      <input className="settings-control" required value={addrForm.line1} onChange={(e) => setAddrForm((f) => ({ ...f, line1: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.line2')}
                      <input className="settings-control" value={addrForm.line2} onChange={(e) => setAddrForm((f) => ({ ...f, line2: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.city')} *
                      <input className="settings-control" required value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.state')}
                      <input className="settings-control" value={addrForm.state} onChange={(e) => setAddrForm((f) => ({ ...f, state: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.postal')}
                      <input className="settings-control" value={addrForm.postal} onChange={(e) => setAddrForm((f) => ({ ...f, postal: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.country')} *
                      <input className="settings-control" required maxLength={2} style={{ textTransform: 'uppercase' }} placeholder="GB" value={addrForm.country} onChange={(e) => setAddrForm((f) => ({ ...f, country: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.phone')}
                      <input className="settings-control" value={addrForm.phone} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} />
                    </label>
                  </div>
                  <label className="account-check">
                    <input type="checkbox" checked={!!addrForm.isDefault} onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                    {t('account.setDefault')}
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary btn-sm" disabled={busy}>{t('account.save')}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddrForm(null)}>{t('account.cancel')}</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'details' && (
            <div className="card account-card">
              <h4>{t('account.details')}</h4>
              {detailForm === null && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailForm({ name: customer.name || '', phone: customer.phone || '', country: customer.country || '', currentPassword: '', newPassword: '' })}>
                  {t('account.edit')}
                </button>
              )}
              {detailForm !== null && (
                <form onSubmit={saveDetails} className="account-addr-form">
                  <div className="form-grid">
                    <label className="settings-label">{t('account.name')}
                      <input className="settings-control" value={detailForm.name} onChange={(e) => setDetailForm((f) => ({ ...f, name: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.email')}
                      <input className="settings-control" value={customer.email || ''} disabled />
                    </label>
                    <label className="settings-label">{t('account.phone')}
                      <input className="settings-control" value={detailForm.phone} onChange={(e) => setDetailForm((f) => ({ ...f, phone: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.country')}
                      <input className="settings-control" maxLength={2} style={{ textTransform: 'uppercase' }} value={detailForm.country} onChange={(e) => setDetailForm((f) => ({ ...f, country: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.currentPassword')}
                      <input className="settings-control" type="password" value={detailForm.currentPassword} onChange={(e) => setDetailForm((f) => ({ ...f, currentPassword: e.target.value }))} />
                    </label>
                    <label className="settings-label">{t('account.newPassword')}
                      <input className="settings-control" type="password" minLength={6} value={detailForm.newPassword} onChange={(e) => setDetailForm((f) => ({ ...f, newPassword: e.target.value }))} />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary btn-sm" disabled={busy}>{t('account.save')}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailForm(null)}>{t('account.cancel')}</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
