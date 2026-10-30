const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const https = require('https');
const http = require('http');

// 站点地址：打包前可改；也可用环境变量 CROSSBUY_APP_URL 覆盖
const APP_URL = process.env.CROSSBUY_APP_URL || 'https://xluxury.site/';
const VERSION = app.getVersion();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'CrossBuy',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 去掉默认菜单里与单页应用冲突的项，仅保留基础导航与开发者工具
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ] },
    { label: 'Help', submenu: [
      { label: 'Download Page', click: () => mainWindow.loadURL(`${APP_URL}#/download`) },
      { label: `Version ${VERSION}`, enabled: false },
    ] },
  ]));

  mainWindow.loadURL(APP_URL);

  // 站内链接外部打开（如快递官网查询）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function fetchVersionInfo() {
  return new Promise((resolve, reject) => {
    const mod = APP_URL.startsWith('https') ? https : http;
    const req = mod.get(`${APP_URL}api/app/version`, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`status ${res.statusCode}`));
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// 在线升级提示：与服务端版本号比对，提示用户跳转下载页获取新安装包
async function checkForUpdate(silent = true) {
  try {
    const info = await fetchVersionInfo();
    if (!info || !info.version || info.version === VERSION) return;
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'CrossBuy Update',
      message: `New version available: v${info.version}`,
      detail: `You are running v${VERSION}. Click Download to get the latest installer.`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
    });
    if (response === 0) {
      const platform = process.platform === 'darwin' ? 'mac' : process.platform.startsWith('win') ? 'windows' : null;
      const target = platform && info.downloads?.[platform]
        ? info.downloads[platform]
        : `${APP_URL}#/download`;
      shell.openExternal(target);
    }
  } catch (e) {
    if (!silent) console.error('[update] check failed:', e.message);
  }
}

app.whenReady().then(() => {
  createWindow();
  // 启动后 5 秒检查更新，之后每 6 小时一次
  setTimeout(() => checkForUpdate(), 5000);
  setInterval(() => checkForUpdate(), 6 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
