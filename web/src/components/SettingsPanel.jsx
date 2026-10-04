// lang 由 App 传入（useI18n 为组件独立 state，避免多实例不同步）

const ALL_PLATFORMS = [
  { id: 'taobao', label: '淘宝' },
  { id: 'tmall', label: '天猫' },
  { id: 'jd', label: '京东' },
  { id: 'pdd', label: '拼多多' },
  { id: '1688', label: '1688' },
];

const CONTINENT_LABEL_KEY = {
  priority: 'geo.priority',
  asia: 'geo.asia',
  europe: 'geo.europe',
  'north-america': 'geo.northAmerica',
  'south-america': 'geo.southAmerica',
  oceania: 'geo.oceania',
  africa: 'geo.africa',
};

let displayNamesCache = {};
function regionName(code, lang) {
  const cacheKey = lang || 'en';
  if (!displayNamesCache[cacheKey]) {
    try {
      displayNamesCache[cacheKey] = new Intl.DisplayNames([cacheKey === 'zh' ? 'zh-CN' : cacheKey], { type: 'region' });
    } catch {
      displayNamesCache[cacheKey] = null;
    }
  }
  try {
    return displayNamesCache[cacheKey]?.of(code) || code;
  } catch {
    return code;
  }
}

function countryLabel(c, t, lang) {
  const key = `country.${c.code}`;
  if (t(key) !== key) return t(key);
  return regionName(c.code, lang);
}

export default function SettingsPanel({
  meta, country, setCountry, currency, setCurrency,
  platforms, setPlatforms, serviceFee, setServiceFee, t, lang, children,
}) {
  const togglePlatform = (id) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const countries = meta?.countries || [];
  const groupOrder = ['priority', 'asia', 'europe', 'north-america', 'south-america', 'oceania', 'africa'];
  const grouped = groupOrder
    .map((g) => ({ g, list: countries.filter((c) => (c.continent || 'priority') === g) }))
    .filter(({ list }) => list.length > 0);

  const currencies = meta?.currencies?.length
    ? meta.currencies
    : [...new Set(countries.map((c) => c.currency).filter(Boolean))];

  return (
    <div className="settings-panel">
      <div className="settings-field field-country">
        <label className="settings-label">{t('settings.deliveryCountry')}</label>
        <select className="settings-control" value={country} onChange={(e) => setCountry(e.target.value)}>
          {grouped.map(({ g, list }) => (
            <optgroup key={g} label={t(CONTINENT_LABEL_KEY[g] || 'geo.priority')}>
              {list.map((c) => (
                <option key={c.code} value={c.code}>{countryLabel(c, t, lang)} ({c.code})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="settings-field field-currency">
        <label className="settings-label">{t('settings.currency')}</label>
        <select className="settings-control" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {currencies.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>

      <div className="settings-field field-platforms">
        <label className="settings-label">{t('settings.platforms')}</label>
        <div className="platform-row">
          {ALL_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn-chip ${platforms.includes(p.id) ? 'active' : ''}`}
              onClick={() => togglePlatform(p.id)}
            >
              {t(`platform.${p.id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-field field-profit">
        <label className="settings-label" title={t('settings.serviceFeeHelp')}>{t('settings.serviceFee')}: {serviceFee}%</label>
        <input
          className="settings-control"
          type="range"
          min="0"
          max="30"
          step="1"
          value={serviceFee}
          style={{ '--fill': `${(serviceFee / 30) * 100}%` }}
          onChange={(e) => setServiceFee(Number(e.target.value))}
        />
      </div>

      {children}
    </div>
  );
}
