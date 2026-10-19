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

  return (
    <div className="track-page">
      <div className="card track-card">
        <h2>{t('track.title')}</h2>
        <p className="track-subtitle">{t('track.subtitle')}</p>
        <form onSubmit={submit} className="track-form">
          <div className="form-grid">
            <div>
              <label className="settings-label">{t('track.orderNo')}</label>
              <input className="settings-control" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="CB2026..." required />
            </div>
            <div>
              <label className="settings-label">{t('track.email')}</label>
              <input className="settings-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 12 }}>
            {loading ? '...' : t('track.lookup')}
          </button>
        </form>
        {error && <div className="loading" style={{ color: 'var(--bad)', marginTop: 12 }}>{error}</div>}
      </div>

      {order && (
        <div className="card track-card">
          <div className="track-order-head">
            <div>
              <span className="track-order-no">{order.orderNo}</span>
              <span className={`pill ${order.status === 'shipped' ? 'pill-good' : 'pill-warn'}`} style={{ marginLeft: 10 }}>
                {statusLabel(order.status)}
              </span>
            </div>
            <span className="track-order-total">{order.currency} {order.total}</span>
          </div>

          {order.parcels.length > 1 && (
            <div className="track-multi-hint">
              {t('track.multiParcelHint', { count: order.parcels.length })}
            </div>
          )}
          {order.parcels.length === 0 && (order.shipmentPreview?.expectedParcels || 0) > 1 && (
            <div className="track-multi-hint">
              {t('track.warehouseSplitPreview', { n: order.shipmentPreview.expectedParcels, warehouses: (order.shipmentPreview.warehouses || []).map(whName).join(' / ') })}
            </div>
          )}

          <h4 style={{ margin: '14px 0 8px' }}>{t('track.items')}</h4>
          <div className="track-items">
            {(order.items || []).map((it, i) => (
              <div className="track-item-row" key={i}>
                <span>{it.title}</span>
                <span className="muted">{it.platform} · x{it.quantity}</span>
              </div>
            ))}
          </div>

          <h4 style={{ margin: '14px 0 8px' }}>
            {t('track.parcels', { count: order.parcels.length })}
          </h4>
          {order.parcels.length === 0 ? (
            <div className="muted">{t('track.noParcelsYet')}</div>
          ) : (
            <div className="track-parcels">
              {order.parcels.map((pc, i) => (
                <div className="track-parcel" key={i}>
                  <div className="track-parcel-head">
                    <b>{pc.trackingNo || '—'}</b>
                    <span className="muted">{[pc.carrier, pc.productName, pc.warehouse && whName(pc.warehouse)].filter(Boolean).join(' · ')}</span>
                  </div>
                  {pc.items?.length > 0 && (
                    <div className="track-parcel-items muted">
                      {pc.items.map((it, j) => `${it.title} x${it.quantity}`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
