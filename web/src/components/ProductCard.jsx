import { useState } from 'react';

const PLATFORM_CLASS = {
  '淘宝': 'platform-tb',
  '天猫': 'platform-tb',
  '京东': 'platform-jd',
  '拼多多': 'platform-pdd',
  '1688': 'platform-1688',
};

// 根据平台+类目生成占位图 URL（后端 SVG 接口）
function placeholderUrl(item) {
  const platformKey = { '淘宝': 'taobao', '天猫': 'tmall', '京东': 'jd', '拼多多': 'pdd', '1688': '1688' }[item.platform] || item.adapter || 'default';
  const label = encodeURIComponent((item.titleEn || item.title || 'Product').slice(0, 8));
  return `/api/img/${encodeURIComponent(item.category || 'Product')}/${platformKey}?label=${label}`;
}

function fmt(n, symbol, currency) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  if (currency === 'KRW' || currency === 'JPY' || currency === 'VND' || currency === 'IDR') {
    return `${symbol}${Math.round(n).toLocaleString()}`;
  }
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInt(n) {
  if (n === undefined || n === null) return '—';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ProductCard({ item, currency, currencySymbol, shippingTiers, inCombine, onToggleCombine, onOrder, t }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const b = item.landed.breakdown;
  const platformClass = PLATFORM_CLASS[item.platform] || '';
  const platformName = t(`platform.${item.adapter || item.platform.toLowerCase()}`) || item.platform;

  const title = item.titleEn && item.titleEn !== item.title ? item.titleEn : item.title;

  return (
    <div className={`card ${item.isTopPick ? 'top' : item.isRecommended ? 'recommended' : ''}`}>
      <div className="card-media">
        <span className={`platform-badge ${platformClass}`}>{platformName}</span>
        <img
          src={item.imageUrl || placeholderUrl(item)}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (e.target.src !== placeholderUrl(item)) {
              e.target.onerror = null;
              e.target.src = placeholderUrl(item);
            }
          }}
        />
        {item.isTopPick && <span className="badge">{t('result.topPick')}</span>}
        {!item.isTopPick && item.isRecommended && <span className="badge rec">{t('result.recommended')}</span>}
      </div>

      <div className="card-body">
        <h3 className="card-title">{title}</h3>

        <div className="card-meta">
          {item.brand && <span className="pill">{item.brand}</span>}
          <span className="pill">{item.category}</span>
          {item.inStock && <span className="pill good">{t('result.inStock')}</span>}
          <span className="pill source-badge">{item.sourceType === 'api' ? t('source.api') : t('source.mock')}</span>
        </div>

        <div className="price-line">
          <span className="price-total">{b.goodsValue != null ? fmt(b.goodsValue, currencySymbol, currency) : fmt(item.price, '¥', 'CNY')}</span>
          <span className="price-unit">{b.goodsValue != null ? currency : 'CNY'}</span>
        </div>
        <div className="price-note">{t('result.purchaseNote')}</div>

        {shippingTiers && shippingTiers.length > 0 ? (() => {
          // 三个快递价格位置：每档显示"该档运费 + 固定成本"重算的到手总价
          // 运费换算比例 = 当前 breakdown 运费 / 其对应 USD 报价；税费/服务费与运费无关，可直接换运费重算
          const refUsd = item.landed.shipping.quoteUsd;
          const rate = refUsd ? b.intlShipping / refUsd : null;
          return (
            <div className="ship-tiers">
              {shippingTiers.map((tr) => {
                const tierPrice = rate != null ? tr.quote.priceUsd * rate : null;
                const tierTotal = tierPrice != null ? b.total - b.intlShipping + tierPrice : null;
                const isCurrent = tr.quote.carrierName === item.landed.shipping.carrier;
                return (
                  <div className={`ship-tier ${isCurrent ? 'current' : ''}`} key={tr.labels.join('+')}>
                    <span className="tier-tags">
                      {tr.labels.map((label) => (
                        <em key={label} className={`tier-tag ${label}`}>{t(`result.${label}`)}</em>
                      ))}
                    </span>
                    <span className="tier-name">{tr.quote.carrierName || tr.quote.carrier}{tr.quote.productName ? ` · ${tr.quote.productName}` : ''}</span>
                    <span className="tier-days">{tr.quote.daysMin}-{tr.quote.daysMax}{t('result.days')}</span>
                    <span className="tier-price">{tierTotal != null ? fmt(tierTotal, currencySymbol, currency) : fmt(tr.quote.priceUsd, '$', 'USD')}</span>
                  </div>
                );
              })}
            </div>
          );
        })() : (
          <div className="cost-strip">
            <span>{t('result.landedTotal')}</span>
            <span className="val">{fmt(b.total, currencySymbol, currency)}</span>
          </div>
        )}

        <div className="card-stats">
          <div className="stat">
            <div className="num">{fmtInt(item.sales)}</div>
            <div className="lbl">{t('result.sales')}</div>
          </div>
          <div className="stat">
            <div className="num">{(item.rating || 0).toFixed(1)}</div>
            <div className="lbl">{t('result.rating')}</div>
          </div>
          <div className="stat">
            <div className="num">{item.landed.shipping.daysMin}-{item.landed.shipping.daysMax}</div>
            <div className="lbl">{t('result.deliveryTime')} ({t('result.days')})</div>
          </div>
        </div>

        <div className="score-bar">
          <div className="score-bar-top">
            <span>{t('result.score')}</span>
            <span>{item.scores.total.toFixed(1)}</span>
          </div>
          <div className="score-track">
            <div className="score-fill" style={{ width: `${item.scores.total}%` }} />
          </div>
        </div>

        <div className="card-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBreakdown(!showBreakdown)}>
            {showBreakdown ? t('result.hideBreakdown') : t('result.viewBreakdown')}
          </button>
          <button
            className={`btn btn-sm ${inCombine ? 'btn-primary' : 'btn-ghost'}`}
            onClick={onToggleCombine}
          >
            {inCombine ? t('combine.inCombine') : t('combine.addToCombine')}
          </button>

          {showBreakdown && (
            <div className="breakdown">
              <div className="breakdown-row">
                <span>{t('result.price')} ({item.shopName})</span>
                <span className="val">{fmt(b.goodsValue, currencySymbol, currency)}</span>
              </div>
              <div className="breakdown-row">
                <span>{t('result.shipping')} · {item.landed.shipping.carrier} ({item.landed.shipping.weightGrams}g)</span>
                <span className="val">{fmt(b.intlShipping, currencySymbol, currency)}</span>
              </div>
              <div className="breakdown-row">
                <span>{t('result.duty')} ({(item.landed.dutyRate * 100).toFixed(0)}%)</span>
                <span className="val">{fmt(b.duty, currencySymbol, currency)}</span>
              </div>
              <div className="breakdown-row">
                <span>{t('result.vat')} ({(item.landed.vatRate * 100).toFixed(0)}%)</span>
                <span className="val">{fmt(b.vat, currencySymbol, currency)}</span>
              </div>
              <div className="breakdown-row">
                <span>{t('result.serviceFee')}</span>
                <span className="val">{fmt(b.serviceFee, currencySymbol, currency)}</span>
              </div>
              <div className="breakdown-row">
                <span>{t('result.paymentFee')}</span>
                <span className="val">{fmt(b.paymentFee, currencySymbol, currency)}</span>
              </div>
              <div className="breakdown-row total">
                <span>{t('result.landedTotal')}</span>
                <span className="val">{fmt(b.total, currencySymbol, currency)}</span>
              </div>
              {item.landed.taxNote && <div className="tax-note">{t('result.taxNote')}: {item.landed.taxNote}</div>}
            </div>
          )}

          <button className="btn-order" style={{ marginTop: '12px' }} onClick={onOrder}>
            {t('result.orderCta')}
          </button>
        </div>
      </div>
    </div>
  );
}
