import { useState, useEffect, lazy, Suspense } from 'react';
import { apiUrl, fetchMeta, searchProducts } from '../api.js';
import { matchSpecGroups, specGroupLabel, specValueLabel } from '../utils/specOptions.js';
import { pickShippingTiers } from '../utils/shipping.js';
import { useMember, memberFetch, memberLogin, memberRegister, memberLogout } from '../authStore.js';
import { useI18n } from '../i18n.js';

// 管理后台复用完整版 AdminPanel，但以全屏覆盖层方式在简版内打开（不跳路由）
const AdminPanel = lazy(() => import('./AdminPanel.jsx'));

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
    itemPrice: '商品价', origPrice: '原价', shipFastest: '最快', shipCheapest: '最省', shipMiddle: '均衡',
    goodsPrice: '商品价', intlShippingFee: '国际运费', dutyFee: '关税', vatFee: '增值税', feesFee: '服务费及其他', landedTotal: '到手合计', landedNote: '含商品、国际运费、关税、增值税及服务费',
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
    authLogin: '登录', authRegister: '注册', authEmail: '邮箱', authPassword: '密码', authName: '姓名',
    authLoginTitle: '登录账户', authRegisterTitle: '创建账户',
    authToRegister: '没有账户？注册', authToLogin: '已有账户？登录',
    authLogout: '退出登录', authMyOrders: '我的订单', authNoOrders: '暂无订单', authWelcome: '欢迎回来',
    authErr: '操作失败', authOk: '成功',
  },
  en: {
    'account.signIn': 'Sign In', 'account.myAccount': 'My Account',
    searchPlaceholder: 'Search products, e.g. phone case / cable',
    search: 'Search', hot: 'Hot: ', sold: 'Sold ', buyers: ' buyers',
    itemPrice: 'Item price', origPrice: 'Original', shipFastest: 'Fastest', shipCheapest: 'Cheapest', shipMiddle: 'Balanced',
    goodsPrice: 'Item price', intlShippingFee: 'Intl shipping', dutyFee: 'Duty', vatFee: 'VAT', feesFee: 'Service & fees', landedTotal: 'Landed total', landedNote: 'Includes item, intl shipping, duty, VAT and service fees',
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
    authLogin: 'Sign In', authRegister: 'Register', authEmail: 'Email', authPassword: 'Password', authName: 'Name',
    authLoginTitle: 'Sign in to your account', authRegisterTitle: 'Create your account',
    authToRegister: 'No account? Register', authToLogin: 'Already have an account? Sign in',
    authLogout: 'Sign Out', authMyOrders: 'My Orders', authNoOrders: 'No orders yet', authWelcome: 'Welcome back',
    authErr: 'Request failed', authOk: 'Success',
  },
};

// 到手价拆解：按某一档运费重算，并统一换算为人民币
function landedForTier(landed, quote) {
  const b = landed?.breakdown;
  const sh = landed?.shipping;
  if (!b || !b.total) return null;
  const rate = sh?.quoteUsd ? b.intlShipping / sh.quoteUsd : 1;
  const isCny = !b.totalCny || Math.abs(b.totalCny - b.total) < 0.01;
  const k = isCny ? 1 : b.totalCny / b.total;
  const goods = (b.goodsValue || 0) * k;
  const shipping = (quote ? quote.priceUsd * rate : b.intlShipping || 0) * k;
  const duty = (b.duty || 0) * k;
  const vat = (b.vat || 0) * k;
  const total = (quote ? b.total - b.intlShipping + quote.priceUsd * rate : b.total) * k;
  const fees = Math.max(0, total - goods - shipping - duty - vat);
  return { goods, shipping, duty, vat, fees, total };
}

function landedCny(landed) {
  return landedForTier(landed, null);
}

function useSimpleLang() {
  const [lang, setLangState] = useState(() => localStorage.getItem(LANG_KEY) || 'zh');
  const setLang = (l) => { setLangState(l); localStorage.setItem(LANG_KEY, l); };
  return { lang, setLang, t: (k) => STR[lang]?.[k] ?? STR.zh[k] ?? k };
}

