import { useState } from 'react';
import { apiUrl } from '../api.js';

// 游客下单弹窗：商品 + 数量 + 快递渠道 + 收货信息 -> POST /api/orders
export default function OrderModal({ item, country, currency, carrier, quotes, onClose, onPlaced, t }) {
  const [selCarrier, setSelCarrier] = useState(carrier?.productName || quotes?.find((q) => q.recommended)?.productName || quotes?.[0]?.productName || '');
  const [form, setForm] = useState({
    quantity: 1,
    name: '', email: '', phone: '',
    line1: '', line2: '', city: '', state: '', postal: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const chosen = (quotes || []).find((q) => q.productName === selCarrier) || carrier || null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ itemId: item.itemId, quantity: Number(form.quantity) || 1 }],
          contact: { name: form.name, email: form.email, phone: form.phone },
          address: {
            line1: form.line1, line2: form.line2, city: form.city,
            state: form.state, postal: form.postal, country,
          },
          currency,
          carrier: selCarrier || undefined,
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
            <p className="order-success-carrier">{result.carrier} · {result.daysMin}-{result.daysMax} {t('result.days')}</p>
            <button className="btn btn-primary" onClick={onClose}>{t('order.close')}</button>
          </div>
        ) : (
          <>
            <h3>{t('order.title')}</h3>
            <div className="order-item-line">
              <img src={item.imageUrl || `/images/${item.itemId}.jpg`} alt="" className="order-item-img" />
              <div className="order-item-info">
                <div className="order-item-title">{item.titleEn || item.title}</div>
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
                      {q.productName} · ${q.priceUsd} · {q.daysMin}-{q.daysMax}d
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={submit}>
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
