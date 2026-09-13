// 后台管理面板：快递商管理 + 客户/订单/地址/设置（完整表单 CRUD）
import { useCallback, useEffect, useState } from 'react';
import {
  adminLogin, adminListCarriers, adminGetCarrierMeta,
  adminCreateCarrier, adminUpdateCarrier, adminDeleteCarrier, adminTestCarrier,
  adminListCustomers, adminCreateCustomer, adminUpdateCustomer, adminDeleteCustomer,
  adminListAddresses, adminCreateAddress, adminUpdateAddress, adminDeleteAddress,
  adminListOrders, adminCreateOrder, adminUpdateOrder, adminDeleteOrder,
  adminGetSettings, adminUpdateSettings, setAdminToken, quoteCarriers,
  adminGetProfile, adminUpdateProfile, adminUpdatePassword, adminVerify,
  adminListAdmins, adminCreateAdmin, adminUpdateAdmin, adminDeleteAdmin,
  adminAddOrderNote,
} from '../api.js';

const FIELD_LABELS = {
  yuntrack: { appId: 'App ID', appToken: 'App Token' },
  '4px': { appKey: 'App Key', appSecret: 'App Secret' },
  dhl: { apiKey: 'API Key', apiSecret: 'API Secret' },
  ups: { clientId: 'Client ID', clientSecret: 'Client Secret' },
  fedex: { apiKey: 'API Key', apiSecret: 'API Secret' },
  ems: { userId: 'User ID', apiKey: 'API Key' },
  ptdsgj: { token: 'API Token', pickupZone: '收货区域' },
  zjhygj: { account: '账号', password: '密码', branchId: '租户 ID（branchId）' },
};

const MODE_OPTIONS = [
  { id: 'economy', label: '经济' },
  { id: 'standard', label: '标准' },
  { id: 'express', label: '特快' },
];

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const CUSTOMER_STATUSES = ['active', 'inactive'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'HKD', 'SGD', 'KRW'];

const emptyCustomer = { name: '', email: '', phone: '', country: 'US', currency: 'USD', status: 'active', notes: '' };
const emptyAddress = { customerId: '', label: 'Home', recipient: '', line1: '', line2: '', city: '', state: '', postal: '', country: 'US', phone: '', isDefault: false };
const emptyOrder = { customerId: '', addressId: '', status: 'pending', carrier: '', trackingNo: '', currency: 'USD', tipRate: 0, notes: '', items: [{ title: '', price: 0, qty: 1 }] };

