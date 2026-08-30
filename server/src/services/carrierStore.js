// 快递商配置存储
// 优先级：admin_db.json 中管理员的 carriers 配置 > .env 静态配置 > 内置默认
import { getDb, saveDb } from './db.js';
import { defaultCarriers } from '../carriers/index.js';
import { config } from '../config.js';

const DB_KEY = 'carriers';

function seedFromEnv() {
  // 支持通过环境变量配置某个快递商（可选，主要配置入口在后台管理界面）
  const map = {
    yuntrack: { appId: process.env.CARRIER_YUNTRACK_APP_ID, appToken: process.env.CARRIER_YUNTRACK_APP_TOKEN },
    '4px': { appKey: process.env.CARRIER_4PX_APP_KEY, appSecret: process.env.CARRIER_4PX_APP_SECRET },
    dhl: { apiKey: process.env.CARRIER_DHL_API_KEY, apiSecret: process.env.CARRIER_DHL_API_SECRET },
    ups: { clientId: process.env.CARRIER_UPS_CLIENT_ID, clientSecret: process.env.CARRIER_UPS_CLIENT_SECRET },
    fedex: { apiKey: process.env.CARRIER_FEDEX_API_KEY, apiSecret: process.env.CARRIER_FEDEX_API_SECRET },
    ems: { userId: process.env.CARRIER_EMS_USER_ID, apiKey: process.env.CARRIER_EMS_API_KEY },
  };
  return defaultCarriers().map((c) => {
    const env = map[c.code] || {};
    return { id: `carrier_${c.code}`, ...c, ...env };
  });
}

// 初始化：首次启动时写入种子
function ensureSeeded() {
  const db = getDb();
  if (!db[DB_KEY] || !Array.isArray(db[DB_KEY])) {
    db[DB_KEY] = seedFromEnv();
    saveDb();
  }
}

export function getCarrierConfigs() {
  ensureSeeded();
  return getDb()[DB_KEY] || [];
}

export function getCarrierConfig(id) {
  return getCarrierConfigs().find((c) => c.id === id) || null;
}

export function upsertCarrier(data) {
  ensureSeeded();
  const db = getDb();
  const list = db[DB_KEY];
  const idx = list.findIndex((c) => c.id === data.id);
  if (idx === -1) {
    const record = { ...data, id: `carrier_${data.code}_${Date.now().toString(36)}` };
    list.push(record);
    saveDb();
    return record;
  }
  list[idx] = { ...list[idx], ...data };
  saveDb();
  return list[idx];
}

export function deleteCarrier(id) {
  ensureSeeded();
  const db = getDb();
  const list = db[DB_KEY];
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveDb();
  return true;
}

// 是否存在真实（非估算）快递商配置
export function hasRealCarrier() {
  return getCarrierConfigs().some((c) => {
    const keys = ['apiKey', 'appKey', 'appId', 'clientId', 'userId'];
    return keys.some((k) => c[k]);
  });
}
