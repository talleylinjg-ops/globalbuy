import { useI18n } from '../i18n.js';

const ALL_PLATFORMS = [
  { id: 'taobao', label: '淘宝' },
  { id: 'tmall', label: '天猫' },
  { id: 'jd', label: '京东' },
  { id: 'pdd', label: '拼多多' },
  { id: '1688', label: '1688' },
];

export default function SettingsPanel({
  meta, country, setCountry, currency, setCurrency,
  platforms, setPlatforms, profitRate, setProfitRate, t,
}) {
  const { lang, setLang } = useI18n();

  const togglePlatform = (id) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <div className="settings-panel">
      <div>
        <label className="settings-label">{t('settings.deliveryCountry')}</label>
        <select className="settings-control" value={country} onChange={(e) => setCountry(e.target.value)}>
          {(meta?.countries || []).map((c) => (
            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="settings-label">{t('settings.currency')}</label>
        <select className="settings-control" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {(meta?.countries || []).map((c) => (
            <option key={c.currency} value={c.currency}>{c.currency}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="settings-label">{t('settings.platforms')}</label>
        <div className="platform-row">
          {ALL_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn-chip ${platforms.includes(p.id) ? 'active' : ''}`}
              onClick={() => togglePlatform(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="settings-label" title={t('settings.profitHelp')}>{t('settings.profitRate')}: {profitRate}%</label>
        <input
          className="settings-control"
          type="range"
          min="0"
          max="30"
          step="1"
          value={profitRate}
          onChange={(e) => setProfitRate(Number(e.target.value))}
        />
      </div>

      <div>
        <label className="settings-label">Language</label>
        <select className="settings-control" value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="zh">中文</option>
        </select>
      </div>
    </div>
  );
}
