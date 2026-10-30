import { useEffect, useState } from 'react';
import { apiUrl } from '../api.js';

// 按用户系统排序平台卡片：当前平台置顶高亮
function detectPlatform() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/mac/i.test(ua)) return 'mac';
  if (/win/i.test(ua)) return 'windows';
  return null;
}

export default function DownloadPage({ t, lang }) {
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState(false);
  const current = detectPlatform();

  useEffect(() => {
    let alive = true;
    fetch(apiUrl('/api/app/version'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('api'))))
      .then((d) => { if (alive) setInfo(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const version = info?.version || (failed ? null : '…');
  const dl = info?.downloads || {};

  const card = (id, icon, title, desc, primary) => (
    <section
      key={id}
      className="dl-card"
      style={current === id ? { borderColor: '#4f46e5', boxShadow: '0 0 0 3px rgba(79,70,229,.15)' } : undefined}
    >
      <div className="dl-card-head">
        <span className="dl-icon" aria-hidden="true">{icon}</span>
        <div>
          <h3 className="dl-title">
            {title}
            {current === id && <span className="dl-badge">{t('download.currentPlatform')}</span>}
          </h3>
          <p className="dl-desc">{desc}</p>
        </div>
      </div>
      {primary}
    </section>
  );

  const androidBtn = dl.android ? (
    <a className="btn primary" href={dl.android} download>
      {t('download.android.download')} · APK
    </a>
  ) : (
    <span className="dl-soon">{t('download.comingSoon')}</span>
  );

  const windowsBtn = dl.windows ? (
    <a className="btn primary" href={dl.windows} download>
      {t('download.windows.download')} · EXE
    </a>
  ) : (
    <span className="dl-soon">{t('download.comingSoon')}</span>
  );

  const macBtn = dl.mac ? (
    <a className="btn primary" href={dl.mac} download>
      {t('download.mac.download')} · ZIP
    </a>
  ) : (
    <span className="dl-soon">{t('download.comingSoon')}</span>
  );

  return (
    <div className="download-page">
      <h2 className="dl-page-title">{t('download.title')}</h2>
      <p className="dl-page-sub">
        {t('download.subtitle')}
        {version && <span className="dl-version"> · v{version}</span>}
      </p>

      {card(
        'android',
        '🤖',
        t('download.android.title'),
        t('download.android.desc'),
        <>
          {androidBtn}
          <details className="dl-howto">
            <summary>{t('download.howto')}</summary>
            <ol>
              <li>{t('download.android.step1')}</li>
              <li>{t('download.android.step2')}</li>
              <li>{t('download.android.step3')}</li>
              <li>{t('download.android.step4')}</li>
            </ol>
          </details>
        </>
      )}

      {card(
        'ios',
        '🍎',
        t('download.ios.title'),
        t('download.ios.desc'),
        <details className="dl-howto" open>
          <summary>{t('download.ios.guideTitle')}</summary>
          <ol>
            <li>{t('download.ios.step1')}</li>
            <li>{t('download.ios.step2')}</li>
            <li>{t('download.ios.step3')}</li>
            <li>{t('download.ios.step4')}</li>
          </ol>
        </details>
      )}

      {card(
        'windows',
        '🪟',
        t('download.windows.title'),
        t('download.windows.desc'),
        <>
          {windowsBtn}
          <details className="dl-howto">
            <summary>{t('download.howto')}</summary>
            <ol>
              <li>{t('download.windows.step1')}</li>
              <li>{t('download.windows.step2')}</li>
              <li>{t('download.upgrade.note')}</li>
            </ol>
          </details>
        </>
      )}

      {card(
        'mac',
        '💻',
        t('download.mac.title'),
        t('download.mac.desc'),
        <>
          {macBtn}
          <details className="dl-howto">
            <summary>{t('download.howto')}</summary>
            <ol>
              <li>{t('download.mac.step1')}</li>
              <li>{t('download.mac.step2')}</li>
              <li>{t('download.upgrade.note')}</li>
            </ol>
          </details>
        </>
      )}

      <p className="dl-upgrade-note">{t('download.upgrade.intro')}</p>
    </div>
  );
}
