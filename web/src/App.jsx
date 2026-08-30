import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n.js';
import { fetchMeta, searchProducts, parseLink } from './api.js';
import ProductCard from './components/ProductCard.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Loading from './components/Loading.jsx';
import CarrierPicker from './components/CarrierPicker.jsx';
import AdminPanel from './components/AdminPanel.jsx';

const DEFAULT_COUNTRY = 'US';
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_PLATFORMS = ['taobao', 'jd', 'pdd', '1688'];

function getAdminRoute() {
  return window.location.hash.startsWith('#/admin');
}

export default function App() {
  const { t, lang, setLang, languages } = useI18n();
  const [isAdmin, setIsAdmin] = useState(getAdminRoute());
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
  const [profitRate, setProfitRate] = useState(8);
  const [sortBy, setSortBy] = useState('recommended');
  const [carrier, setCarrier] = useState(null);

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
        carrier: carrier || undefined,
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
          <h1 className="logo">CrossBuy <span>Compare</span></h1>
          <p className="tagline">{t('app.tagline')}</p>
          <p className="subtagline">{t('app.subtagline')}</p>
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
          categories={meta?.categories || ['无线蓝牙耳机', '无线充电器', '瑜伽垫', '保温杯', '手机壳', '机械键盘']}
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
        />

        {lastSearch && results && results.carrierQuotes && results.carrierQuotes.length > 0 && (
          <CarrierPicker
            quotes={results.carrierQuotes}
            current={results.carrier?.carrier}
            onSelect={(c) => {
              setCarrier(c);
              if (lastSearch?.q) doSearch(lastSearch.q);
            }}
            t={t}
          />
        )}

        {lastSearch && results && (
          <div className="results-head">
            <div>
              <div className="results-count">
                {t('result.totalLabel', { total: results.total, platforms: results.sourceInfo.filter((s) => s.count > 0).length })}
              </div>
              {results.translatedKeyword && results.translatedKeyword !== results.inputKeyword && (
                <div className="translate-badge">
                  {t('search.keywordTranslated')}: <b>{results.translatedKeyword}</b>
                </div>
              )}
            </div>
            <span className="results-count">{t('result.sortedBy')}</span>
          </div>
        )}

        {!loading && sortedResults && sortedResults.length > 0 && (
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
                t={t}
              />
            ))}
          </div>
        )}
        </>
        )}
      </main>

      <footer className="footer">
        <p className="note">{t('footer.note')}</p>
        <p>{t('footer.disclaimer')}</p>
      </footer>
    </div>
  );
}
