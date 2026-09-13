// 快递渠道选择器：行末按钮 + 下拉浮层列表，点击切换后由父组件重新询价
import { useState } from 'react';

function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

export default function CarrierPicker({ quotes, current, onSelect, t }) {
  const [open, setOpen] = useState(false);
  // current 为选中的报价对象；多渠道场景按渠道名（productName）识别
  const isSel = (q) => current && q.productName === current.productName;
  const selected = quotes.find(isSel) || null;

  if (!quotes || quotes.length === 0) return null;

  return (
    <div className="carrier-inline">
      <button
        type="button"
        className="carrier-selected"
        onClick={() => setOpen(!open)}
      >
        {selected && <b>{selected.productName}</b>}
        <span className="carrier-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="carrier-list">
          {quotes.map((q) => (
            <button
              key={q.productName}
              type="button"
              className={`carrier-option ${isSel(q) ? 'active' : ''}`}
              onClick={() => {
                onSelect(isSel(q) ? null : q);
                setOpen(false);
              }}
            >
              <div className="carrier-option-left">
                {q.recommended && <span className="carrier-best">{t('result.recommended') || '推荐'}</span>}
                <b>{q.productName}</b>
                <span className="carrier-days">{q.carrierName} · {q.daysMin}-{q.daysMax} {t('result.days')}</span>
              </div>
              <div className="carrier-option-right">
                <span className="carrier-price">{fmt(q.priceUsd)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
