import { useState, useEffect } from 'react';
import { apiUrl } from '../api.js';
import { carrierDisplayName, productNameDisplay } from '../utils/carrier.js';
import { useMember, memberFetch } from '../authStore.js';

// 游客下单弹窗：商品 + 数量 + 快递渠道 + 收货信息 -> POST /api/orders
// 会员登录态：自动带出姓名/邮箱/电话与地址簿（选择即填充），下单自动归属会员账号
export default function OrderModal({ item, country, currency, carrier, quotes, defaultServiceFee, onClose, onPlaced, t, lang }) {
  const session = useMember();
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [selCarrier, setSelCarrier] = useState(carrier?.productName || quotes?.find((q) => q.recommended)?.productName || quotes?.[0]?.productName || '');
  // 服务费由买家确定（自愿性质，默认 5%，继承搜索页选择），独立于商品定价中的利润
  const SERVICE_FEE_OPTIONS = [0, 3, 5, 8, 10, 15];
  const [serviceFee, setServiceFee] = useState(defaultServiceFee ?? 5);
  const [form, setForm] = useState({
    quantity: 1,
    name: '', email: '', phone: '',
    line1: '', line2: '', city: '', state: '', postal: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // 登录态：拉地址簿 + 预填联系人
  useEffect(() => {
    if (!session) return;
    const c = session.customer || {};
    setForm((f) => ({
      ...f,
      name: f.name || c.name || '',
      email: f.email || c.email || '',
      phone: f.phone || c.phone || '',
    }));
    memberFetch('/api/auth/addresses').then(async (res) => {
      if (!res.ok) return;
      const list = await res.json();
      setSavedAddresses(list);
      const def = list.find((a) => a.isDefault) || list[0];
      if (def) applyAddress(def);
    });
  }, [session]);

  const applyAddress = (a) => {
    setSelectedAddressId(a.id || '');
    setForm((f) => ({
      ...f,
      name: a.recipient || f.name,
      phone: a.phone || f.phone,
      line1: a.line1 || f.line1,
      line2: a.line2 || f.line2,
      city: a.city || f.city,
      state: a.state || f.state,
      postal: a.postal || f.postal,
    }));
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const chosen = (quotes || []).find((q) => q.productName === selCarrier) || carrier || null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.token) headers.Authorization = `Bearer ${session.token}`;
      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: [{
            itemId: item.itemId,
            quantity: Number(form.quantity) || 1,
            skuId: item.skuId || '',
            skuName: item.skuName || '',
          }],
          contact: { name: form.name, email: form.email, phone: form.phone },
          address: {
            line1: form.line1, line2: form.line2, city: form.city,
            state: form.state, postal: form.postal, country,
          },
          currency,
          carrier: selCarrier || undefined,
          serviceFeeRate: serviceFee / 100,
          saveAddress: Boolean(session && saveAddress),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'order failed');
      setResult(data);
      onPlaced?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="order-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>

        {result ? (
          <div className="order-success">
            <div className="order-success-icon">✓</div>
            <h3>{t('order.success')}</h3>
            <p>{t('order.orderNo')}: <b>{result.orderNo}</b></p>
            <p>{t('order.estimatedTotal')}: <b>{result.currency} {result.total.toLocaleString()}</b></p>
            <p className="order-success-carrier">{carrierDisplayName(result.carrier, t)} · {result.daysMin}-{result.daysMax} {t('result.days')}</p>
            {result.expectedParcels > 1 ? (
              <div className="order-success-multi-hint">{t('order.multiParcelPlanned', { n: result.expectedParcels })}</div>
            ) : (
              <div className="order-success-multi-hint">{t('order.multiParcelHint')}</div>
            )}
            <a
              className="btn btn-ghost"
              href={`#/track`}
              onClick={onClose}
              style={{ marginBottom: 10, display: 'inline-block' }}
            >
              {t('track.nav')}
            </a>
            <button className="btn btn-primary" onClick={onClose}>{t('order.close')}</button>
          </div>
        ) : (
          <>
            <h3>{t('order.title')}</h3>
            <div className="order-item-line">
              <img src={item.imageUrl || `/images/${item.itemId}.jpg`} alt="" className="order-item-img" />
              <div className="order-item-info">
                <div className="order-item-title">{lang !== 'zh' && item.titleEn ? item.titleEn : item.title}</div>
                {item.skuName && <div className="order-item-sku">{item.skuName}</div>}
                <div className="order-item-price">
                  {item.landed?.breakdown?.total != null
                    ? `${item.landed.breakdown.total} ${currency} / ${t('result.landedTotal')}`
                    : `¥${item.price}`}
                </div>
              </div>
              <div className="order-item-qty">
                <label className="settings-label">{t('order.quantity')}</label>
                <input
                  className="settings-control"
                  type="number" min="1" max="99"
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                />
              </div>
            </div>

            {quotes && quotes.length > 0 && (
              <div className="order-carrier-row">
                <label className="settings-label">{t('carrier.title')}</label>
                <select
                  className="settings-control"
                  value={selCarrier}
                  onChange={(e) => setSelCarrier(e.target.value)}
                >
                  {quotes.map((q) => (
                    <option key={q.productName} value={q.productName}>
                      {productNameDisplay(q.productName)} · ${q.priceUsd} · {q.daysMin}-{q.daysMax}d
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="order-carrier-row">
              <label className="settings-label" title={t('order.serviceFeeHelp')}>{t('order.serviceFee')}</label>
              <div className="service-fee-options">
                {SERVICE_FEE_OPTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`btn-chip ${serviceFee === v ? 'active' : ''}`}
                    onClick={() => setServiceFee(v)}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={submit}>
              {session && (
                <div className="order-member-strip">
                  {t('account.signedInAs', { email: session.customer?.email || '' })}
                </div>
              )}
              {session && savedAddresses.length > 0 && (
                <div className="order-carrier-row">
                  <label className="settings-label">{t('account.savedAddresses')}</label>
                  <select
                    className="settings-control"
                    value={selectedAddressId}
                    onChange={(e) => {
                      const a = savedAddresses.find((x) => x.id === e.target.value);
                      if (a) applyAddress(a);
                    }}
                  >
                    <option value="">{t('account.addressNew')}</option>
                    {savedAddresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.recipient} · {a.line1}, {a.city} {a.postal}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="order-grid">
                <div>
                  <label className="settings-label">{t('order.contact')} *</label>
                  <input className="settings-control" value={form.name} onChange={(e) => set('name', e.target.value)} required />
                </div>
                <div>
                  <label className="settings-label">{t('order.email')} *</label>
                  <input className="settings-control" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
                </div>
                <div>
                  <label className="settings-label">{t('order.phone')}</label>
                  <input className="settings-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </div>
                <div>
                  <label className="settings-label">{t('order.toCountry')}</label>
                  <input className="settings-control" value={country} disabled />
                </div>
                <div className="span-2">
                  <label className="settings-label">{t('order.addressLine')} *</label>
                  <input className="settings-control" value={form.line1} onChange={(e) => set('line1', e.target.value)} required />
                </div>
                <div>
                  <label className="settings-label">{t('order.city')} *</label>
                  <input className="settings-control" value={form.city} onChange={(e) => set('city', e.target.value)} required />
                </div>
                <div>
                  <label className="settings-label">{t('order.state')}</label>
                  <input className="settings-control" value={form.state} onChange={(e) => set('state', e.target.value)} />
                </div>
                <div>
                  <label className="settings-label">{t('order.postal')}</label>
                  <input className="settings-control" value={form.postal} onChange={(e) => set('postal', e.target.value)} />
                </div>
              </div>
              {session && (
                <label className="order-save-addr">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                  />
                  {t('account.saveAddress')}
                </label>
              )}
              {error && <div className="error-text">{error}</div>}
              <button type="submit" className="btn btn-primary order-submit" disabled={submitting}>
                {submitting ? t('order.submitting') : t('order.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
