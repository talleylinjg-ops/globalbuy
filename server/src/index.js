import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { loadDb } from './services/db.js';
import { startQuoteCacheWarmer } from './services/carrierService.js';
import { DOWNLOADS_DIR } from './services/appVersion.js';
import apiRouter from './routes/index.js';

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

// 启动前先完成 MySQL 初始化（建表 + 数据迁移），失败则终止
await loadDb().then(() => console.log('[db] MySQL ready')).catch((e) => {
  console.error('[db] MySQL init failed:', e.message);
  process.exit(1);
});

// 本地商品图片静态服务
app.use(express.static(new URL('../public', import.meta.url).pathname, { maxAge: '7d' }));

app.use('/api', apiRouter);

// 客户端安装包下载目录（APK / Windows / Mac 构建产物），存在才启用
if (existsSync(DOWNLOADS_DIR)) {
  app.use('/downloads', express.static(DOWNLOADS_DIR, { maxAge: '1h' }));
}

// TWA 域名校验：Android APK 与网站的数字资产链接（包名+签名指纹由构建产物回填）
const assetLinks = new URL('../downloads/.well-known/assetlinks.json', import.meta.url).pathname;
if (existsSync(assetLinks)) {
  app.get('/.well-known/assetlinks.json', (req, res) => res.sendFile(assetLinks));
}

// VPS 单端口部署：伺服前端构建产物（web/dist），API 路由以上已优先注册
const webDist = new URL('../../web/dist', import.meta.url).pathname;
if (existsSync(webDist)) {
  app.use(express.static(webDist, {
    index: ['index.html'],
    setHeaders: (res, filePath) => {
      // 入口 html 必须每次校验（SPA 引用带 hash 的 chunk，部署后旧引用会 404）
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      else if (filePath.includes(`${webDist}/assets/`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else res.setHeader('Cache-Control', 'public, max-age=300');
    },
  }));
  // SPA / 落地页兜底：非 /api 请求返回 index.html（/p/* 为真实文件，静态中间件已命中）
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(`${webDist}/index.html`);
  });
  console.log('[server] serving web/dist static files');
}

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`[server] running on 0.0.0.0:${config.port}`);
  // 热门目的国报价预热：买家首搜命中缓存，消除外部 API 冷启动延迟
  startQuoteCacheWarmer();
});
