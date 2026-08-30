// 后台管理面板：快递商管理 + 客户/订单/地址/设置（完整表单 CRUD）
import { useCallback, useEffect, useState } from 'react';
import {
  adminLogin, adminListCarriers, adminGetCarrierMeta,
  adminCreateCarrier, adminUpdateCarrier, adminDeleteCarrier, adminTestCarrier,
  adminListCustomers, adminCreateCustomer, adminUpdateCustomer, adminDeleteCustomer,
  adminListAddresses, adminCreateAddress, adminUpdateAddress, adminDeleteAddress,
  adminListOrders, adminCreateOrder, adminUpdateOrder, adminDeleteOrder,
  adminGetSettings, adminUpdateSettings, setAdminToken, quoteCarriers,
} from '../api.js';

const FIELD_LABELS = {
  yuntrack: { appId: 'App ID', appToken: 'App Token' },
  '4px': { appKey: 'App Key', appSecret: 'App Secret' },
  dhl: { apiKey: 'API Key', apiSecret: 'API Secret' },
  ups: { clientId: 'Client ID', clientSecret: 'Client Secret' },
  fedex: { apiKey: 'API Key', apiSecret: 'API Secret' },
  ems: { userId: 'User ID', apiKey: 'API Key' },
};

const MODE_OPTIONS = [
  { id: 'economy', label: '经济' },
  { id: 'standard', label: '标准' },
  { id: 'express', label: '特快' },
];

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const CUSTOMER_STATUSES = ['active', 'inactive'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'HKD', 'SGD', 'KRW'];

const emptyCustomer = { name: '', email: '', phone: '', country: 'US', currency: 'USD', status: 'active', notes: '' };
const emptyAddress = { customerId: '', label: 'Home', recipient: '', line1: '', line2: '', city: '', state: '', postal: '', country: 'US', phone: '', isDefault: false };
const emptyOrder = { customerId: '', addressId: '', status: 'pending', carrier: '', trackingNo: '', currency: 'USD', tipRate: 0, notes: '', items: [{ title: '', price: 0, qty: 1 }] };

