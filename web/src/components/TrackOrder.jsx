// 买家查单页：orderNo + email 双因素查询订单与多包裹发货状态
import { useState } from 'react';
import { apiUrl } from '../api.js';

export default function TrackOrder({ t }) {
  // 仓库显示名：词条缺失时回退大写仓库代码（i18n 硬要求：非中文界面不得出现词条键混排）
  const whName = (code) => {
    const s = t(`warehouse.${code}`);
    return s === `warehouse.${code}` ? String(code).toUpperCase() : s;
  };
  const statusLabel = (s) => {
    const k = `track.status.${s}`;
    return t(k) === k ? s : t(k);
  };
  const [orderNo, setOrderNo] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [copied, setCopied] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!orderNo.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(apiUrl(`/api/orders/track?orderNo=${encodeURIComponent(orderNo.trim())}&email=${encodeURIComponent(email.trim())}`));
      const j = await res.json();
      if (!res.ok) {
        setError(j.error === 'email mismatch' ? t('track.emailMismatch') : t('track.notFound'));
      } else {
        setOrder(j);
      }
    } catch {
      setError(t('track.error'));
    } finally {
      setLoading(false);
    }
  };

  const copyTracking = async (no) => {
    try {
      await navigator.clipboard.writeText(no);
      setCopied(no);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* clipboard 不可用时静默 */ }
  };

  const statusCls = (s) => ({ shipped: 'good', completed: 'good', processing: 'warn', pending: 'warn', cancelled: '' }[s] || '');

  return (
    <div className="track-page">
      <div className="track-hero">
        <div className="track-hero-icon" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
            <path d="M3 8l9 5 9-5" />
            <path d="M12 13v8" />
          </svg>
        </div>
        <h2>{t('track.title')}</h2>
        <p>{t('track.subtitle')}</p>
      </div>

      <form onSubmit={submit} className="track-search card">
        <div className="track-search-fields">
          <div className="track-field">
            <label className="settings-label">{t('track.orderNo')}</label>
            <input className="settings-control track-input" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="CB2026..." required />
          </div>
          <div className="track-field">
            <label className="settings-label">{t('track.email')}</label>
            <input className="settings-control track-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <button type="submit" className="btn btn-primary track-btn" disabled={loading}>
            {loading ? '...' : t('track.lookup')}
          </button>
        </div>
        {error && <div className="track-error">{error}</div>}
      </form>

      {order && (
        <div className="track-result">
          <div className="card track-summary">
            <div className="track-summary-main">
              <div className="track-summary-no">
                <span className="track-order-no">{order.orderNo}</span>
                <span className={`pill ${statusCls(order.status)}`}>{statusLabel(order.status)}</span>
              </div>
              <div className="track-summary-meta">
                {order.createdAt && String(order.createdAt).slice(0, 10)}
                {order.parcels.length > 0 && <> · {t('track.parcels', { count: order.parcels.length })}</>}
              </div>
            </div>
            <div className="track-summary-total">
              <span className="track-total-value">{order.currency} {order.total}</span>
              <span className="track-total-label">{t('account.total')}</span>
            </div>
          </div>

          {order.parcels.length > 1 && (
            <div className="track-note">{t('track.multiParcelHint', { count: order.parcels.length })}</div>
          )}
          {order.parcels.length === 0 && (order.shipmentPreview?.expectedParcels || 0) > 1 && (
            <div className="track-note">
              {t('track.warehouseSplitPreview', { n: order.shipmentPreview.expectedParcels, warehouses: (order.shipmentPreview.warehouses || []).map(whName).join(' / ') })}
            </div>
          )}

          <div className="track-section-title">{t('track.items')}</div>
          <div className="card track-items-card">
            {(order.items || []).map((it, i) => (
              <div className="track-item-row" key={i}>
                <span className="track-item-title">{it.title}</span>
                <span className="track-item-meta">{[it.platform, `x${it.quantity}`].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
          </div>

          <div className="track-section-title">{t('track.parcels', { count: order.parcels.length })}</div>
          {order.parcels.length === 0 ? (
            <div className="card track-empty">{t('track.noParcelsYet')}</div>
          ) : (
            <div className="track-parcel-grid">
              {order.parcels.map((pc, i) => (
                <div className="card track-parcel-card" key={i}>
                  <div className="track-parcel-bar" aria-hidden="true" />
                  <div className="track-parcel-body">
                    <div className="track-parcel-top">
                      <span className="track-tracking-no">{pc.trackingNo || '—'}</span>
                      {pc.trackingNo && (
                        <button type="button" className="track-copy-btn" onClick={() => copyTracking(pc.trackingNo)}>
                          {copied === pc.trackingNo ? '✓' : '⧉'}
                        </button>
                      )}
                    </div>
                    <div className="track-parcel-tags">
                      {[pc.carrier, pc.productName, pc.warehouse && whName(pc.warehouse)].filter(Boolean).map((tag, j) => (
                        <span className="track-tag" key={j}>{tag}</span>
                      ))}
                    </div>
                    {pc.items?.length > 0 && (
                      <div className="track-parcel-items">
                        {pc.items.map((it, j) => (
                          <div className="track-parcel-item" key={j}>{it.title} <span>x{it.quantity}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
