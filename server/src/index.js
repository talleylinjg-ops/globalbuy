import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { loadDb } from './services/db.js';
import apiRouter from './routes/index.js';

const app = express();
app.use(cors());
app.use(express.json());

// 启动前先完成 MySQL 初始化（建表 + 数据迁移），失败则终止
await loadDb().then(() => console.log('[db] MySQL ready')).catch((e) => {
  console.error('[db] MySQL init failed:', e.message);
  process.exit(1);
});

// 本地商品图片静态服务
app.use(express.static(new URL('../public', import.meta.url).pathname, { maxAge: '7d' }));

app.use('/api', apiRouter);

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`[server] running at http://localhost:${config.port}`);
});