export default function SimpleApp() {
  const { lang, setLang, t } = useSimpleLang();
  const { t: tFull } = useI18n(); // 管理后台复用完整版多语言词条
  const session = useMember();
  const [query, setQuery] = useState('');
  const [hot, setHot] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailTier, setDetailTier] = useState(null);
  const [authView, setAuthView] = useState(null); // null | 'auth' | 'account'
  const [adminOpen, setAdminOpen] = useState(false);
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

  // 三个到手价档位（最快/最省/均衡）：仅显示价格，不显示快递公司名称
  const tiers = pickShippingTiers(results?.carrierQuotes);
  const tierPrices = (p) => {
    if (!tiers.length || !p.landed) return [];
    const seen = new Set();
    return tiers
      .map((tr) => ({ label: tr.labels[0], price: landedForTier(p.landed, tr.quote)?.total }))
      .filter((x) => {
        if (x.price == null) return false;
        const r = Math.round(x.price);
        if (seen.has(r)) return false;
        seen.add(r);
        return true;
      });
  };

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
          <button
            type="button"
            className="header-account-link"
            onClick={() => setAuthView(session ? 'account' : 'auth')}
          >
            <span>{session ? (session.customer?.name || session.customer?.email || '').split(' ')[0] || t('authMyOrders') : t('authLogin')}</span>
          </button>
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
            <div className="card product-card simple-card" key={p.itemId} onClick={() => { setDetailTier(null); setDetailItemId(p.itemId); }}>
              <div className="product-img-wrap">
                <img className="product-img" src={p.imageUrl} alt="" loading="lazy" />
              </div>
              <div className="product-info">
                <div className="product-title">{lang !== 'zh' && p.titleEn ? p.titleEn : p.title}</div>
                <div className="product-orig">
                  <em>{t('origPrice')}</em>
                  {p.originalPrice && p.originalPrice > p.price ? (
                    <>
                      <s>¥{p.originalPrice.toLocaleString()}</s>
                      <b>¥{p.price.toLocaleString()}</b>
                    </>
                  ) : (
                    <span className="orig-val">¥{p.price.toLocaleString()}</span>
                  )}
                </div>
                <div className="product-prices">
                  {(tierPrices(p).length ? tierPrices(p) : [{ label: 'itemPrice', price: p.price }]).map((x) => (
                    <div
                      className="prod-price"
                      key={x.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailTier(x.label);
                        setDetailItemId(p.itemId);
                      }}
                    >
                      <em>{t(x.label)}</em>
                      <b>¥{Math.round(x.price).toLocaleString()}</b>
                    </div>
                  ))}
                </div>
                <div className="product-stats">
                  <span className="muted">
                    {pzh[p.platform] || ''}
                    {p.sales > 0 ? `${pzh[p.platform] ? ' · ' : ''}${t('sold')}${p.sales.toLocaleString()}` : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="simple-footer">
        {t('footer')}
        <button type="button" className="simple-admin-link" onClick={() => setAdminOpen(true)}>{t('admin')}</button>
      </footer>

      {detailItemId && (
        <SimpleDetail
          item={list.find((x) => x.itemId === detailItemId)}
          itemId={detailItemId}
          tiers={tiers}
          initialTier={detailTier}
          lang={lang}
          t={t}
          onClose={() => setDetailItemId(null)}
        />
      )}

      {authView === 'auth' && (
        <SimpleAuthModal lang={lang} t={t} onClose={() => setAuthView(null)} />
      )}
      {authView === 'account' && (
        <SimpleAccountPanel lang={lang} t={t} onClose={() => setAuthView(null)} />
      )}

      {adminOpen && (
        <div className="simple-admin-overlay">
          <button type="button" className="simple-admin-close" onClick={() => setAdminOpen(false)}>×</button>
          <Suspense fallback={<div className="loading">{t('loading')}</div>}>
            <AdminPanel t={tFull} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

// 简版登录/注册弹窗：站点内完成，跳转完整版
function SimpleAuthModal({ lang, t, onClose }) {
  const [mode, setMode] = useState('login'); // login | register
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await memberLogin(form.email, form.password);
      else await memberRegister(form.name, form.email, form.password);
      onClose();
    } catch (err) {
      setError(err.message || t('authErr'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="product-modal simple-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>
        <h3 className="simple-order-title">{mode === 'login' ? t('authLoginTitle') : t('authRegisterTitle')}</h3>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="settings-field">
              <label className="settings-label">{t('authName')}</label>
              <input className="settings-control" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
          )}
          <div className="settings-field">
            <label className="settings-label">{t('authEmail')}</label>
            <input className="settings-control" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div className="settings-field">
            <label className="settings-label">{t('authPassword')}</label>
            <input className="settings-control" type="password" minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)} required />
          </div>
          {error && <div className="track-error">{error}</div>}
          <button type="submit" className="btn btn-primary simple-order-btn" disabled={busy}>
            {busy ? '...' : (mode === 'login' ? t('authLogin') : t('authRegister'))}
          </button>
        </form>
        <button type="button" className="simple-auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? t('authToRegister') : t('authToLogin')}
        </button>
      </div>
    </div>
  );
}

