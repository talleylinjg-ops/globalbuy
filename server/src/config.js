import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function num(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3001),

  // 平台密钥（未配置时自动使用 Mock 数据源）
  platforms: {
    taobao: {
      appKey: process.env.TAOBAO_APP_KEY || '',
      appSecret: process.env.TAOBAO_APP_SECRET || '',
      adzoneId: process.env.TAOBAO_ADZONE_ID || '',
    },
    jd: {
      appKey: process.env.JD_APP_KEY || '',
      appSecret: process.env.JD_APP_SECRET || '',
      unionId: process.env.JD_UNION_ID || '',
    },
    pdd: {
      clientId: process.env.PDD_CLIENT_ID || '',
      clientSecret: process.env.PDD_CLIENT_SECRET || '',
      pid: process.env.PDD_PID || '',
    },
    '1688': {
      appKey: process.env.ALI1688_APP_KEY || '',
      appSecret: process.env.ALI1688_APP_SECRET || '',
    },
  },

  // 跨境比价参数
  defaultDestCountry: process.env.DEFAULT_DEST_COUNTRY || 'US',
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
  serviceFeeRate: num(process.env.SERVICE_FEE_RATE, 0.05),
  paymentFeeRate: num(process.env.PAYMENT_FEE_RATE, 0.03),
  profitRate: num(process.env.PROFIT_RATE, 0.5),
  domesticShippingCnyPerKg: num(process.env.DOMESTIC_SHIPPING_CNY_PER_KG, 0),
  fxCacheMinutes: num(process.env.FX_CACHE_MINUTES, 720),
};