export default function AdminPanel({ t }) {
  const [token, setToken] = useState(localStorage.getItem('cb_admin_token') || '');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('operator');
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
      const res = await adminLogin(username || 'admin', password);
      setToken(res.token);
      setRole(res.role || 'operator');
      setUsername(res.username || 'admin');
    } catch {
      setLoginError(t('admin.loginError') || 'Invalid username or password');
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
    if (token) {
      // 恢复角色与用户名（刷新页面后 localStorage 只有 token）
      adminVerify()
        .then((d) => {
          setRole(d.role || 'operator');
          setUsername(d.username || 'admin');
        })
        .catch(() => setToken(''));
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // WooCommerce 后台行为：每次切换页面都重新拉取最新数据
  const switchTab = useCallback((next) => {
    setTab(next);
    loadAll();
  }, [loadAll]);

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

  const addOrderNote = async (id, content, type) => {
    await adminAddOrderNote(id, content, type);
    await loadAll();
    showNotice(t('admin.noteAdded') || 'Note added');
  };

  // ===== 设置保存 =====
  const saveSettings = async () => {
    await adminUpdateSettings(settings);
    await loadAll();
    showNotice('Saved');
  };

  // ===== 会员资料 =====
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (token) {
      adminGetProfile().then(setProfile).catch(() => {});
    }
  }, [token]);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await adminUpdateProfile(profile);
      setProfile(updated);
      showNotice('Saved');
    } catch (err) {
      showNotice(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError(t('admin.passwordMismatch') || 'New passwords do not match');
      return;
    }
    try {
      await adminUpdatePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      showNotice(t('admin.passwordUpdated') || 'Password updated');
    } catch (err) {
      setPwError(err.message);
    }
  };

  if (!token) {
    return (
      <div className="admin-login">
        <div className="login-glow login-glow-1" />
        <div className="login-glow login-glow-2" />
        <div className="login-glow login-glow-3" />

        <div className="login-card">
          <div className="login-brand">
            <span className="login-logo">CrossBuy</span>
            <span className="login-tagline">{t('common.brandTagline') || 'Buy More Save More'}</span>
          </div>

          <h2 className="login-title">{t('admin.title')}</h2>
          <p className="login-sub">{t('admin.loginHint') || 'Sign in to manage orders, customers and carriers'}</p>

          <form onSubmit={handleLogin}>
            <label className="login-field">
              <span className="login-field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('admin.username') || 'Username'}
                autoFocus
              />
            </label>
            <label className="login-field">
              <span className="login-field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('admin.password') || 'Password'}
              />
            </label>

            {loginError && <div className="login-error">{loginError}</div>}

            <button type="submit" className="login-submit" disabled={busy}>
              {t('admin.loginBtn')}
            </button>
          </form>

          <div className="login-mode-badge">
            <span className="login-mode-dot" />
            {t('admin.productionMode') || 'Production mode'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {notice && <div className="admin-notice">{notice}</div>}

      <div className="admin-head">
        <h2 className="admin-title">{t('admin.title')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => loadAll()}>{t('admin.refresh')}</button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>{t('admin.logout')}</button>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'customers' ? 'active' : ''} onClick={() => switchTab('customers')}>
          {t('admin.customers')}
        </button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => switchTab('orders')}>
          {t('admin.orders')}
        </button>
        <button className={tab === 'addresses' ? 'active' : ''} onClick={() => switchTab('addresses')}>
          {t('admin.addresses')}
        </button>
        <button className={tab === 'carriers' ? 'active' : ''} onClick={() => switchTab('carriers')}>
          {t('admin.carriers') || 'Carriers'}
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => switchTab('settings')}>
          {t('admin.systemSettings')}
        </button>
      </div>

      {busy && <div className="loading">Loading…</div>}

      {/* ================= 客户管理（WooCommerce 风格） ================= */}
      {tab === 'customers' && !busy && (
        <CustomersTab
          customers={customers}
          query={customerQuery}
          onQuery={setCustomerQuery}
          onAdd={() => setCustomerForm({ ...emptyCustomer, _editing: null })}
          onEdit={(c) => setCustomerForm({ ...c, _editing: c })}
          onDelete={removeCustomer}
          t={t}
        />
      )}

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

      {/* ================= 订单管理（WooCommerce 风格） ================= */}
      {tab === 'orders' && !busy && (
        <OrdersTab
          orders={orders}
          customers={customers}
          query={orderQuery}
          onQuery={setOrderQuery}
          onAdd={() => setOrderForm({ ...emptyOrder, _editing: null })}
          onEdit={(o) => setOrderForm({ ...o, _editing: o })}
          onDelete={removeOrder}
          onStatus={updateOrderStatus}
          onAddNote={addOrderNote}
          selected={selectedOrder}
          onSelect={setSelectedOrder}
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
              {t('admin.productionHint') || 'Production mode: all shipping quotes come from real API channels'}
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
                      ? <span className="pill good">{t('admin.connected') || 'Connected · Production'}</span>
                      : <span className="pill">{t('admin.estimateMode') || 'Not connected'}</span>}
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
                        <th>快递</th><th>渠道</th><th>运费 (USD)</th><th>时效</th><th>推荐</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteResult.quotes.map((q) => (
                        <tr key={q.carrier}>
                          <td><b>{q.carrierName}</b></td>
                          <td>{q.productName}</td>
                          <td>{q.priceUsd.toFixed(2)}</td>
                          <td>{q.daysMin}-{q.daysMax} 天</td>
                          <td>{q.recommended ? '★ ' + (t('result.recommended') || 'Best') : ''}</td>
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

      {/* ================= 系统设置（系统参数 + 管理员账号[super] + 个人资料 + 修改密码） ================= */}
      {tab === 'settings' && !busy && (
        <div>
          <div className="admin-section-head">
            <h3>{t('admin.settings')}</h3>
          </div>

          <div className="card admin-form">
            <h4>{t('admin.systemSettings') || '系统参数'}</h4>
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

          {role === 'super' && (
            <AdminsTab username={username} showNotice={showNotice} t={t} />
          )}

          <div className="card admin-form">
            <h4>{t('admin.adminProfile') || '会员资料'}</h4>
            <form onSubmit={saveProfile}>
              <div className="form-grid">
                <div>
                  <label className="settings-label">{t('admin.name')}</label>
                  <input
                    className="settings-control"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="settings-label">{t('admin.email')}</label>
                  <input
                    className="settings-control"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }}>
                {t('admin.save')}
              </button>
            </form>
          </div>

          <div className="card admin-form">
            <h4>{t('admin.changePassword') || '修改密码'}</h4>
            <form onSubmit={changePassword}>
              <div className="form-grid">
                <div>
                  <label className="settings-label">{t('admin.currentPassword') || '当前密码'}</label>
                  <input
                    className="settings-control"
                    type="password"
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="settings-label">{t('admin.newPassword') || '新密码'}</label>
                  <input
                    className="settings-control"
                    type="password"
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="settings-label">{t('admin.confirmPassword') || '确认新密码'}</label>
                  <input
                    className="settings-control"
                    type="password"
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                    minLength={6}
                    required
                  />
                </div>
              </div>
              {pwError && <div className="error-text">{pwError}</div>}
              <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }}>
                {t('admin.updatePassword') || '更新密码'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 管理员账号管理（super 专属）：账号列表 / 新增 / 改角色 / 改密 / 删除 =====
function AdminsTab({ username: currentUsername, showNotice, t }) {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'operator' });
  const [editing, setEditing] = useState(null); // {id, password, role}
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setAdmins(await adminListAdmins());
    } catch (e) {
      showNotice(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const addAdmin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await adminCreateAdmin(form);
      setForm({ username: '', password: '', role: 'operator' });
      await load();
      showNotice(t('admin.adminAdded') || 'Admin added');
    } catch (err) {
      setError(err.message);
    }
  };

  const saveEdit = async (id) => {
    setError('');
    try {
      const payload = { role: editing.role };
      if (editing.password) payload.password = editing.password;
      await adminUpdateAdmin(id, payload);
      setEditing(null);
      await load();
      showNotice(t('admin.adminUpdated') || 'Admin updated');
    } catch (err) {
      setError(err.message);
    }
  };

  const removeAdmin = async (id) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    try {
      await adminDeleteAdmin(id);
      await load();
      showNotice(t('admin.adminDeleted') || 'Admin deleted');
    } catch (err) {
      showNotice(err.message);
    }
  };

  return (
    <div>
      <div className="admin-section-head">
        <h3>{t('admin.admins')}</h3>
      </div>

      <div className="card admin-form">
        <h4>{t('admin.addAdmin')}</h4>
        <form onSubmit={addAdmin}>
          <div className="form-grid">
            <div>
              <label className="settings-label">{t('admin.username')} *</label>
              <input
                className="settings-control"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin2"
                required
              />
            </div>
            <div>
              <label className="settings-label">{t('admin.password')} *</label>
              <input
                className="settings-control"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="settings-label">{t('admin.role')}</label>
              <select
                className="settings-control"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="operator">{t('admin.roleOperator')}</option>
                <option value="super">{t('admin.roleSuper')}</option>
              </select>
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }}>
            {t('admin.addAdmin')}
          </button>
        </form>
      </div>

      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>{t('admin.username')}</th>
              <th>{t('admin.role')}</th>
              <th>{t('admin.createdAt') || 'Created'}</th>
              <th>{t('admin.actions') || 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>
                  <b>{a.username}</b>
                  {a.username === currentUsername && <span className="pill" style={{ marginLeft: 6 }}>{t('admin.you') || 'You'}</span>}
                </td>
                <td>
                  {editing?.id === a.id ? (
                    <select
                      className="settings-control"
                      style={{ width: 140 }}
                      value={editing.role}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    >
                      <option value="operator">{t('admin.roleOperator')}</option>
                      <option value="super">{t('admin.roleSuper')}</option>
                    </select>
                  ) : (
                    <span className={`role-badge ${a.role}`}>{a.role === 'super' ? t('admin.roleSuper') : t('admin.roleOperator')}</span>
                  )}
                </td>
                <td>{String(a.createdAt || '').slice(0, 10)}</td>
                <td>
                  {editing?.id === a.id ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        className="settings-control"
                        style={{ width: 130 }}
                        type="password"
                        placeholder={t('admin.newPassword') || 'New password'}
                        value={editing.password}
                        onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(a.id)}>{t('admin.save')}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>{t('admin.cancel')}</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: a.id, role: a.role, password: '' })}>
                        {t('admin.edit')}
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={a.username === currentUsername} onClick={() => removeAdmin(a.id)}>
                        {t('admin.delete')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-notice" style={{ background: 'var(--bg-soft)', color: 'var(--text-dim)', marginTop: 12 }}>
        {t('admin.roleHelp')}
      </div>
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

// ===== 状态胶囊（WooCommerce pill 风格） =====
function StatusPill({ value, t }) {
  const cls = {
    active: 'good',
    delivered: 'good',
    completed: 'good',
    processing: 'info',
    shipped: 'info',
    pending: 'warn',
    onhold: 'warn',
    cancelled: 'muted',
    refunded: 'warn2',
    inactive: 'muted',
  }[value] || '';
  const label = t ? t(`admin.status_${value}`) || value : value;
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

// ===== 分页（WooCommerce 风格） =====
function Pagination({ page, perPage, total, onPage, onPerPage, t }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(page, pages);
  return (
    <div className="wc-pagination">
      <div className="wc-pagination-left">
        <select
          className="settings-control wc-perpage"
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
        >
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="wc-perpage-label">{t('admin.perPage')}</span>
        <span className="wc-count">— {t('admin.showing', { n: total }) || `${total} items`}</span>
      </div>
      <div className="wc-pagination-right">
        <button className="btn btn-ghost btn-sm" disabled={cur <= 1} onClick={() => onPage(cur - 1)}>{t('admin.prev')}</button>
        <span className="wc-page-ind">{t('admin.pageOf', { p: cur, t: pages }) || `${cur} / ${pages}`}</span>
        <button className="btn btn-ghost btn-sm" disabled={cur >= pages} onClick={() => onPage(cur + 1)}>{t('admin.next')}</button>
      </div>
    </div>
  );
}

// ===== 客户管理（WooCommerce 风格：统计列 + 分页 + 详情） =====
function CustomersTab({ customers, query, onQuery, onAdd, onEdit, onDelete, t }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState(null);

  const filtered = customers
    .filter((c) => !statusFilter || c.status === statusFilter)
    .filter((c) => !query || [c.name, c.email, c.phone, c.country].some((v) => v && String(v).toLowerCase().includes(query.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * perPage, cur * perPage);
  const fmtUsd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
  const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '—');

  return (
    <div>
      <div className="admin-section-head">
        <h3>{t('admin.customersTitle')}</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="settings-control"
            style={{ maxWidth: 240 }}
            placeholder={t('admin.search')}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          <select className="settings-control" style={{ maxWidth: 150 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">{t('admin.all')}</option>
            {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{t(`admin.status_${s}`) || s}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={onAdd}>
            {t('admin.addCustomer') || 'Add customer'}
          </button>
        </div>
      </div>

      <table className="admin-table wc-table">
        <thead>
          <tr>
            <th>{t('admin.name')}</th>
            <th>{t('admin.email')}</th>
            <th>{t('admin.location')}</th>
            <th>{t('admin.registered')}</th>
            <th>{t('admin.ordersCount')}</th>
            <th>{t('admin.lastOrder')}</th>
            <th>{t('admin.totalSpend')}</th>
            <th>{t('admin.aov')}</th>
            <th>{t('admin.status')}</th>
            <th>{t('admin.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const st = c.stats || {};
            return (
              <tr key={c.id} className={selected?.id === c.id ? 'wc-row-active' : ''}>
                <td>
                  <button className="wc-name-link" onClick={() => setSelected(selected?.id === c.id ? null : c)}>{c.name}</button>
                  {c.notes && <div className="muted-note">{c.notes}</div>}
                </td>
                <td>{c.email}</td>
                <td>{c.country || '—'}</td>
                <td>{fmtDate(c.registeredAt)}</td>
                <td><b>{st.ordersCount ?? 0}</b></td>
                <td>{st.lastOrderAt ? <span>{fmtDate(st.lastOrderAt)}<br /><small>{st.lastOrderNo}</small></span> : '—'}</td>
                <td>{st.totalSpendUsd ? <b>{fmtUsd(st.totalSpendUsd)}</b> : '—'}</td>
                <td>{st.aovUsd ? fmtUsd(st.aovUsd) : '—'}</td>
                <td><StatusPill value={c.status} t={t} /></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(c)}>{t('admin.edit')}</button>
                  <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(c.id)}>{t('admin.delete')}</button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={10} className="wc-empty">{t('admin.emptyList')}</td></tr>
          )}
        </tbody>
      </table>

      <Pagination page={cur} perPage={perPage} total={filtered.length} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} t={t} />

      {selected && (
        <CustomerDetail
          customer={selected}
          onEdit={() => onEdit(selected)}
          onClose={() => setSelected(null)}
          t={t}
        />
      )}
    </div>
  );
}

// ===== 客户详情卡（WooCommerce 式：资料 + 统计 + 订单历史） =====
function CustomerDetail({ customer, onEdit, onClose, t }) {
  return (
    <div className="card admin-form wc-customer-detail">
      <div className="admin-section-head">
        <h4>{customer.name} <StatusPill value={customer.status} t={t} /></h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>{t('admin.edit')}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('admin.cancel')}</button>
        </div>
      </div>
      <div className="wc-stat-grid">
        <div className="wc-stat">
          <div className="wc-stat-num">{customer.stats?.ordersCount ?? 0}</div>
          <div className="wc-stat-label">{t('admin.ordersCount')}</div>
        </div>
        <div className="wc-stat">
          <div className="wc-stat-num">${(Number(customer.stats?.totalSpendUsd) || 0).toFixed(2)}</div>
          <div className="wc-stat-label">{t('admin.totalSpend')}</div>
        </div>
        <div className="wc-stat">
          <div className="wc-stat-num">${(Number(customer.stats?.aovUsd) || 0).toFixed(2)}</div>
          <div className="wc-stat-label">{t('admin.aov')}</div>
        </div>
        <div className="wc-stat">
          <div className="wc-stat-num wc-stat-sm">{customer.stats?.lastOrderAt ? String(customer.stats.lastOrderAt).slice(0, 10) : '—'}</div>
          <div className="wc-stat-label">{t('admin.lastOrder')}</div>
        </div>
      </div>
      <div className="wc-detail-cols">
        <div>
          <div className="detail-label">{t('admin.contactInfo')}</div>
          <div>{customer.email || '—'}</div>
          <div>{customer.phone || '—'}</div>
          <div className="muted-note">{t('admin.customerSince')} {customer.registeredAt ? String(customer.registeredAt).slice(0, 10) : '—'}</div>
        </div>
        <div>
          <div className="detail-label">{t('admin.addressInfo')}</div>
          <div>{[customer.country].filter(Boolean).join(', ') || '—'}</div>
          <div className="muted-note">{customer.currency}</div>
        </div>
      </div>
      {customer.notes && <div className="muted-note" style={{ marginTop: 10 }}>{customer.notes}</div>}
    </div>
  );
}

// ===== 订单管理（WooCommerce 风格：状态 tabs + 批量操作 + 分页） =====
function OrdersTab({ orders, customers, query, onQuery, onAdd, onEdit, onDelete, onStatus, onAddNote, selected, onSelect, t }) {
  const [statusTab, setStatusTab] = useState('all');
  const [selection, setSelection] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const countBy = (s) => orders.filter((o) => o.status === s).length;
  const filtered = orders
    .filter((o) => statusTab === 'all' || o.status === statusTab)
    .filter((o) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return [o.orderNo, o.trackingNo, o.customer?.name, o.customer?.email].some((v) => v && String(v).toLowerCase().includes(q));
    });
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * perPage, cur * perPage);
  const customerById = (id) => customers.find((c) => c.id === id);

  const toggleAll = () => {
    const allSelected = rows.length > 0 && rows.every((o) => selection.has(o.id));
    setSelection(allSelected ? new Set() : new Set(rows.map((o) => o.id)));
  };
  const toggleOne = (id) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelection(next);
  };
  const applyBulk = async () => {
    if (!bulkStatus || selection.size === 0) return;
    for (const id of selection) {
      await onStatus(id, bulkStatus);
    }
    setSelection(new Set());
    setBulkStatus('');
  };
  const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '—');

  return (
    <div>
      <div className="admin-section-head">
        <h3>{t('admin.ordersTitle')}</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="settings-control"
            style={{ maxWidth: 240 }}
            placeholder={t('admin.search')}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={onAdd}>
            {t('admin.addOrder') || 'Add order'}
          </button>
        </div>
      </div>

      {/* 状态 tabs（带计数） */}
      <div className="wc-subsubsim">
        <button className={statusTab === 'all' ? 'active' : ''} onClick={() => { setStatusTab('all'); setPage(1); }}>
          {t('admin.all')} <span className="wc-count-pill">{orders.length}</span>
        </button>
        {ORDER_STATUSES.map((s) => (
          <button key={s} className={statusTab === s ? 'active' : ''} onClick={() => { setStatusTab(s); setPage(1); }}>
            {t(`admin.status_${s}`) || s} <span className="wc-count-pill">{countBy(s)}</span>
          </button>
        ))}
      </div>

      {/* 批量操作栏 */}
      <div className="wc-bulkbar">
        <select className="settings-control" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
          <option value="">{t('admin.bulkActions')}</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t('admin.markAs')}: {t(`admin.status_${s}`) || s}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" disabled={!bulkStatus || selection.size === 0} onClick={applyBulk}>
          {t('admin.apply')}
        </button>
        {selection.size > 0 && <span className="wc-selected-hint">{(t('admin.selected') || '{n} selected').replace('{n}', selection.size)}</span>}
      </div>

      <table className="admin-table wc-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={rows.length > 0 && rows.every((o) => selection.has(o.id))} onChange={toggleAll} />
            </th>
            <th>{t('admin.orderNo')}</th>
            <th>{t('admin.date')}</th>
            <th>{t('admin.status')}</th>
            <th>{t('admin.total')}</th>
            <th>{t('admin.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const cust = o.customer || customerById(o.customerId);
            const custName = cust?.name || o.contact?.name || o.customerId || '—';
            const custEmail = cust?.email || o.contact?.email || '';
            return (
              <tr key={o.id} className={selected?.id === o.id ? 'wc-row-active' : ''}>
                <td><input type="checkbox" checked={selection.has(o.id)} onChange={() => toggleOne(o.id)} /></td>
                <td>
                  <button className="wc-name-link" onClick={() => onSelect(selected?.id === o.id ? null : o)}><b>#{o.orderNo}</b></button>
                  <div className="muted-note">{custName}<br />{custEmail}</div>
                </td>
                <td>{fmtDate(o.createdAt)}</td>
                <td><StatusPill value={o.status} t={t} /></td>
                <td><b>{o.currency} {o.totalCurrency ?? '—'}</b><br /><small>{(o.items || []).length} {t('admin.items')}</small></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => onSelect(o)}>{t('admin.viewOrder')}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(o)}>{t('admin.editOrder')}</button>
                  <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(o.id)}>{t('admin.delete')}</button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="wc-empty">{t('admin.emptyList')}</td></tr>
          )}
        </tbody>
      </table>

      <Pagination page={cur} perPage={perPage} total={filtered.length} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} t={t} />

      {selected && (
        <OrderDetail
          order={selected}
          customer={customerById(selected.customerId)}
          onStatus={(s) => onStatus(selected.id, s)}
          onEdit={() => onEdit(selected)}
          onDelete={() => onDelete(selected.id)}
          onAddNote={onAddNote}
          onClose={() => onSelect(null)}
          t={t}
        />
      )}
    </div>
  );
}

