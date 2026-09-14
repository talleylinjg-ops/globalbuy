import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n.js';
import { fetchMeta, searchProducts, parseLink, apiUrl } from './api.js';
import ProductCard from './components/ProductCard.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Loading from './components/Loading.jsx';
import CarrierPicker from './components/CarrierPicker.jsx';
import CombineBar from './components/CombineBar.jsx';
import OrderModal from './components/OrderModal.jsx';
import AdminPanel from './components/AdminPanel.jsx';

const DEFAULT_COUNTRY = 'US';
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_PLATFORMS = ['taobao', 'jd', 'pdd', '1688'];
const DEFAULT_HOT_KEYWORDS = [
  '蓝牙耳机', '无线充电器', '智能手表', '保温杯',
  '手机壳', '机械键盘', '行李箱', 'LED台灯',
  '瑜伽垫', '猫玩具', '零食', '运动鞋',
  '降噪',
];

function getAdminRoute() {
  return window.location.hash.startsWith('#/admin');
}

// 从全部快递报价中挑三档：最快 / 最便宜 / 居中；三档尽量为三个不同报价
function pickShippingTiers(quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  const byPrice = [...quotes].sort((a, b) => a.priceUsd - b.priceUsd);
  const byDays = [...quotes].sort(
    (a, b) => (a.daysMin + a.daysMax) / 2 - (b.daysMin + b.daysMax) / 2
  );
  const cheapest = byPrice[0];
  const fastest = byDays[0];
  // 按价格数字去重：三个档位的价格数值必须互不相同，视觉上才是三个价格
  const usedPrices = new Set([cheapest, fastest].map((q) => q.priceUsd));

  // 居中：从价格中位出发向两侧找与最便宜/最快价格不同的报价
  let middle = null;
  const start = Math.floor(byPrice.length / 2);
  for (let d = 0; d < byPrice.length && !middle; d++) {
    for (const i of [start + d, start - d]) {
      if (i >= 0 && i < byPrice.length) {
        const q = byPrice[i];
        if (!usedPrices.has(q.priceUsd)) {
          middle = q;
          break;
        }
      }
    }
  }

  const tiers = [];
  const push = (label, quote) => {
    const existing = tiers.find((tr) => tr.quote === quote);
    if (existing) existing.labels.push(label);
    else tiers.push({ labels: [label], quote });
  };
  push('shipFastest', fastest);
  push('shipCheapest', cheapest);
  if (middle) push('shipMiddle', middle);
  return tiers;
}

