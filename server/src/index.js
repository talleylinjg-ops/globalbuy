import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import apiRouter from './routes/index.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`[server] running at http://localhost:${config.port}`);
});