// ===== 订单详情（WooCommerce 编辑订单布局：主列 General/Billing/Shipping/Items/Totals + 侧列 Actions/Notes） =====
function OrderDetail({ order, customer, onStatus, onEdit, onDelete, onAddNote, onClose, t }) {
  const [note, setNote] = useState('');
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  const fmtCny = (n) => `¥${(Number(n) || 0).toFixed(2)}`;
  const itemsSubtotal = (order.items || []).reduce(
    (s, it) => s + (Number(it.price ?? it.priceCny) || 0) * (Number(it.qty ?? it.quantity) || 1),
    0
  );

  const submitNote = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    onAddNote(order.id, note.trim());
    setNote('');
  };

  return (
    <div className="wc-order-detail">
      <div className="admin-section-head">
        <h4>#{order.orderNo} <StatusPill value={order.status} t={t} /></h4>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('admin.cancel')}</button>
      </div>

      <div className="wc-order-cols">
        {/* 主列 */}
        <div className="wc-order-main">
          {/* General */}
          <div className="wc-box">
            <div className="wc-box-title">{t('admin.generalDetails')}</div>
            <div className="wc-box-body">
              <div className="wc-detail-row">
                <span className="wc-detail-label">{t('admin.created')}</span>
                <span>{String(order.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
              </div>
              <div className="wc-detail-row">
                <span className="wc-detail-label">{t('admin.status')}</span>
                <select className="settings-control wc-status-select" value={order.status} onChange={(e) => onStatus(e.target.value)}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`admin.status_${s}`) || s}</option>)}
                </select>
              </div>
              <div className="wc-detail-row">
                <span className="wc-detail-label">{t('admin.customer')}</span>
                <span>{customer ? <b>{customer.name}</b> : (order.contact?.name || order.customerId || '—')}<br /><small>{customer?.email || order.contact?.email || ''}</small></span>
              </div>
            </div>
          </div>

          {/* Billing / Shipping */}
          <div className="wc-box-row">
            <div className="wc-box">
              <div className="wc-box-title">{t('admin.billingDetails')}</div>
              <div className="wc-box-body">
                <div>{order.contact?.name || customer?.name || '—'}</div>
                <div>{order.contact?.email || customer?.email || '—'}</div>
                <div>{order.contact?.phone || customer?.phone || '—'}</div>
              </div>
            </div>
            <div className="wc-box">
              <div className="wc-box-title">{t('admin.shippingDetails')}</div>
              <div className="wc-box-body">
                {(order.address
                  ? [order.address.line1, order.address.line2, order.address.city, order.address.state, order.address.postal, order.address.country]
                  : []
                ).filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}
                {!order.address && <div>—</div>}
              </div>
            </div>
          </div>

          {/* Items（明细为人民币采购价） */}
          <div className="wc-box">
            <div className="wc-box-title">{t('admin.items')} <small className="muted-note">CNY</small></div>
            <table className="wc-items-table">
              <thead>
                <tr><th>{t('admin.item')}</th><th>{t('admin.qty')}</th><th>{t('admin.unitPrice')}</th><th style={{ textAlign: 'right' }}>{t('admin.subtotal')}</th></tr>
              </thead>
              <tbody>
                {(order.items || []).map((it, i) => {
                  const qty = Number(it.qty ?? it.quantity) || 1;
                  const price = Number(it.price ?? it.priceCny) || 0;
                  return (
                    <tr key={i}>
                      <td>{it.title || it.itemId || '—'}</td>
                      <td>× {qty}</td>
                      <td>{fmtCny(price)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCny(price * qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>{t('admin.subtotal')}</td><td style={{ textAlign: 'right' }}>{fmtCny(itemsSubtotal)}</td></tr>
              </tfoot>
            </table>
          </div>

          {/* Totals（人民币成本明细 + 客户应付目的币） */}
          <div className="wc-box wc-totals-box">
            <div className="wc-box-title">{t('admin.orderTotal')}</div>
            <div className="wc-box-body">
              <div className="wc-detail-row"><span>{t('admin.subtotal')}</span><span>{fmtCny(order.subtotalCny ?? itemsSubtotal)}</span></div>
              <div className="wc-detail-row"><span>{t('admin.shipping')}</span><span>{fmtCny(order.shippingCny)}</span></div>
              {order.dutyCny != null && <div className="wc-detail-row"><span>{t('admin.duty')}</span><span>{fmtCny(order.dutyCny)}</span></div>}
              {order.vatCny != null && <div className="wc-detail-row"><span>{t('admin.vat')}</span><span>{fmtCny(order.vatCny)}</span></div>}
              {order.serviceFeeCny != null && <div className="wc-detail-row"><span>{t('admin.serviceFee')}</span><span>{fmtCny(order.serviceFeeCny)}</span></div>}
              {order.paymentFeeCny != null && <div className="wc-detail-row"><span>{t('admin.paymentFee')}</span><span>{fmtCny(order.paymentFeeCny)}</span></div>}
              <div className="wc-detail-row wc-grand-total"><span>{t('admin.orderTotal')}</span><span><b>{fmtCny(order.totalCny)}</b></span></div>
              <div className="wc-detail-row muted"><span>{t('admin.payAmount')}</span><span><b>{order.currency} {order.totalCurrency ?? '—'}</b></span></div>
              <div className="wc-detail-row muted"><span>{t('admin.carrierLabel')}</span><span>{order.carrier || '—'}{order.trackingNo ? ` · ${t('admin.tracking')} ${order.trackingNo}` : ''}</span></div>
            </div>
          </div>
        </div>

        {/* 侧列 */}
        <div className="wc-order-side">
          {/* Order actions */}
          <div className="wc-box">
            <div className="wc-box-title">{t('admin.orderActions')}</div>
            <div className="wc-box-body wc-actions-body">
              {ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
                <button key={s} className="btn btn-ghost btn-sm wc-action-btn" onClick={() => onStatus(s)}>
                  {t('admin.markAs')}: {t(`admin.status_${s}`) || s}
                </button>
              ))}
              <button className="btn btn-ghost btn-sm wc-action-btn" onClick={onEdit}>{t('admin.editOrder')}</button>
              <button className="btn btn-ghost btn-sm danger wc-action-btn" onClick={onDelete}>{t('admin.delete')}</button>
            </div>
          </div>

          {/* Order notes */}
          <div className="wc-box">
            <div className="wc-box-title">{t('admin.orderNotes')}</div>
            <div className="wc-box-body">
              <div className="wc-notes-list">
                {timeline.length === 0 && <div className="muted-note">{t('admin.noNotes')}</div>}
                {timeline.map((n, i) => (
                  <div key={i} className={`wc-note ${n.type === 'customer' ? 'wc-note-customer' : ''}`}>
                    <div className="wc-note-meta">{String(n.at || '').slice(0, 16).replace('T', ' ')} · {n.author || 'admin'} · {n.type === 'customer' ? t('admin.noteCustomer') : t('admin.noteInternal')}</div>
                    <div className="wc-note-body">{n.content}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={submitNote} className="wc-note-form">
                <textarea
                  className="settings-control"
                  rows={3}
                  placeholder={t('admin.notePlaceholder')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 8, width: '100%' }} disabled={!note.trim()}>
                  {t('admin.addNote')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function o_custFallback(order) {
  return order.customerId || '—';
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
