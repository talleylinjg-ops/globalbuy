import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 应用版本单一来源：发版时同步更新 web/public/app-version.json 与 sw.js 的 SW_VERSION
export const APP_VERSION = '1.1.1';
export const APP_BUILD = '20261030';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 安装包目录：CI 构建产物统一复制为固定文件名，便于客户端直链下载
export const DOWNLOADS_DIR = path.resolve(__dirname, '../../downloads');

const DOWNLOAD_FILES = {
  android: 'crossbuy-android.apk',
  windows: 'crossbuy-win.zip',
  mac: 'crossbuy-mac.zip',
};

// 仅返回实际存在的安装包地址；未部署产物时字段为 null（前端显示「即将发布」）
export function appVersionInfo(baseUrl = '') {
  const downloads = {};
  for (const [key, file] of Object.entries(DOWNLOAD_FILES)) {
    const available = existsSync(path.join(DOWNLOADS_DIR, file));
    downloads[key] = available ? `${baseUrl}/downloads/${file}` : null;
  }
  return {
    version: APP_VERSION,
    build: APP_BUILD,
    channel: 'stable',
    downloads,
  };
}

// 下载基地址：正式域名强制 https（反代/CDN 场景），本地调试保留原始协议
export function appVersionBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const isLocal = /^(localhost|127\.)/.test(host);
  return isLocal ? `${proto}://${host}` : `https://${host}`;
}
