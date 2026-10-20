import { useState, useEffect } from 'react';
import { apiUrl, fetchMeta, searchProducts } from '../api.js';
import { matchSpecGroups, specGroupLabel, specValueLabel } from '../utils/specOptions.js';

// 简易展示版（#/simple）：纯中文、隐藏全部快递信息（渠道/运费/时效/清关/仓库）
// 仅展示商品与人民币价格，下单由服务端自动选渠道；用于对外分享
const PLATFORM_ZH = { pdd: '拼多多', taobao: '淘宝', tmall: '天猫', '1688': '1688', jd: '京东', ali: '速卖通' };

export default function SimpleApp() {
  const [query, setQuery] = useState('');
  const [hot, setHot] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);

  useEffect(() => {
    fetchMeta().then((m) => setHot(m.hotKeywords || [])).catch(() => {});
    doSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = (kw) => {
    setQuery(kw);
    setLoading(true);
    searchProducts({ q: kw, country: 'US', currency: 'CNY' })
      .then((r) => setResults(r))
      .catch(() => setResults({ results: [], total: 0, error: true }))
      .finally(() => setLoading(false));
  };

  const list = (results?.results || []).filter((p) => p.price > 0);

  return (
    <div className="simple-app">
      <header className="simple-header">
        <a className="simple-logo" href="#/simple">CrossBuy</a>
        <form
          className="simple-search"
          onSubmit={(e) => { e.preventDefault(); doSearch(query.trim()); }}
        >
          <input
            className="settings-control"
            placeholder="搜索想买的商品，如：手机壳 / 数据线"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">搜索</button>
        </form>
      </header>

      <main className="simple-main">
        <div className="simple-hot">
          热搜：
          {(hot.length ? hot : ['手机壳', '数据线', '蓝牙耳机']).map((k) => (
            <button key={k} type="button" className="simple-hot-tag" onClick={() => doSearch(k)}>{k}</button>
          ))}
        </div>

        {loading && <div className="loading">正在搜索...</div>}
        {!loading && results?.error && <div className="track-error">搜索服务暂时不可用，请稍后再试</div>}
        {!loading && !results?.error && list.length === 0 && (
          <div className="simple-empty">没有找到相关商品，换个关键词试试</div>
        )}

        <div className="simple-grid">
          {list.map((p) => (
            <div className="card product-card simple-card" key={p.itemId} onClick={() => setDetailItemId(p.itemId)}>
              <div className="product-img-wrap">
                <img className="product-img" src={p.imageUrl} alt="" loading="lazy" />
              </div>
              <div className="product-info">
                <div className="product-title">{p.title}</div>
                <div className="product-stats">
                  <span className="product-price">¥{p.price.toLocaleString()}</span>
                  <span className="muted">{PLATFORM_ZH[p.platform] || ''}{p.sales > 0 ? ` · 已售${p.sales.toLocaleString()}` : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="simple-footer">CrossBuy · 精选中国好物</footer>

      {detailItemId && (
        <SimpleDetail itemId={detailItemId} onClose={() => setDetailItemId(null)} />
      )}
    </div>
  );
}

// 简版详情弹窗：图集 + 中文描述 + 属性点选 + 数量 + 下单（无任何物流信息）
function SimpleDetail({ itemId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [activeImg, setActiveImg] = useState('');
  const [selections, setSelections] = useState({});
  const [skuNote, setSkuNote] = useState('');
  const [qty, setQty] = useState(1);
  const [showOrder, setShowOrder] = useState(false);

  useEffect(() => {
    fetch(apiUrl(`/api/product/${encodeURIComponent(itemId)}`))
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '加载失败');
        return d;
      })
      .then((d) => {
        setDetail(d);
        setActiveImg(d.imageUrl || (d.gallery || [])[0] || '');
      })
      .catch((e) => setError(e.message));
  }, [itemId]);

  const specGroups = detail ? matchSpecGroups(detail.title) : [];
  const stepGallery = (dir) => {
    const gallery = detail?.gallery || [];
    if (gallery.length < 2) return;
    const cur = gallery.indexOf(activeImg);
    setActiveImg(gallery[(cur + dir + gallery.length) % gallery.length]);
  };
  const specText = [
    ...specGroups.map((g) => (selections[g.key] ? `${specGroupLabel(g, 'zh')}：${specValueLabel(selections[g.key], 'zh')}` : '')),
    skuNote.trim(),
  ].filter(Boolean).join('; ');

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>
        {!detail && !error && <div className="loading">加载中...</div>}
        {error && <div className="track-error">{error}</div>}
        {detail && (
          <div className="product-detail-grid">
            <div className="product-detail-media">
              <img className="product-detail-img" src={activeImg || detail.imageUrl} alt="" />
              {(detail.gallery || []).length > 1 && (
                <div className="product-gallery-wrap">
                  <button type="button" className="product-gallery-arrow" aria-label="上一张" onClick={() => stepGallery(-1)}>‹</button>
                  <div className="product-gallery">
                    {detail.gallery.map((g, i) => (
                      <button
                        key={i} type="button"
                        className={`product-gallery-thumb ${activeImg === g ? 'active' : ''}`}
                        onClick={() => setActiveImg(g)}
                      >
                        <img src={g} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="product-gallery-arrow" aria-label="下一张" onClick={() => stepGallery(1)}>›</button>
                </div>
              )}
              {detail.description && (
                <div className="product-detail-desc">
                  <div className="simple-desc-title">商品介绍</div>
                  <p>{detail.description}</p>
                </div>
              )}
            </div>

            <div className="product-detail-info">
              <h3 className="product-detail-title">{detail.title}</h3>
              <div className="product-detail-price-row">
                <span className="product-detail-price">¥{detail.price.toLocaleString()}</span>
                {detail.originalPrice > detail.price && (
                  <span className="product-detail-orig">¥{detail.originalPrice.toLocaleString()}</span>
                )}
                {detail.sales > 0 && (
                  <span className="product-detail-sales">{detail.sales.toLocaleString()}+人已买</span>
                )}
              </div>

              {specGroups.map((g) => (
                <div className="product-sku-block" key={g.key}>
                  <div className="settings-label">{specGroupLabel(g, 'zh')}</div>
                  <div className="product-sku-list">
                    {g.values.map((v) => {
                      const active = selections[g.key] === v;
                      const hex = typeof v === 'object' ? v.hex : null;
                      return (
                        <button
                          key={specValueLabel(v, 'en')}
                          type="button"
                          className={`btn-chip spec-chip ${active ? 'active' : ''}`}
                          onClick={() => setSelections((s) => ({ ...s, [g.key]: active ? null : v }))}
                        >
                          {hex && <span className="spec-dot" style={{ background: hex }} aria-hidden="true" />}
                          {specValueLabel(v, 'zh')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="product-sku-block">
                <div className="settings-label">备注</div>
                <textarea
                  className="settings-control product-spec-note"
                  rows={2}
                  maxLength={200}
                  placeholder="对规格有特殊要求请在此说明（选填）"
                  value={skuNote}
                  onChange={(e) => setSkuNote(e.target.value)}
                />
              </div>

              <div className="product-qty-block">
                <div className="settings-label">数量</div>
                <div className="product-qty-row">
                  <button type="button" className="product-qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <input
                    className="settings-control product-qty-input"
                    type="number" min="1" max="99"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                  />
                  <button type="button" className="product-qty-btn" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
                </div>
              </div>

              <button className="btn btn-primary product-order-btn" onClick={() => setShowOrder(true)}>
                立即下单
              </button>
            </div>
          </div>
        )}
        {showOrder && detail && (
          <SimpleOrder
            item={{
              itemId: detail.itemId,
              title: detail.title,
              imageUrl: detail.imageUrl,
              price: detail.price,
              qty,
              skuName: specText,
            }}
            onClose={() => setShowOrder(false)}
            onDone={() => { setShowOrder(false); onClose(); }}
          />
        )}
      </div>
    </div>
  );
}

// 简版下单：仅联系人 + 收货地址 + 金额合计（人民币），无渠道/运费/时效
function SimpleOrder({ item, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', country: '', state: '', city: '', postal: '', line1: '', line2: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const total = item.price * item.qty;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.line1 || !form.city) {
      setError('请填写姓名、邮箱、城市和详细地址');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ itemId: item.itemId, quantity: item.qty, skuName: item.skuName }],
          contact: { name: form.name, phone: form.phone, email: form.email },
          address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postal: form.postal, country: form.country || 'US' },
          currency: 'CNY',
          serviceFeeRate: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '下单失败');
      setOrderNo(data.order?.orderNo || data.orderNo || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (orderNo) {
    return (
      <div className="order-modal-mask" onClick={onDone}>
        <div className="product-modal simple-order-modal" onClick={(e) => e.stopPropagation()}>
          <button className="order-modal-close" onClick={onDone}>×</button>
          <div className="simple-order-done">
            <h3>下单成功</h3>
            <p>订单号：<b>{orderNo}</b></p>
            <p className="muted">我们会尽快为您安排，请留意邮箱通知。</p>
            <button className="btn btn-primary" onClick={onDone}>完成</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="product-modal simple-order-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>
        <h3 className="simple-order-title">确认下单</h3>
        <div className="simple-order-item">
          <img src={item.imageUrl} alt="" />
          <div className="simple-order-item-info">
            <div className="simple-order-item-name">{item.title}</div>
            {item.skuName && <div className="muted">规格：{item.skuName}</div>}
            <div className="simple-order-item-price">¥{item.price.toLocaleString()} × {item.qty}</div>
          </div>
        </div>
        <div className="simple-order-total">合计：<b>¥{total.toLocaleString()}</b><span className="muted">（商品金额，以人民币计）</span></div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <div>
              <label className="settings-label">姓名 *</label>
              <input className="settings-control" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="settings-label">手机</label>
              <input className="settings-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="settings-label">邮箱 *</label>
              <input className="settings-control" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="settings-label">国家 / 地区</label>
              <input className="settings-control" value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={2} placeholder="如 US / GB" />
            </div>
            <div>
              <label className="settings-label">省 / 州</label>
              <input className="settings-control" value={form.state} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div>
              <label className="settings-label">城市 *</label>
              <input className="settings-control" value={form.city} onChange={(e) => set('city', e.target.value)} required />
            </div>
            <div>
              <label className="settings-label">邮编</label>
              <input className="settings-control" value={form.postal} onChange={(e) => set('postal', e.target.value)} />
            </div>
            <div className="form-grid-full">
              <label className="settings-label">详细地址 *</label>
              <input className="settings-control" value={form.line1} onChange={(e) => set('line1', e.target.value)} required />
            </div>
            <div className="form-grid-full">
              <label className="settings-label">补充地址</label>
              <input className="settings-control" value={form.line2} onChange={(e) => set('line2', e.target.value)} />
            </div>
          </div>
          {error && <div className="track-error">{error}</div>}
          <button type="submit" className="btn btn-primary simple-order-btn" disabled={submitting}>
            {submitting ? '提交中...' : '提交订单'}
          </button>
        </form>
      </div>
    </div>
  );
}