export default function AdminPanel({ t }) {
  const [token, setToken] = useState(localStorage.getItem('cb_admin_token') || '');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState('customers');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [carriers, setCarriers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [editing, setEditing] = useState(null);
  const [testing, setTesting] = useState({});

  const [customers, setCustomers] = useState([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [settings, setSettings] = useState({});

  // 编辑状态
  const [customerForm, setCustomerForm] = useState(null); // null = 隐藏
  const [addressForm, setAddressForm] = useState(null);
  const [orderForm, setOrderForm] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  // ===== 登录 =====
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await adminLogin(password);
      setToken(res.token);
    } catch {
      setLoginError(t('admin.loginError') || 'Invalid password');
    }
  };

  const handleLogout = () => {
    setAdminToken(null);
    setToken('');
    setCarriers([]);
  };

  // ===== 数据加载 =====
  const loadAll = useCallback(async () => {
    setBusy(true);
    try {
      const [cs, m, cust, ord, addr, st] = await Promise.all([
        adminListCarriers(),
        adminGetCarrierMeta(),
        adminListCustomers(),
        adminListOrders(),
        adminListAddresses(),
        adminGetSettings(),
      ]);
      setCarriers(cs);
      setMeta(m);
      setCustomers(cust);
      setOrders(ord);
      setAddresses(addr);
      setSettings(st);
    } catch (e) {
      if (e.message === 'unauthorized') setToken('');
      else showNotice(e.message);
    } finally {
      setBusy(false);
    }
  }, [showNotice]);

  useEffect(() => {
    if (token) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const customerById = useCallback((id) => customers.find((c) => c.id === id), [customers]);
  const addressById = useCallback((id) => addresses.find((a) => a.id === id), [addresses]);

  // ===== 快递商操作 =====
  const refreshCarriers = useCallback(async () => {
    const cs = await adminListCarriers();
    setCarriers(cs);
  }, []);

  const saveCarrier = async (data) => {
    try {
      if (editing) await adminUpdateCarrier(editing.id, data);
      else await adminCreateCarrier(data);
      setEditing(null);
      await refreshCarriers();
      showNotice('Saved');
    } catch (e) {
      showNotice(e.message);
    }
  };

  const removeCarrier = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await adminDeleteCarrier(id);
    await refreshCarriers();
    showNotice('Deleted');
  };

  const testCarrier = async (id) => {
    setTesting((x) => ({ ...x, [id]: 'busy' }));
    try {
      const res = await adminTestCarrier(id);
      setTesting((x) => ({ ...x, [id]: res }));
    } catch (e) {
      setTesting((x) => ({ ...x, [id]: { ok: false, message: e.message } }));
    }
  };

  // ===== 报价测试工具 =====
  const [quoteForm, setQuoteForm] = useState({ country: 'US', weightKg: 0.5 });
  const [quoteResult, setQuoteResult] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const runQuote = async () => {
    setQuoteLoading(true);
    setQuoteResult(null);
    try {
      const res = await quoteCarriers({
        country: quoteForm.country.toUpperCase(),
        weightKg: Number(quoteForm.weightKg),
        dims: { lengthCm: 15, widthCm: 10, heightCm: 5 },
        valueUsd: 20,
      });
      setQuoteResult(res);
    } catch (e) {
      setQuoteResult({ error: e.message });
    } finally {
      setQuoteLoading(false);
    }
  };

  // ===== 客户操作 =====
  const saveCustomer = async (data) => {
    try {
      if (data.id) await adminUpdateCustomer(data.id, data);
      else await adminCreateCustomer(data);
      setCustomerForm(null);
      await loadAll();
      showNotice('Saved');
    } catch (e) {
      showNotice(e.message);
    }
  };

  const removeCustomer = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await adminDeleteCustomer(id);
    await loadAll();
    showNotice('Deleted');
  };

  // ===== 地址操作 =====
  const saveAddress = async (data) => {
    try {
      if (data.id) await adminUpdateAddress(data.id, data);
      else await adminCreateAddress(data);
      setAddressForm(null);
      await loadAll();
      showNotice('Saved');
    } catch (e) {
      showNotice(e.message);
    }
  };

  const removeAddress = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await adminDeleteAddress(id);
    await loadAll();
    showNotice('Deleted');
  };

  // ===== 订单操作 =====
  const saveOrder = async (data) => {
    try {
      const payload = { ...data };
      delete payload.id;
      if (data.id) await adminUpdateOrder(data.id, payload);
      else await adminCreateOrder(payload);
      setOrderForm(null);
      setSelectedOrder(null);
      await loadAll();
      showNotice('Saved');
    } catch (e) {
      showNotice(e.message);
    }
  };

  const removeOrder = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    await adminDeleteOrder(id);
    setSelectedOrder(null);
    await loadAll();
    showNotice('Deleted');
  };

  const updateOrderStatus = async (id, status) => {
    await adminUpdateOrder(id, { status });
    await loadAll();
    showNotice('Updated');
  };

  // ===== 设置保存 =====
  const saveSettings = async () => {
    await adminUpdateSettings(settings);
    await loadAll();
    showNotice('Saved');
  };

  if (!token) {
    return (
      <div className="admin-login">
        <div className="card" style={{ maxWidth: 360, margin: '40px auto', padding: 24 }}>
          <h2 className="admin-title">{t('admin.title')}</h2>
          <h3>{t('admin.login')}</h3>
          <form onSubmit={handleLogin}>
            <label className="settings-label" style={{ marginTop: 10 }}>{t('admin.password')}</label>
            <input
              className="settings-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {loginError && <div className="error-text">{loginError}</div>}
            <button type="submit" className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} disabled={busy}>
              {t('admin.loginBtn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {notice && <div className="admin-notice">{notice}</div>}

      <div className="admin-head">
        <h2 className="admin-title">{t('admin.title')}</h2>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>{t('admin.logout')}</button>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>
          {t('admin.customers')}
        </button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          {t('admin.orders')}
        </button>
        <button className={tab === 'addresses' ? 'active' : ''} onClick={() => setTab('addresses')}>
          {t('admin.addresses')}
        </button>
        <button className={tab === 'carriers' ? 'active' : ''} onClick={() => setTab('carriers')}>
          {t('admin.carriers') || 'Carriers'}
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          {t('admin.settings')}
        </button>
      </div>

      {busy && <div className="loading">Loading…</div>}

      {/* ================= 客户管理 ================= */}
      {tab === 'customers' && !busy && (
        <div>
          <div className="admin-section-head">
            <h3>{t('admin.customers')}</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="settings-control"
                style={{ maxWidth: 220 }}
                placeholder={t('admin.search')}
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={() => setCustomerForm({ ...emptyCustomer, _editing: null })}>
                {t('admin.addCustomer') || '新增客户'}
              </button>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.name')}</th><th>{t('admin.email')}</th><th>{t('admin.phone')}</th>
                <th>{t('admin.country')}</th><th>{t('admin.currency')}</th><th>{t('admin.status')}</th><th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers
                .filter((c) => !customerQuery || [c.name, c.email, c.phone, c.country].some((v) => v?.toLowerCase().includes(customerQuery.toLowerCase())))
                .map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b>{c.notes && <div className="muted-note">{c.notes}</div>}</td>
                    <td>{c.email}</td>
                    <td>{c.phone}</td>
                    <td>{c.country}</td>
                    <td>{c.currency}</td>
                    <td><StatusPill value={c.status} /></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setCustomerForm({ ...c, _editing: c })}>{t('admin.edit')}</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => removeCustomer(c.id)}>{t('admin.delete')}</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {customerForm && (
            <CustomerForm
              customers={customers}
              initial={customerForm}
              editing={customerForm._editing}
              onSave={(d) => saveCustomer({ ...d, id: customerForm._editing?.id })}
              onCancel={() => setCustomerForm(null)}
              t={t}
            />
          )}
        </div>
      )}

      {/* ================= 订单管理 ================= */}
      {tab === 'orders' && !busy && (
        <div>
          <div className="admin-section-head">
            <h3>{t('admin.orders')}</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                className="settings-control"
                style={{ maxWidth: 220 }}
                placeholder={t('admin.search')}
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
              />
              <select
                className="settings-control"
                style={{ maxWidth: 160 }}
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
              >
                <option value="">全部</option>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => setOrderForm({ ...emptyOrder, _editing: null })}>
                {t('admin.addOrder') || '新增订单'}
              </button>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.orderNo')}</th><th>{t('admin.customerInfo')}</th><th>{t('admin.items')}</th>
                <th>{t('admin.total')}</th><th>{t('admin.status')}</th><th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .filter((o) => !orderStatusFilter || o.status === orderStatusFilter)
                .filter((o) => !orderQuery || (o.orderNo || '').toLowerCase().includes(orderQuery.toLowerCase()) || (o.trackingNo || '').toLowerCase().includes(orderQuery.toLowerCase()))
                .map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.orderNo}</b><br /><small>{o.createdAt?.slice(0, 10)}</small></td>
                    <td>{o.customer?.name || o.customerId}<br /><small>{o.customer?.email || ''}</small></td>
                    <td>{(o.items || []).length} 件</td>
                    <td>{o.totalCurrency} {o.currency}</td>
                    <td><StatusPill value={o.status} /></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(o)}>{t('admin.view') || '查看'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setOrderForm({ ...o, _editing: o })}>{t('admin.edit')}</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => removeOrder(o.id)}>{t('admin.delete')}</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {selectedOrder && !orderForm && (
            <OrderDetail
              order={selectedOrder}
              customer={customerById(selectedOrder.customerId)}
              address={addressById(selectedOrder.addressId)}
              onStatus={(s) => updateOrderStatus(selectedOrder.id, s)}
              onClose={() => setSelectedOrder(null)}
              t={t}
            />
          )}

          {orderForm && (
            <OrderForm
              customers={customers}
              addresses={addresses}
              initial={orderForm}
              editing={orderForm._editing}
              onSave={(d) => saveOrder({ ...d, id: orderForm._editing?.id })}
              onCancel={() => setOrderForm(null)}
              t={t}
            />
          )}
        </div>
      )}

      {/* ================= 地址管理 ================= */}
      {tab === 'addresses' && !busy && (
        <div>
          <div className="admin-section-head">
            <h3>{t('admin.addresses')}</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setAddressForm({ ...emptyAddress, _editing: null })}>
              {t('admin.addAddress') || '新增地址'}
            </button>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.name')}</th><th>{t('admin.customerInfo')}</th><th>地址</th>
                <th>{t('admin.phone')}</th><th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((a) => {
                const cust = customerById(a.customerId);
                return (
                  <tr key={a.id}>
                    <td><b>{a.recipient}</b> {a.isDefault ? '(default)' : ''}<br /><small>{a.label}</small></td>
                    <td>{cust?.name || a.customerId}</td>
                    <td>{[a.line1, a.line2, a.city, a.state, a.postal, a.country].filter(Boolean).join(', ')}</td>
                    <td>{a.phone}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAddressForm({ ...a, _editing: a })}>{t('admin.edit')}</button>
                      <button className="btn btn-ghost btn-sm danger" onClick={() => removeAddress(a.id)}>{t('admin.delete')}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {addressForm && (
            <AddressForm
              customers={customers}
              initial={addressForm}
              editing={addressForm._editing}
              onSave={(d) => saveAddress({ ...d, id: addressForm._editing?.id })}
              onCancel={() => setAddressForm(null)}
              t={t}
            />
          )}
        </div>
      )}

      {/* ================= 快递商管理 ================= */}
      {tab === 'carriers' && !busy && (
        <div>
          <div className="admin-section-head">
            <h3>{t('admin.carriers') || '国际快递商户对接'}</h3>
            <span className="admin-hint">
              在后台填写各快递公司 API 密钥；报价时自动并行询价并推荐最低成本快递。未配置密钥时使用估算模式。
            </span>
          </div>

          <div className="carrier-grid">
            {carriers.map((c) => {
              const fields = meta?.adapters?.[c.code]?.fields || [];
              return (
                <div className="card carrier-card" key={c.id}>
                  <div className="carrier-card-head">
                    <b>{c.name}</b>
                    <span className={`carrier-status ${c.enabled ? 'good' : ''}`}>
                      {c.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="carrier-card-meta">
                    <span className="pill">{c.code}</span>
                    <span className="pill">{MODE_OPTIONS.find((m) => m.id === c.mode)?.label || c.mode}</span>
                    {c.hasRealConfig
                      ? <span className="pill good">{t('admin.connected') || 'API 已配置'}</span>
                      : <span className="pill">{t('admin.estimateMode') || '估算模式'}</span>}
                  </div>
                  <div className="carrier-fields">
                    {fields.map((f) => (
                      <div key={f} className="field-row">
                        <span>{FIELD_LABELS[c.code]?.[f] || f}</span>
                        <code>{c[f] || '未填写'}</code>
                      </div>
                    ))}
                    <div className="field-row">
                      <span>加价率</span>
                      <code>{((c.markupRate || 0) * 100).toFixed(0)}%</code>
                    </div>
                  </div>

                  <div className="carrier-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>{t('admin.edit')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => testCarrier(c.id)}>
                      {t('admin.testConnection') || '测试连接'}
                    </button>
                    <button className="btn btn-ghost btn-sm danger" onClick={() => removeCarrier(c.id)}>{t('admin.delete')}</button>
                  </div>
                  {testing[c.id] && testing[c.id] !== 'busy' && (
                    <div className={`test-result ${testing[c.id].ok ? 'good' : 'bad'}`}>
                      {testing[c.id].ok ? 'OK' : testing[c.id].message} ({testing[c.id].latencyMs ?? ''}ms)
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 编辑 / 新增表单 */}
          <div className="card admin-form">
            <h4>{editing ? `${t('admin.edit')} ${editing.name}` : (t('admin.addCarrier') || '添加快递商')}</h4>
            <CarrierForm meta={meta} editing={editing} onSave={saveCarrier} onCancel={() => setEditing(null)} t={t} />
          </div>

          {/* 报价测试工具 */}
          <div className="card admin-form">
            <h4>{t('admin.quoteTester') || '快递报价测试'}</h4>
            <div className="quote-tester">
              <label className="settings-label">{t('settings.deliveryCountry')}</label>
              <input
                className="settings-control"
                value={quoteForm.country}
                onChange={(e) => setQuoteForm({ ...quoteForm, country: e.target.value })}
                maxLength={2}
              />
              <label className="settings-label">重量 (kg)</label>
              <input
                className="settings-control"
                type="number"
                step="0.1"
                value={quoteForm.weightKg}
                onChange={(e) => setQuoteForm({ ...quoteForm, weightKg: e.target.value })}
              />
              <button className="btn btn-primary" onClick={runQuote} disabled={quoteLoading}>
                {quoteLoading ? '…' : '询价'}
              </button>
            </div>
            {quoteResult && (
              <div className="quote-result">
                {quoteResult.error ? (
                  <div className="error-text">{quoteResult.error}</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>快递</th><th>渠道</th><th>运费 (USD)</th><th>时效</th><th>来源</th><th>推荐</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteResult.quotes.map((q) => (
                        <tr key={q.carrier}>
                          <td><b>{q.carrierName}</b></td>
                          <td>{q.productName}</td>
                          <td>{q.priceUsd.toFixed(2)}</td>
                          <td>{q.daysMin}-{q.daysMax} 天</td>
                          <td>{q.source === 'api' ? 'API' : '估算'}</td>
                          <td>{q.recommended ? '★ BEST' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 系统设置 ================= */}
      {tab === 'settings' && !busy && (
        <div>
          <div className="admin-section-head">
            <h3>{t('admin.settings')}</h3>
          </div>
          <div className="card admin-form">
            <label className="settings-label">{t('admin.minServiceFee')}</label>
            <input
              className="settings-control"
              type="number"
              step="0.01"
              value={settings.minServiceFeeRate || 0}
              onChange={(e) => setSettings({ ...settings, minServiceFeeRate: Number(e.target.value) })}
            />
            <label className="settings-label" style={{ marginTop: 12 }}>{t('admin.tipOptions')}</label>
            <input
              className="settings-control"
              value={(settings.defaultTipOptions || []).join(',')}
              onChange={(e) => setSettings({ ...settings, defaultTipOptions: e.target.value.split(',').map(Number).filter((n) => !Number.isNaN(n)) })}
            />
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveSettings}>{t('admin.saveSettings')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 客户表单 =====
function CustomerForm({ initial, editing, onSave, onCancel, t }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.name) return;
    onSave({ name: form.name, email: form.email || '', phone: form.phone || '', country: form.country || 'US', currency: form.currency || 'USD', status: form.status || 'active', notes: form.notes || '' });
  };
  return (
    <div className="card admin-form">
      <h4>{editing ? `${t('admin.edit')} ${form.name}` : (t('admin.addCustomer') || '新增客户')}</h4>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div>
            <label className="settings-label">{t('admin.name')} *</label>
            <input className="settings-control" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="settings-label">{t('admin.email')}</label>
            <input className="settings-control" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className="settings-label">{t('admin.phone')}</label>
            <input className="settings-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="settings-label">{t('admin.country')}</label>
            <input className="settings-control" value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={2} />
          </div>
          <div>
            <label className="settings-label">{t('admin.currency')}</label>
            <select className="settings-control" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="settings-label">{t('admin.status')}</label>
            <select className="settings-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-grid-full">
            <label className="settings-label">备注</label>
            <textarea className="settings-control" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="submit" className="btn btn-primary">{t('admin.save')}</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('admin.cancel')}</button>
        </div>
      </form>
    </div>
  );
}

// ===== 地址表单 =====
function AddressForm({ customers, initial, editing, onSave, onCancel, t }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.customerId || !form.recipient || !form.line1) return;
    onSave({ customerId: form.customerId, label: form.label || 'Home', recipient: form.recipient, line1: form.line1, line2: form.line2 || '', city: form.city || '', state: form.state || '', postal: form.postal || '', country: form.country || 'US', phone: form.phone || '', isDefault: !!form.isDefault });
  };
  return (
    <div className="card admin-form">
      <h4>{editing ? `${t('admin.edit')} ${form.recipient}` : (t('admin.addAddress') || '新增地址')}</h4>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div>
            <label className="settings-label">所属客户 *</label>
            <select className="settings-control" value={form.customerId} onChange={(e) => set('customerId', e.target.value)} required>
              <option value="">选择客户</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email || c.id})</option>)}
            </select>
          </div>
          <div>
            <label className="settings-label">地址标签</label>
            <input className="settings-control" value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="Home / Office" />
          </div>
          <div>
            <label className="settings-label">收件人 *</label>
            <input className="settings-control" value={form.recipient} onChange={(e) => set('recipient', e.target.value)} required />
          </div>
          <div>
            <label className="settings-label">{t('admin.phone')}</label>
            <input className="settings-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="form-grid-full">
            <label className="settings-label">地址行 1 *</label>
            <input className="settings-control" value={form.line1} onChange={(e) => set('line1', e.target.value)} required />
          </div>
          <div className="form-grid-full">
            <label className="settings-label">地址行 2</label>
            <input className="settings-control" value={form.line2} onChange={(e) => set('line2', e.target.value)} />
          </div>
          <div>
            <label className="settings-label">城市</label>
            <input className="settings-control" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div>
            <label className="settings-label">州 / 省</label>
            <input className="settings-control" value={form.state} onChange={(e) => set('state', e.target.value)} />
          </div>
          <div>
            <label className="settings-label">邮编</label>
            <input className="settings-control" value={form.postal} onChange={(e) => set('postal', e.target.value)} />
          </div>
          <div>
            <label className="settings-label">{t('admin.country')}</label>
            <input className="settings-control" value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={2} />
          </div>
          <div className="form-grid-full">
            <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
              设为默认地址
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="submit" className="btn btn-primary">{t('admin.save')}</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('admin.cancel')}</button>
        </div>
      </form>
    </div>
  );
}

// ===== 订单表单 =====
function OrderForm({ customers, addresses, initial, editing, onSave, onCancel, t }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm((f) => {
    const items = (f.items || []).map((it, idx) => (idx === i ? { ...it, [k]: v } : it));
    return { ...f, items };
  });
  const addItem = () => setForm((f) => ({ ...f, items: [...(f.items || []), { title: '', price: 0, qty: 1 }] }));
  const removeItem = (i) => setForm((f) => ({ ...f, items: (f.items || []).filter((_, idx) => idx !== i) }));
  const addressesForCustomer = addresses.filter((a) => a.customerId === form.customerId);

  const submit = (e) => {
    e.preventDefault();
    if (!form.customerId || !form.addressId) return;
    onSave({
      customerId: form.customerId,
      addressId: form.addressId,
      items: (form.items || []).filter((it) => it.title).map((it) => ({ title: it.title, price: Number(it.price) || 0, qty: Number(it.qty) || 1 })),
      status: form.status || 'pending',
      currency: form.currency || 'USD',
      carrier: form.carrier || '',
      trackingNo: form.trackingNo || '',
      tipRate: Number(form.tipRate) || 0,
      notes: form.notes || '',
    });
  };

  return (
    <div className="card admin-form">
      <h4>{editing ? `${t('admin.edit')} ${form.orderNo || ''}`.trim() : (t('admin.addOrder') || '新增订单')}</h4>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div>
            <label className="settings-label">客户 *</label>
            <select className="settings-control" value={form.customerId} onChange={(e) => { set('customerId', e.target.value); set('addressId', ''); }} required>
              <option value="">选择客户</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email || c.id})</option>)}
            </select>
          </div>
          <div>
            <label className="settings-label">送货地址 *</label>
            <select className="settings-control" value={form.addressId} onChange={(e) => set('addressId', e.target.value)} required>
              <option value="">选择地址</option>
              {addressesForCustomer.map((a) => (
                <option key={a.id} value={a.id}>{a.label || 'Home'} · {a.recipient}, {[a.city, a.country].filter(Boolean).join(', ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="settings-label">状态</label>
            <select className="settings-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="settings-label">币种</label>
            <select className="settings-control" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="settings-label">快递</label>
            <input className="settings-control" value={form.carrier} onChange={(e) => set('carrier', e.target.value)} placeholder="云途专线" />
          </div>
          <div>
            <label className="settings-label">运单号</label>
            <input className="settings-control" value={form.trackingNo} onChange={(e) => set('trackingNo', e.target.value)} />
          </div>
          <div>
            <label className="settings-label">打赏比例 (%)</label>
            <input className="settings-control" type="number" step="1" value={form.tipRate} onChange={(e) => set('tipRate', e.target.value)} />
          </div>
          <div className="form-grid-full">
            <label className="settings-label">备注</label>
            <textarea className="settings-control" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="order-items-head">
          <span>订单商品</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>+ 添加商品</button>
        </div>
        {(form.items || []).map((it, i) => (
          <div className="order-item-row" key={i}>
            <input className="settings-control" placeholder="商品名称" value={it.title} onChange={(e) => setItem(i, 'title', e.target.value)} />
            <input className="settings-control" type="number" step="0.01" placeholder="单价" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} style={{ maxWidth: 110 }} />
            <input className="settings-control" type="number" step="1" placeholder="数量" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} style={{ maxWidth: 80 }} />
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => removeItem(i)}>✕</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="submit" className="btn btn-primary">{t('admin.save')}</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('admin.cancel')}</button>
        </div>
      </form>
    </div>
  );
}

// ===== 订单详情 =====
function OrderDetail({ order, customer, address, onStatus, onClose, t }) {
  return (
    <div className="card admin-form">
      <div className="admin-section-head">
        <h4>订单详情 · {order.orderNo}</h4>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('admin.cancel')}</button>
      </div>
      <div className="order-detail-grid">
        <div>
          <div className="detail-label">客户</div>
          <div>{customer?.name || order.customerId}</div>
          <div className="muted-note">{customer?.email || ''} {customer?.phone ? `· ${customer.phone}` : ''}</div>
        </div>
        <div>
          <div className="detail-label">送货地址</div>
          {address
            ? <div>{[address.recipient, address.line1, address.line2, address.city, address.state, address.postal, address.country].filter(Boolean).join(', ')}</div>
            : <div>—</div>}
        </div>
        <div>
          <div className="detail-label">快递 / 运单号</div>
          <div>{order.carrier || '—'} {order.trackingNo && `/ ${order.trackingNo}`}</div>
        </div>
        <div>
          <div className="detail-label">状态</div>
          <select className="settings-control" value={order.status} onChange={(e) => onStatus(e.target.value)}>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <table className="admin-table" style={{ marginTop: 12 }}>
        <thead>
          <tr><th>商品</th><th>单价</th><th>数量</th><th>小计</th></tr>
        </thead>
        <tbody>
          {(order.items || []).map((it, i) => (
            <tr key={i}>
              <td>{it.title}</td>
              <td>{it.price}</td>
              <td>{it.qty}</td>
              <td>{((Number(it.price) || 0) * (Number(it.qty) || 1)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="order-detail-total">
        合计: <b>{order.totalCurrency || order.totalCny || '—'} {order.currency}</b>
        {order.notes && <div className="muted-note">备注: {order.notes}</div>}
      </div>
    </div>
  );
}

// ===== 状态胶囊 =====
function StatusPill({ value }) {
  const cls = {
    active: 'good',
    delivered: 'good',
    processing: '',
    shipped: '',
    pending: 'warn',
    cancelled: 'bad',
    inactive: 'bad',
  }[value] || '';
  return <span className={`status-pill ${cls}`}>{value}</span>;
}

// ===== 快递商表单 =====
function CarrierForm({ meta, editing, onSave, onCancel, t }) {
  const [code, setCode] = useState(editing?.code || '');
  const [name, setName] = useState(editing?.name || '');
  const [mode, setMode] = useState(editing?.mode || 'standard');
  const [markupRate, setMarkupRate] = useState((editing?.markupRate || 0) * 100);
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [fields, setFields] = useState({});

  const fieldNames = meta?.adapters?.[code]?.fields || [];
  const codeOptions = Object.keys(meta?.adapters || {});

  const submit = (e) => {
    e.preventDefault();
    const data = { code, name, mode, markupRate: markupRate / 100, enabled, ...fields };
    onSave(data);
  };

  return (
    <form onSubmit={submit}>
      <div className="quote-tester">
        <div>
          <label className="settings-label">Code</label>
          <select
            className="settings-control"
            value={code}
            disabled={!!editing}
            onChange={(e) => {
              setCode(e.target.value);
              setFields({});
            }}
          >
            <option value="">选择快递公司</option>
            {codeOptions.map((c) => (
              <option key={c} value={c}>{meta.adapters[c].name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="settings-label">{t('admin.name')}</label>
          <input className="settings-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="自定义名称" />
        </div>
        <div>
          <label className="settings-label">时效档位</label>
          <select className="settings-control" value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODE_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="settings-label">加价率 (%)</label>
          <input className="settings-control" type="number" step="1" value={markupRate} onChange={(e) => setMarkupRate(Number(e.target.value))} />
        </div>
        <div>
          <label className="settings-label">启用</label>
          <select className="settings-control" value={enabled ? '1' : '0'} onChange={(e) => setEnabled(e.target.value === '1')}>
            <option value="1">是</option>
            <option value="0">否</option>
          </select>
        </div>
      </div>

      {fieldNames.length > 0 && (
        <div className="quote-tester" style={{ marginTop: 10 }}>
          {fieldNames.map((f) => (
            <div key={f}>
              <label className="settings-label">{FIELD_LABELS[code]?.[f] || f}</label>
              <input
                className="settings-control"
                type="password"
                value={fields[f] || ''}
                placeholder={editing && editing[f] ? '已配置（留空保持不变）' : '输入 API ' + f}
                onChange={(e) => setFields({ ...fields, [f]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="submit" className="btn btn-primary">{t('admin.save')}</button>
        {editing && <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('admin.cancel')}</button>}
      </div>
    </form>
  );
}
