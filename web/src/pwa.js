// CrossBuy PWA 基础设施：Service Worker 注册、在线升级提示、
// Android「安装应用」引导、iOS「添加到主屏幕」引导。
// 独立于 React 树，main.jsx 挂载一次即可，简易版/完整版共享升级提示。

const LS_VERSION_KEY = 'cb_app_version';
const LS_BANNER_DISMISS_KEY = 'cb_pwa_banner_dismissed';
const BANNER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 关闭引导后 7 天内不再弹

let deferredInstallPrompt = null;
let bannerHost = null;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isAndroidChrome() {
  return /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent) && !/edg|samsungbrowser/i.test(navigator.userAgent);
}

function ensureBannerHost() {
  if (bannerHost) return bannerHost;
  bannerHost = document.createElement('div');
  bannerHost.id = 'pwa-banner-host';
  document.body.appendChild(bannerHost);
  return bannerHost;
}

function removeBanner() {
  if (bannerHost) {
    bannerHost.innerHTML = '';
  }
}

function dismissBanner(days = 7) {
  localStorage.setItem(LS_BANNER_DISMISS_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  removeBanner();
}

function bannerStyles() {
  return `
    #pwa-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;
      display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:14px;
      background:#111827;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.35);
      font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      animation:pwaSlideUp .35s ease;}
    #pwa-banner .pwa-ic{width:44px;height:44px;border-radius:10px;flex:0 0 auto;}
    #pwa-banner .pwa-body{flex:1;min-width:0;}
    #pwa-banner .pwa-title{font-weight:700;font-size:15px;}
    #pwa-banner .pwa-desc{opacity:.85;font-size:13px;margin-top:2px;}
    #pwa-banner .pwa-actions{display:flex;flex-direction:column;gap:6px;}
    #pwa-banner button{border:0;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;}
    #pwa-banner .pwa-ok{background:#4f46e5;color:#fff;}
    #pwa-banner .pwa-no{background:transparent;color:#9ca3af;font-size:12px;padding:4px;}
    #pwa-update{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483001;
      display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:12px;
      background:#111827;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.35);
      font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      animation:pwaSlideDown .35s ease;}
    #pwa-update button{border:0;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;background:#4f46e5;color:#fff;}
    @keyframes pwaSlideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes pwaSlideDown{from{transform:translate(-50%,-16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
    @media (max-width:420px){#pwa-banner .pwa-actions{flex-direction:row}}
  `;
}

function injectStyles() {
  if (document.getElementById('pwa-style')) return;
  const style = document.createElement('style');
  style.id = 'pwa-style';
  style.textContent = bannerStyles();
  document.head.appendChild(style);
}

// —— 在线升级提示：检测 app-version.json 变化，提示用户刷新生效 ——
export async function checkForUpdates({ silent = true } = {}) {
  try {
    const res = await fetch(`/app-version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = await res.json();
    const known = localStorage.getItem(LS_VERSION_KEY);
    if (known && known !== info.version) {
      showUpdateBanner(info);
    }
    localStorage.setItem(LS_VERSION_KEY, info.version);
    return info;
  } catch {
    return null;
  }
}

function showUpdateBanner(info) {
  injectStyles();
  const host = ensureBannerHost();
  if (document.getElementById('pwa-update')) return;
  const el = document.createElement('div');
  el.id = 'pwa-update';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <span>🔄 ${esc(info.notes?.zh || '发现新版本')}</span>
    <button type="button" data-act="update">${esc(`立即更新 v${info.version}`)}</button>
  `;
  el.querySelector('[data-act="update"]').addEventListener('click', async () => {
    // 通知 SW 清缓存后整页刷新，保证拿到最新构建
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage('CLEAR_CACHES');
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    window.location.reload();
  });
  host.appendChild(el);
  setTimeout(() => el.remove(), 60 * 1000);
}

// —— Android / 桌面 Chrome：beforeinstallprompt 自定义安装引导 ——
function showAndroidBanner() {
  const dismissed = Number(localStorage.getItem(LS_BANNER_DISMISS_KEY) || 0);
  if (dismissed > Date.now()) return;
  injectStyles();
  const host = ensureBannerHost();
  const el = document.createElement('div');
  el.id = 'pwa-banner';
  el.innerHTML = `
    <img class="pwa-ic" src="/icon-192.png" alt="CrossBuy" />
    <div class="pwa-body">
      <div class="pwa-title">安装 CrossBuy 到主屏幕</div>
      <div class="pwa-desc">像 App 一样打开，秒启动、全屏体验</div>
    </div>
    <div class="pwa-actions">
      <button type="button" class="pwa-ok" data-act="install">安装</button>
      <button type="button" class="pwa-no" data-act="later">暂不</button>
    </div>
  `;
  el.querySelector('[data-act="install"]').addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    } else {
      window.location.href = '/#/download';
    }
    removeBanner();
  });
  el.querySelector('[data-act="later"]').addEventListener('click', () => dismissBanner(7));
  host.appendChild(el);
}