export default function App() {
  const { t, lang, setLang, languages } = useI18n();  const [isAdmin, setIsAdmin] = useState(getAdminRoute());
  const [meta, setMeta] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [lastSearch, setLastSearch] = useState(null);
  const [linkMatched, setLinkMatched] = useState(null);

  // settings
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [platforms, setPlatforms] = useState([...DEFAULT_PLATFORMS]);
  const [profitRate, setProfitRate] = useState(50);
  const [sortBy, setSortBy] = useState('recommended');
  const [carrier, setCarrier] = useState(null); // 选中的报价对象（渠道级）
  // 合并包裹：多商品统一运费/关税/增值税
  const [combineList, setCombineList] = useState([]);
  const [combineResult, setCombineResult] = useState(null);
  const [orderItem, setOrderItem] = useState(null);
  const [combineLoading, setCombineLoading] = useState(false);

  useEffect(() => {
    const onHash = () => setIsAdmin(getAdminRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetchMeta()
      .then((m) => {
        setMeta(m);
        if (m.countries?.length && !m.countries.find((c) => c.code === country)) {
          setCountry(m.countries[0].code);
        }
      })
      .catch(() => {});
  }, []);

  // 合并包裹：切换选中、调用统一计价接口
  const toggleCombine = useCallback((item) => {
    setCombineList((prev) => {
      if (prev.some((x) => x.itemId === item.itemId)) {
        return prev.filter((x) => x.itemId !== item.itemId);
      }
      setCombineResult(null);
      return [...prev, item];
    });
  }, []);

  const removeCombine = useCallback((itemId) => {
    setCombineList((prev) => prev.filter((x) => x.itemId !== itemId));
    setCombineResult(null);
  }, []);

  const calcCombine = useCallback(async () => {
    if (combineList.length === 0) return;
    setCombineLoading(true);
    try {
      const res = await fetch(apiUrl('/api/combine'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: combineList.map((x) => x.itemId),
          country,
          currency,
          profitRate,
        }),
      });
      const data = await res.json();
      if (res.ok) setCombineResult(data);
    } finally {
      setCombineLoading(false);
    }
  }, [combineList, country, currency, profitRate]);

  const doSearch = useCallback(async (q) => {
    if (!q) return;
    setLoading(true);
    setError(null);
    setLinkMatched(null);
    try {
      const data = await searchProducts({
        q,
        country,
        currency,
        platforms,
        profitRate: profitRate / 100,
        carrier: carrier ? (carrier.productName || carrier.carrier) : undefined,
      });
      setResults(data);
      setLastSearch({ q, country, currency });
    } catch (e) {
      setError(e.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [country, currency, platforms, profitRate, carrier]);

  const handleParseLink = useCallback(async (url) => {
    if (!url) return;
    setParsing(true);
    setError(null);
    try {
      const data = await parseLink(url);
      if (!data.ok) {
        setError(data.error || 'Unrecognized link');
        setLinkMatched(null);
        return;
      }
      setLinkMatched(data);
      if (data.product?.title) {
        setQuery(data.product.title);
      }
      // 解析出商品标题后自动执行全平台比价搜索
      if (data.product?.title) {
        await doSearch(data.product.title);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }, [doSearch]);

  // 初始加载演示数据
  useEffect(() => {
    doSearch('wireless earbuds');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencySymbol = useMemo(() => {
    const s = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', KRW: '₩', CNY: '¥', SGD: 'S$',
      CAD: 'C$', AUD: 'A$', HKD: 'HK$', TWD: 'NT$', INR: '₹', BRL: 'R$',
      MXN: 'MX$', RUB: '₽', TRY: '₺', ZAR: 'R', CHF: 'Fr', SEK: 'kr', NOK: 'kr',
      PLN: 'zł', THB: '฿', VND: '₫', MYR: 'RM', PHP: '₱', IDR: 'Rp', AED: 'د.إ', SAR: 'ر.س',
    };
    return s[currency] ?? currency;
  }, [currency]);

  // 客户端二次排序
  const sortedResults = useMemo(() => {
    if (!results) return null;
    const list = [...results.results];
    switch (sortBy) {
      case 'price':
        list.sort((a, b) => a.landed.breakdown.total - b.landed.breakdown.total);
        break;
      case 'priceDesc':
        list.sort((a, b) => b.landed.breakdown.total - a.landed.breakdown.total);
        break;
      case 'rating':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'sales':
        list.sort((a, b) => (b.sales || 0) - (a.sales || 0));
        break;
      case 'speed':
        list.sort((a, b) =>
          (a.landed.shipping.daysMin + a.landed.shipping.daysMax) / 2 -
          (b.landed.shipping.daysMin + b.landed.shipping.daysMax) / 2
        );
        break;
      default:
        list.sort((a, b) => b.scores.total - a.scores.total);
    }
    return list;
  }, [results, sortBy]);

  const sortOptions = useMemo(() => [
    { id: 'recommended', label: t('sort.recommended') },
    { id: 'price', label: t('sort.priceAsc') },
    { id: 'priceDesc', label: t('sort.priceDesc') },
    { id: 'rating', label: t('sort.rating') },
    { id: 'sales', label: t('sort.sales') },
    { id: 'speed', label: t('sort.speed') },
  ], [t]);

  const shippingTiers = pickShippingTiers(results?.carrierQuotes);

  return (
    <div>
      <header className="header">
        <div className="lang-switcher">
          <select
            className="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Language"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.native}</option>
            ))}
          </select>
        </div>
        <div className="container header-inner">
          <h1 className="logo">CrossBuy</h1>
          <p className="tagline">Buy More Save More</p>
        </div>
      </header>

      <main className="container">
        {isAdmin ? (
          <AdminPanel t={t} />
        ) : (
        <>
        <SearchPanel
          query={query}
          setQuery={setQuery}
          onSearch={doSearch}
          onParseLink={handleParseLink}
          loading={loading}
          parsing={parsing}
          t={t}
          categories={meta?.hotKeywords || meta?.categories || DEFAULT_HOT_KEYWORDS}
        />

        {linkMatched && linkMatched.ok && linkMatched.product && (
          <div className="translate-badge" style={{ marginTop: '10px' }}>
            {t('result.linkMatched')} <b>{linkMatched.product.title}</b>
            {linkMatched.product.price != null && ` · ¥${linkMatched.product.price}`}
          </div>
        )}

        <SettingsPanel
          meta={meta}
          country={country}
          setCountry={setCountry}
          currency={currency}
          setCurrency={setCurrency}
          platforms={platforms}
          setPlatforms={setPlatforms}
          profitRate={profitRate}
          setProfitRate={setProfitRate}
          t={t}
        >
          {lastSearch && results && results.carrierQuotes && results.carrierQuotes.length > 0 && (
            <CarrierPicker
              quotes={results.carrierQuotes}
              current={results.carrier}
              onSelect={(q) => {
                setCarrier(q);
                if (lastSearch?.q) doSearch(lastSearch.q);
              }}
              t={t}
            />
          )}
        </SettingsPanel>

        {lastSearch && results && (
          <div className="results-head">
            <div className="results-count">
              {results.translatedKeyword && results.translatedKeyword !== results.inputKeyword && (
                <span className="translate-badge">{t('search.keywordTranslated')}: <b>{results.translatedKeyword}</b></span>
              )}
              <span>{t('result.totalLabel', { total: results.total, platforms: results.sourceInfo.filter((s) => s.count > 0).length })}</span>
            </div>
            <div className="sort-bar">
              {sortOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`btn-chip ${sortBy === o.id ? 'active' : ''}`}
                  onClick={() => setSortBy(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && <Loading t={t} />}

        {error && <div className="loading" style={{ color: 'var(--bad)' }}>{error}</div>}

        {!loading && results && results.results.length === 0 && (
          <div className="loading">{t('result.noResults')}</div>
        )}

        {!loading && sortedResults && sortedResults.length > 0 && (
          <div className="result-grid">
            {sortedResults.map((item, i) => (
              <ProductCard
                key={item.itemId || i}
                item={item}
                rank={item.rank}
                currency={currency}
                currencySymbol={currencySymbol}
                shippingTiers={shippingTiers}
                inCombine={combineList.some((x) => x.itemId === item.itemId)}
                onToggleCombine={() => toggleCombine(item)}
                onOrder={() => setOrderItem(item)}
                t={t}
              />
            ))}
          </div>
        )}
        </>
        )}
      </main>

      <CombineBar
        items={combineList}
        result={combineResult}
        loading={combineLoading}
        onCalc={calcCombine}
        onClear={() => { setCombineList([]); setCombineResult(null); }}
        onRemove={removeCombine}
        t={t}
      />

      {orderItem && (
        <OrderModal
          item={orderItem}
          country={country}
          currency={currency}
          carrier={carrier}
          quotes={results?.carrierQuotes}
          onClose={() => setOrderItem(null)}
          t={t}
        />
      )}

      <footer className="footer">
        <p className="note">{t('footer.note')}</p>
        <p>{t('footer.disclaimer')}</p>
      </footer>
    </div>
  );
}
