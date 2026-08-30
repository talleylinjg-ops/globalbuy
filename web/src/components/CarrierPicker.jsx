// 快递商选择器：展示多快递报价，自动推荐最优，点击切换后重新询价
import { useState } from 'react';

function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

export default function CarrierPicker({ quotes, current, onSelect, t }) {
  const [open, setOpen] = useState(false);
  const selected = quotes.find((q) => q.carrier === current) || null;

  if (!quotes || quotes.length === 0) return null;

  return (
    <div className="carrier-picker">
      <div className="carrier-picker-head">
        <span className="carrier-picker-label">{t('carrier.title') || 'International Courier'}</span>
        <button
          type="button"
          className="carrier-selected"
          onClick={() => setOpen(!open)}
        >
          {selected ? (
            <>
              <span className="dot">{selected.recommended ? '★' : ''}</span>
              <b>{selected.carrierName}</b>
              <span className="carrier-price">{fmt(selected.priceUsd)}</span>
              <span className="carrier-days">{selected.daysMin}-{selected.daysMax} {t('result.days')}</span>
              {selected.source === 'estimate' && <span className="pill">{t('source.estimate') || 'Est'}</span>}
            </>
          ) : (
            <>{t('carrier.select') || 'Select courier'}</>
          )}
          <span className="carrier-arrow">{open ? '▲' : '▼'}</span>
        </button>
      </div>

      {open && (
        <div className="carrier-list">
          {quotes.map((q) => (
            <button
              key={q.carrier}
              type="button"
              className={`carrier-option ${q.carrier === current ? 'active' : ''}`}
              onClick={() => {
                onSelect(q.carrier === current ? null : q.carrier);
                setOpen(false);
              }}
            >
              <div className="carrier-option-left">
                {q.recommended && <span className="carrier-best">BEST</span>}
                <b>{q.carrierName}</b>
                <span className="carrier-days">{q.daysMin}-{q.daysMax} {t('result.days')}</span>
              </div>
              <div className="carrier-option-right">
                <span className="carrier-price">{fmt(q.priceUsd)}</span>
                {q.source === 'estimate' && <span className="pill">{t('source.estimate') || 'Est'}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
