import { useState, useEffect } from 'react';
import { apiUrl, fetchMeta, searchProducts } from '../api.js';
import { matchSpecGroups, specGroupLabel, specValueLabel } from '../utils/specOptions.js';
import { useMember, memberFetch } from '../authStore.js';
import AccountMenu from './AccountMenu.jsx';

// 简易展示版（根路径）：中英双语、会员系统、后台入口；隐藏全部快递信息（渠道/运费/时效/清关）
// 商品价人民币展示，下单由服务端自动选渠道；用于对外分享
const PLATFORM_ZH = { pdd: '拼多多', taobao: '淘宝', tmall: '天猫', '1688': '1688', jd: '京东', ali: '速卖通' };
const PLATFORM_EN = { pdd: 'PDD', taobao: 'Taobao', tmall: 'Tmall', '1688': '1688', jd: 'JD', ali: 'AliExpress' };
const LANGS = [{ code: 'zh', label: '中文' }, { code: 'en', label: 'English' }];
const LANG_KEY = 'crossbuy_lang';
// 英文界面热搜词：后端会把英文关键词翻译为中文再搜平台商品库
const HOT_EN = ['phone case', 'wireless earbuds', 'data cable', 'power bank', 'smart watch', 'bluetooth speaker', 'LED light', 'toy'];

const STR = {
  zh: {
    'account.signIn': '登录', 'account.myAccount': '我的账户',
    searchPlaceholder: '搜索想买的商品，如：手机壳 / 数据线',
    search: '搜索', hot: '热搜：', sold: '已售', buyers: '人已买',
    noResults: '没有找到相关商品，换个关键词试试',
    serviceDown: '搜索服务暂时不可用，请稍后再试',
    loading: '加载中...', searching: '正在搜索...',
    description: '商品介绍', note: '备注', notePlaceholder: '对规格有特殊要求请在此说明（选填）',
    quantity: '数量', orderNow: '立即下单',
    confirmOrder: '确认下单', spec: '规格：', total: '合计：', totalNote: '（商品金额，以人民币计）',
    name: '姓名 *', phone: '手机', email: '邮箱 *', country: '国家 / 地区', countryPh: '如 US / GB',
    state: '省 / 州', city: '城市 *', postal: '邮编', line1: '详细地址 *', line2: '补充地址',
    useSaved: '使用已存地址', savedNone: '暂无已存地址',
    saveAddress: '保存到地址簿',
    formError: '请填写姓名、邮箱、城市和详细地址',
    submitting: '提交中...', submitOrder: '提交订单',
    doneTitle: '下单成功', orderNo: '订单号：', doneNote: '我们会尽快为您安排，请留意邮箱通知。', done: '完成',
    admin: '管理', footer: 'CrossBuy · 精选中国好物',
  },
  en: {
    'account.signIn': 'Sign In', 'account.myAccount': 'My Account',
    searchPlaceholder: 'Search products, e.g. phone case / cable',
    search: 'Search', hot: 'Hot: ', sold: 'Sold ', buyers: ' buyers',
    noResults: 'No products found, try another keyword',
    serviceDown: 'Search service unavailable, please try later',
    loading: 'Loading...', searching: 'Searching...',
    description: 'Description', note: 'Note', notePlaceholder: 'Special requirements (optional)',
    quantity: 'Quantity', orderNow: 'Order Now',
    confirmOrder: 'Confirm Order', spec: 'Specs: ', total: 'Total: ', totalNote: ' (product amount, CNY)',
    name: 'Name *', phone: 'Phone', email: 'Email *', country: 'Country / Region', countryPh: 'e.g. US / GB',
    state: 'State / Province', city: 'City *', postal: 'Postal Code', line1: 'Address *', line2: 'Address Line 2',
    useSaved: 'Use saved address', savedNone: 'No saved addresses',
    saveAddress: 'Save to address book',
    formError: 'Name, email, city and address are required',
    submitting: 'Submitting...', submitOrder: 'Submit Order',
    doneTitle: 'Order Placed', orderNo: 'Order No.: ', doneNote: 'We will process your order shortly, please check your email.', done: 'Done',
    admin: 'Admin', footer: 'CrossBuy · Selected products from China',
  },
};

function useSimpleLang() {
  const [lang, setLangState] = useState(() => localStorage.getItem(LANG_KEY) || 'zh');
  const setLang = (l) => { setLangState(l); localStorage.setItem(LANG_KEY, l); };
  return { lang, setLang, t: (k) => STR[lang]?.[k] ?? STR.zh[k] ?? k };
}