// —— iOS：Safari 添加到主屏幕引导（Apple 不开放安装提示 API，只能引导操作）——
function showIosBanner() {
  const dismissed = Number(localStorage.getItem(LS_BANNER_DISMISS_KEY) || 0);
  if (dismissed > Date.now()) return;
  const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  if (!isSafari) return;
  injectStyles();
  const host = ensureBannerHost();
  const el = document.createElement('div');
  el.id = 'pwa-banner';
  el.innerHTML = `
    <img class="pwa-ic" src="/icon-192.png" alt="CrossBuy" />
    <div class="pwa-body">
      <div class="pwa-title">把 CrossBuy 添加到主屏幕</div>
      <div class="pwa-desc">点击底部 <b>分享按钮</b> <svg width="14" height="16" viewBox="0 0 14 18" style="vertical-align:-2px"><path d="M7 0l4 4.5H8.2v6H5.8v-6H3z" fill="#fff"/><path d="M1 7v9.5h12V7H9.8V5H15v13H-1V5h4.2v2z" fill="#fff" transform="translate(1,0) scale(.82)"/></svg> → 选择「添加到主屏幕」</div>
    </div>
    <div class="pwa-actions">
      <button type="button" class="pwa-no" data-act="later">知道了</button>
    </div>
  `;
  el.querySelector('[data-act="later"]').addEventListener('click', () => dismissBanner(7));
  host.appendChild(el);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function maybeShowInstallBanner() {
  if (isStandalone()) return; // 已安装
  if (document.getElementById('pwa-banner') || document.getElementById('pwa-update')) return;
  if (isIos()) showIosBanner();
  else if (isAndroidChrome() && deferredInstallPrompt) showAndroidBanner();
}

export function initPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  injectStyles();

  // SW 注册（升级由浏览器在导航时自动检查 sw.js 字节差异）
  navigator.serviceWorker.register('/sw.js').catch(() => {});

  // SW 有新版本待接管时（skipWaiting 情况下由版本检测提示刷新）
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 控制器接管后下次导航即为新版本，无需额外动作
  });

  // 捕获安装提示事件（Android Chrome / Edge / 桌面 Chrome）
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    maybeShowInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    removeBanner();
  });

  // 首屏稳定后做一次版本检查；之后每 5 分钟轮询（页面存活期间的在线升级提示）
  const firstCheck = () => checkForUpdates();
  if (document.readyState === 'complete') setTimeout(firstCheck, 3000);
  else window.addEventListener('load', () => setTimeout(firstCheck, 3000), { once: true });
  setInterval(() => checkForUpdates(), 5 * 60 * 1000);

  // 非首次访问且未装 App 时，也展示一次安装引导（Android 无 beforeinstallprompt 前不弹）
  const known = localStorage.getItem(LS_VERSION_KEY);
  if (known) setTimeout(maybeShowInstallBanner, 8000);
}
