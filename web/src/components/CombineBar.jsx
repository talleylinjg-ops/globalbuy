import { useState } from 'react';

function fmt(n, symbol, currency) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  if (currency === 'KRW' || currency === 'JPY' || currency === 'VND' || currency === 'IDR') {
    return `${symbol}${Math.round(n).toLocaleString()}`;
  }
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 底部合并包裹浮条：多商品统一运费/关税/增值税计价
export default function CombineBar({ items, result, loading, onCalc, onClear, onRemove, t }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const totalWeight = items.reduce((s, it) => s + (it.weightGrams || 500), 0);
  const symbol = result?.currencySymbol || '$';
  const currency = result?.currency || 'USD';

  return (
    <div className={`combine-bar ${result && expanded ? 'expanded' : ''}`}>
      <div className="combine-bar-main">
        <div className="combine-info">
          <span className="combine-count">{t('combine.itemsCount', { count: items.length })}</span>
          <span className="combine-weight">{t('combine.totalWeight')}: {totalWeight}g</span>
        </div>
        <div className="combine-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClear}>{t('combine.clear')}</button>
          <button className="btn btn-primary btn-sm" disabled={loading} onClick={() => { onCalc(); setExpanded(true); }}>
            {loading ? t('combine.calculating') : t('combine.calc')}
          </button>
        </div>
      </div>

      {result && expanded && (
        <div className="combine-result">
          <div className="combine-result-head">
            <span>{result.carrier} · {result.daysMin}-{result.daysMax} {t('result.days')} · {result.totalWeightKg}kg</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(false)}>{t('common.close')}</button>
          </div>
          <div className="combine-grid">
            <div className="combine-cell">
              <span className="lbl">{t('result.goodsValue')}</span>
              <span className="val">{fmt(result.breakdown.goodsValue, symbol, currency)}</span>
            </div>
            <div className="combine-cell">
              <span className="lbl">{t('combine.unifiedShipping')}</span>
              <span className="val">{fmt(result.breakdown.intlShipping, symbol, currency)}</span>
            </div>
            <div className="combine-cell">
              <span className="lbl">{t('result.duty')}</span>
              <span className="val">{fmt(result.breakdown.duty, symbol, currency)}</span>
            </div>
            <div className="combine-cell">
              <span className="lbl">{t('result.vat')}</span>
              <span className="val">{fmt(result.breakdown.vat, symbol, currency)}</span>
            </div>
            <div className="combine-cell total">
              <span className="lbl">{t('combine.landedTotal')}</span>
              <span className="val">{fmt(result.breakdown.total, symbol, currency)}</span>
            </div>
            <div className="combine-cell savings">
              <span className="lbl">{t('combine.savings')}</span>
              <span className="val">-{fmt(result.savings, symbol, currency)}</span>
            </div>
          </div>
          <div className="combine-compare">
            {t('combine.separate')}: {fmt(result.separateTotal, symbol, currency)}
          </div>
          {result.taxNote && <div className="combine-note">{t('result.taxNote')}: {result.taxNote}</div>}
          <div className="combine-items">
            {result.perItem.map((it) => (
              <div className="combine-item" key={it.itemId}>
                <span className="ci-title">{it.title?.slice(0, 22)}</span>
                <span className="ci-share">{t('combine.perItem')} {fmt(it.shippingShare, symbol, currency)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onRemove(it.itemId)}>{t('common.remove')}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