export default function SimpleApp() {
  const { lang, setLang, t } = useSimpleLang();
  const [query, setQuery] = useState('');
  const [hot, setHot] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const pzh = lang === 'zh' ? PLATFORM_ZH : PLATFORM_EN;

  useEffect(() => {
    // 首屏用热搜词搜索：后端 /api/search 要求 q 非空，空关键词会 400
    let searched = false;
    const fallback = lang === 'zh' ? '手机壳' : 'phone case';
    const run = (kw) => { if (!searched) { searched = true; doSearch(kw); } };
    fetchMeta()
      .then((m) => { setHot(m.hotKeywords || []); run(m.hotKeywords?.[0] || fallback); })
      .catch(() => run(fallback));
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
        <a className="simple-logo" href="#/">CrossBuy</a>
        <form
          className="simple-search"
          onSubmit={(e) => { e.preventDefault(); doSearch(query.trim()); }}
        >
          <input
            className="settings-control"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">{t('search')}</button>
        </form>
        <div className="simple-header-tools">
          <AccountMenu t={t} />
          <select
            className="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Language"
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </header>

      <main className="simple-main">
        <div className="simple-hot">
          {t('hot')}
          {(lang === 'en' ? HOT_EN : (hot.length ? hot : ['手机壳', '数据线', '蓝牙耳机'])).map((k) => (
            <button key={k} type="button" className="simple-hot-tag" onClick={() => doSearch(k)}>{k}</button>
          ))}
        </div>

        {loading && <div className="loading">{t('searching')}</div>}
        {!loading && results?.error && <div className="track-error">{t('serviceDown')}</div>}
        {!loading && !results?.error && list.length === 0 && (
          <div className="simple-empty">{t('noResults')}</div>
        )}

        <div className="simple-grid">
          {list.map((p) => (
            <div className="card product-card simple-card" key={p.itemId} onClick={() => setDetailItemId(p.itemId)}>
              <div className="product-img-wrap">
                <img className="product-img" src={p.imageUrl} alt="" loading="lazy" />
              </div>
              <div className="product-info">
                <div className="product-title">{lang !== 'zh' && p.titleEn ? p.titleEn : p.title}</div>
                <div className="product-stats">
                  <span className="product-price">¥{p.price.toLocaleString()}</span>
                  <span className="muted">
                    {pzh[p.platform] ? ` · ${pzh[p.platform]}` : ''}
                    {p.sales > 0 ? ` · ${t('sold')}${p.sales.toLocaleString()}` : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="simple-footer">
        {t('footer')}
        <a className="simple-admin-link" href="#/admin">{t('admin')}</a>
      </footer>

      {detailItemId && (
        <SimpleDetail itemId={detailItemId} lang={lang} t={t} onClose={() => setDetailItemId(null)} />
      )}
    </div>
  );
}

// 简版详情弹窗：图集 + 属性点选 + 数量 + 下单（无任何物流信息）
function SimpleDetail({ itemId, lang, t, onClose }) {
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
        if (!res.ok) throw new Error(d.error || 'load failed');
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
    ...specGroups.map((g) => (selections[g.key] ? `${specGroupLabel(g, lang)}: ${specValueLabel(selections[g.key], lang)}` : '')),
    skuNote.trim(),
  ].filter(Boolean).join('; ');

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>
        {!detail && !error && <div className="loading">{t('loading')}</div>}
        {error && <div className="track-error">{error}</div>}
        {detail && (
          <div className="product-detail-grid">
            <div className="product-detail-media">
              <img className="product-detail-img" src={activeImg || detail.imageUrl} alt="" />
              {(detail.gallery || []).length > 1 && (
                <div className="product-gallery-wrap">
                  <button type="button" className="product-gallery-arrow" aria-label="prev" onClick={() => stepGallery(-1)}>‹</button>
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
                  <button type="button" className="product-gallery-arrow" aria-label="next" onClick={() => stepGallery(1)}>›</button>
                </div>
              )}
              {detail.description && (
                <div className="product-detail-desc">
                  <div className="simple-desc-title">{t('description')}</div>
                  <p>{lang !== 'zh' && detail.descriptionEn ? detail.descriptionEn : detail.description}</p>
                </div>
              )}
            </div>

            <div className="product-detail-info">
              <h3 className="product-detail-title">
                {lang !== 'zh' && detail.titleEn ? detail.titleEn : detail.title}
              </h3>
              <div className="product-detail-price-row">
                <span className="product-detail-price">¥{detail.price.toLocaleString()}</span>
                {detail.originalPrice > detail.price && (
                  <span className="product-detail-orig">¥{detail.originalPrice.toLocaleString()}</span>
                )}
                {detail.sales > 0 && (
                  <span className="product-detail-sales">{detail.sales.toLocaleString()}+{t('buyers')}</span>
                )}
              </div>

              {specGroups.map((g) => (
                <div className="product-sku-block" key={g.key}>
                  <div className="settings-label">{specGroupLabel(g, lang)}</div>
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
                          {specValueLabel(v, lang)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="product-sku-block">
                <div className="settings-label">{t('note')}</div>
                <textarea
                  className="settings-control product-spec-note"
                  rows={2}
                  maxLength={200}
                  placeholder={t('notePlaceholder')}
                  value={skuNote}
                  onChange={(e) => setSkuNote(e.target.value)}
                />
              </div>

              <div className="product-qty-block">
                <div className="settings-label">{t('quantity')}</div>
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
                {t('orderNow')}
              </button>
            </div>
          </div>
        )}
        {showOrder && detail && (
          <SimpleOrder
            item={{
              itemId: detail.itemId,
              title: lang !== 'zh' && detail.titleEn ? detail.titleEn : detail.title,
              imageUrl: detail.imageUrl,
              price: detail.price,
              qty,
              skuName: specText,
            }}
            lang={lang} t={t}
            onClose={() => setShowOrder(false)}
            onDone={() => { setShowOrder(false); onClose(); }}
          />
        )}
      </div>
    </div>
  );
}

// 简版下单：会员预填/地址簿 + 联系人 + 收货地址 + 金额合计（人民币），无渠道/运费/时效
function SimpleOrder({ item, lang, t, onClose, onDone }) {
  const session = useMember();
  const [form, setForm] = useState({ name: '', phone: '', email: '', country: '', state: '', city: '', postal: '', line1: '', line2: '' });
  const [addresses, setAddresses] = useState([]);
  const [saveAddress, setSaveAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const total = item.price * item.qty;

  // 会员登录态：预填资料 + 拉取地址簿
  useEffect(() => {
    if (!session) return;
    const c = session.customer || {};
    setForm((f) => ({ ...f, name: f.name || c.name || '', email: f.email || c.email || '' }));
    memberFetch('/api/auth/addresses')
      .then(async (res) => (res.ok ? res.json() : []))
      .then((list) => setAddresses(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, [session]);

  const applyAddress = (id) => {
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    setForm((f) => ({
      ...f,
      name: a.recipient || f.name, phone: a.phone || f.phone,
      country: a.country || f.country, state: a.state || '', city: a.city || '',
      postal: a.postal || '', line1: a.line1 || '', line2: a.line2 || '',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.line1 || !form.city) {
      setError(t('formError'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await memberFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ itemId: item.itemId, quantity: item.qty, skuName: item.skuName }],
          contact: { name: form.name, phone: form.phone, email: form.email },
          address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postal: form.postal, country: form.country || 'US' },
          currency: 'CNY',
          serviceFeeRate: 0,
          saveAddress: Boolean(session && saveAddress),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'order failed');
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
            <h3>{t('doneTitle')}</h3>
            <p>{t('orderNo')}<b>{orderNo}</b></p>
            <p className="muted">{t('doneNote')}</p>
            <button className="btn btn-primary" onClick={onDone}>{t('done')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="product-modal simple-order-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>
        <h3 className="simple-order-title">{t('confirmOrder')}</h3>
        <div className="simple-order-item">
          <img src={item.imageUrl} alt="" />
          <div className="simple-order-item-info">
            <div className="simple-order-item-name">{item.title}</div>
            {item.skuName && <div className="muted">{t('spec')}{item.skuName}</div>}
            <div className="simple-order-item-price">¥{item.price.toLocaleString()} × {item.qty}</div>
          </div>
        </div>
        <div className="simple-order-total">{t('total')}<b>¥{total.toLocaleString()}</b><span className="muted">{t('totalNote')}</span></div>

        <form onSubmit={submit}>
          {session && addresses.length > 0 && (
            <div className="simple-address-pick">
              <select className="settings-control" defaultValue="" onChange={(e) => applyAddress(e.target.value)}>
                <option value="">{t('useSaved')}</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>{a.recipient} · {a.line1}, {a.city} {a.country}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-grid">
            <div>
              <label className="settings-label">{t('name')}</label>
              <input className="settings-control" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="settings-label">{t('phone')}</label>
              <input className="settings-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="settings-label">{t('email')}</label>
              <input className="settings-control" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="settings-label">{t('country')}</label>
              <input className="settings-control" value={form.country} onChange={(e) => set('country', e.target.value)} maxLength={2} placeholder={t('countryPh')} />
            </div>
            <div>
              <label className="settings-label">{t('state')}</label>
              <input className="settings-control" value={form.state} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div>
              <label className="settings-label">{t('city')}</label>
              <input className="settings-control" value={form.city} onChange={(e) => set('city', e.target.value)} required />
            </div>
            <div>
              <label className="settings-label">{t('postal')}</label>
              <input className="settings-control" value={form.postal} onChange={(e) => set('postal', e.target.value)} />
            </div>
            <div className="form-grid-full">
              <label className="settings-label">{t('line1')}</label>
              <input className="settings-control" value={form.line1} onChange={(e) => set('line1', e.target.value)} required />
            </div>
            <div className="form-grid-full">
              <label className="settings-label">{t('line2')}</label>
              <input className="settings-control" value={form.line2} onChange={(e) => set('line2', e.target.value)} />
            </div>
          </div>
          {session && (
            <label className="simple-save-address">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
              <span>{t('saveAddress')}</span>
            </label>
          )}
          {error && <div className="track-error">{error}</div>}
          <button type="submit" className="btn btn-primary simple-order-btn" disabled={submitting}>
            {submitting ? t('submitting') : t('submitOrder')}
          </button>
        </form>
      </div>
    </div>
  );
}