// 简版会员中心弹窗：资料 + 订单列表 + 退出，站点内完成
function SimpleAccountPanel({ lang, t, onClose }) {
  const session = useMember();
  const [orders, setOrders] = useState(null);
  const customer = session?.customer || {};

  useEffect(() => {
    memberFetch('/api/auth/orders')
      .then(async (res) => (res.ok ? res.json() : []))
      .then((list) => setOrders(Array.isArray(list) ? list : []))
      .catch(() => setOrders([]));
  }, []);

  const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '—');

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="product-modal simple-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>
        <h3 className="simple-order-title">{t('authWelcome')}，{customer.name || customer.email}</h3>
        <div className="simple-account-email muted">{customer.email}</div>

        <div className="simple-account-orders">
          <div className="simple-desc-title">{t('authMyOrders')}</div>
          {orders === null && <div className="loading">{t('loading')}</div>}
          {Array.isArray(orders) && orders.length === 0 && (
            <div className="simple-empty" style={{ padding: '20px 0' }}>{t('authNoOrders')}</div>
          )}
          {Array.isArray(orders) && orders.length > 0 && (
            <div className="simple-order-list">
              {orders.map((o) => (
                <div className="simple-order-row" key={o.id || o.orderNo}>
                  <div className="simple-order-row-main">
                    <b>{o.orderNo}</b>
                    <span className="muted">{fmtDate(o.createdAt)}</span>
                  </div>
                  <div className="simple-order-row-side">
                    <span className="product-price">¥{(Number(o.totalCny) || Number(o.total) || 0).toLocaleString()}</span>
                    <span className="muted">{o.status || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="btn btn-ghost simple-order-btn" onClick={async () => { await memberLogout(); onClose(); }}>
          {t('authLogout')}
        </button>
      </div>
    </div>
  );
}

// 简版详情弹窗：图集 + 属性点选 + 数量 + 下单（无任何物流信息）
function SimpleDetail({ item, itemId, tiers = [], initialTier = null, lang, t, onClose }) {
  // 列表已有商品数据：先本地渲染，后端可用时再补全（静态托管下后端可能不在）
  const [detail, setDetail] = useState(item || null);
  const [error, setError] = useState('');
  const [activeImg, setActiveImg] = useState(item?.imageUrl || '');
  const [selections, setSelections] = useState({});
  const [skuNote, setSkuNote] = useState('');
  const [qty, setQty] = useState(1);
  const [showOrder, setShowOrder] = useState(false);
  const [pickedTier, setPickedTier] = useState(null);

  useEffect(() => {
    let alive = true;
    setError('');
    setDetail(item || null);
    setActiveImg(item?.imageUrl || '');
    fetch(apiUrl(`/api/product/${encodeURIComponent(itemId)}`))
      .then(async (res) => {
        const ct = res.headers.get('content-type') || '';
        // 后端不可达时静态站会回退到 index.html，不能当 JSON 解析
        if (!ct.includes('application/json')) throw new Error('backend-unavailable');
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'load failed');
        return d;
      })
      .then((d) => {
        if (!alive) return;
        setDetail((prev) => ({ ...prev, ...d }));
        setActiveImg(d.imageUrl || (d.gallery || [])[0] || '');
      })
      .catch(() => {
        // 保留列表数据，不打断浏览
        if (!alive) return;
        if (!item) setError(t('serviceDown'));
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const landed = landedCny(detail?.landed);
  const tierOptions = tiers
    .map((tr) => ({ label: tr.labels[0], quote: tr.quote, ...landedForTier(detail?.landed, tr.quote) }))
    .filter((x) => x.total != null);
  const defaultTier = (() => {
    if (!tierOptions.length) return null;
    if (initialTier) {
      const want = tierOptions.findIndex((x) => x.label === initialTier);
      if (want >= 0) return want;
    }
    const matched = tierOptions.findIndex((x) => x.quote?.carrier === detail?.landed?.shipping?.carrier);
    if (matched >= 0) return matched;
    const cheap = tierOptions.findIndex((x) => x.label === 'shipCheapest');
    return cheap >= 0 ? cheap : 0;
  })();
  const tierIdx = pickedTier ?? defaultTier;
  const selected = tierOptions[tierIdx] || landed;
  const landedTotal = selected?.total;
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
              {tierOptions.length > 0 && (
                <div className="product-tier-pick">
                  {tierOptions.map((o, i) => (
                    <button
                      key={`${o.label}-${i}`}
                      type="button"
                      className={`btn-chip spec-chip ${i === tierIdx ? 'active' : ''}`}
                      onClick={() => setPickedTier(i)}
                    >
                      {t(o.label)} ¥{Math.round(o.total).toLocaleString()}
                    </button>
                  ))}
                </div>
              )}
              {landedTotal != null && (
                <div className="product-detail-landed">
                  {t('landedTotal')} <b>¥{Math.round(landedTotal).toLocaleString()}</b>
                  <span className="muted"> · {t('landedNote')}</span>
                </div>
              )}

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
              landed: selected,
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
  const unit = item.landed || null;
  const perUnit = (v) => (v || 0) * item.qty;
  const total = (unit ? unit.total : item.price) * item.qty;

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
        {unit ? (
          <div className="simple-order-breakdown">
            <div><span>{t('goodsPrice')}</span><span>¥{perUnit(unit.goods).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            <div><span>{t('intlShippingFee')}</span><span>¥{perUnit(unit.shipping).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            <div><span>{t('dutyFee')}</span><span>¥{perUnit(unit.duty).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            <div><span>{t('vatFee')}</span><span>¥{perUnit(unit.vat).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            <div><span>{t('feesFee')}</span><span>¥{perUnit(unit.fees).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
            <div className="total"><span>{t('landedTotal')}</span><b>¥{Math.round(total).toLocaleString()}</b></div>
            <div className="note muted">{t('landedNote')}</div>
          </div>
        ) : (
          <div className="simple-order-total">{t('total')}<b>¥{total.toLocaleString()}</b><span className="muted">{t('totalNote')}</span></div>
        )}

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
