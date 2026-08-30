import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'admin_db.json');

// 初始种子数据
const seed = () => ({
  customers: [
    {
      id: 'c_1001',
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1 415 555 0134',
      country: 'US',
      currency: 'USD',
      registeredAt: '2026-01-12T09:30:00Z',
      notes: 'VIP customer, prefers DDP shipping',
      status: 'active',
    },
    {
      id: 'c_1002',
      name: 'Maria Garcia',
      email: 'maria.garcia@example.es',
      phone: '+34 612 345 678',
      country: 'ES',
      currency: 'EUR',
      registeredAt: '2026-02-03T14:22:00Z',
      notes: 'Ordered wireless earbuds, wants tracking updates',
      status: 'active',
    },
    {
      id: 'c_1003',
      name: 'Ahmed Al-Rashid',
      email: 'ahmed@example.ae',
      phone: '+971 50 123 4567',
      country: 'AE',
      currency: 'AED',
      registeredAt: '2026-03-18T11:05:00Z',
      notes: '',
      status: 'inactive',
    },
    {
      id: 'c_1004',
      name: 'Tanaka Yuki',
      email: 'yuki.tanaka@example.jp',
      phone: '+81 90 1234 5678',
      country: 'JP',
      currency: 'JPY',
      registeredAt: '2026-04-02T08:45:00Z',
      notes: 'Bulk buyer for resale',
      status: 'active',
    },
  ],
  addresses: [
    {
      id: 'a_2001',
      customerId: 'c_1001',
      label: 'Home',
      recipient: 'John Smith',
      line1: '1234 Market Street, Apt 5B',
      line2: '',
      city: 'San Francisco',
      state: 'CA',
      postal: '94103',
      country: 'US',
      phone: '+1 415 555 0134',
      isDefault: true,
    },
    {
      id: 'a_2002',
      customerId: 'c_1002',
      label: 'Home',
      recipient: 'Maria Garcia',
      line1: 'Calle Gran Via 45, 3B',
      line2: '',
      city: 'Madrid',
      state: 'Madrid',
      postal: '28013',
      country: 'ES',
      phone: '+34 612 345 678',
      isDefault: true,
    },
    {
      id: 'a_2003',
      customerId: 'c_1004',
      label: 'Office',
      recipient: 'Tanaka Yuki',
      line1: '1-2-3 Shibuya, Shibuya-ku',
      line2: 'Tokyo Building 8F',
      city: 'Tokyo',
      state: 'Tokyo',
      postal: '150-0002',
      country: 'JP',
      phone: '+81 90 1234 5678',
      isDefault: true,
    },
  ],
  orders: [
    {
      id: 'o_3001',
      orderNo: 'CB20260318001',
      customerId: 'c_1001',
      addressId: 'a_2001',
      status: 'delivered',
      items: [
        {
          itemId: 'tb_1001',
          title: '无线蓝牙耳机 真无线入耳式降噪运动跑步耳机 超长续航',
          platform: 'taobao',
          quantity: 1,
          priceCny: 89.0,
          landedPrice: 12.43,
          currency: 'USD',
        },
        {
          itemId: 'pdd_4002',
          title: '蓝牙耳机无线 半入耳式 降噪 运动跑步 迷你便携',
          platform: 'pdd',
          quantity: 2,
          priceCny: 29.9,
          landedPrice: 5.29,
          currency: 'USD',
        },
      ],
      subtotalCny: 148.8,
      shippingCny: 71.3,
      dutyCny: 0,
      vatCny: 0,
      serviceFeeCny: 7.44,
      tipCny: 3.0,
      totalCny: 230.54,
      totalCurrency: 32.0,
      currency: 'USD',
      tipRate: 0.05,
      trackingNo: 'YT7890123456789',
      carrier: '云途专线',
      createdAt: '2026-03-18T11:05:00Z',
      updatedAt: '2026-03-28T15:40:00Z',
      notes: 'Customer requested gift packaging',
    },
    {
      id: 'o_3002',
      orderNo: 'CB20260401002',
      customerId: 'c_1002',
      addressId: 'a_2002',
      status: 'shipped',
      items: [
        {
          itemId: 'jd_3002',
          title: '蓝牙耳机 无线运动跑步耳机 降噪入耳式 防水防汗',
          platform: 'jd',
          quantity: 1,
          priceCny: 79.0,
          landedPrice: 14.2,
          currency: 'EUR',
        },
      ],
      subtotalCny: 79.0,
      shippingCny: 54.7,
      dutyCny: 0,
      vatCny: 26.7,
      serviceFeeCny: 3.95,
      tipCny: 4.0,
      totalCny: 168.35,
      totalCurrency: 21.5,
      currency: 'EUR',
      tipRate: 0.05,
      trackingNo: 'YT5678901234567',
      carrier: '云途专线',
      createdAt: '2026-04-01T09:22:00Z',
      updatedAt: '2026-04-03T10:15:00Z',
      notes: '',
    },
    {
      id: 'o_3003',
      orderNo: 'CB20260415003',
      customerId: 'c_1004',
      addressId: 'a_2003',
      status: 'processing',
      items: [
        {
          itemId: 'al_8001',
          title: '保温杯工厂 316不锈钢 大容量 OEM定制 跨境批发',
          platform: '1688',
          quantity: 10,
          priceCny: 18.5,
          landedPrice: 3.85,
          currency: 'JPY',
        },
      ],
      subtotalCny: 185.0,
      shippingCny: 102.4,
      dutyCny: 0,
      vatCny: 0,
      serviceFeeCny: 9.25,
      tipCny: 18.5,
      totalCny: 315.15,
      totalCurrency: 6510,
      currency: 'JPY',
      tipRate: 0.10,
      trackingNo: '',
      carrier: '云途专线',
      createdAt: '2026-04-15T07:50:00Z',
      updatedAt: '2026-04-16T02:30:00Z',
      notes: 'Bulk order, ship in 2 boxes',
    },
  ],
  settings: {
    minServiceFeeRate: 0.05,
    defaultTipOptions: [0, 0.03, 0.05, 0.08, 0.10, 0.15],
  },
});

let db = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDb() {
  if (db) return db;
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    db = seed();
    saveDb();
  } else {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch {
      db = seed();
      saveDb();
    }
  }
  return db;
}

export function saveDb() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function getDb() {
  if (!db) loadDb();
  return db;
}

export function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

export function genOrderNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `CB${ymd}${rand}`;
}

// ===== 通用 CRUD 辅助 =====
export function listCollection(name) {
  return getDb()[name] || [];
}

export function getById(name, id) {
  return (getDb()[name] || []).find((x) => x.id === id) || null;
}

export function createRecord(name, data) {
  const col = getDb()[name] || [];
  const now = new Date().toISOString();
  const record = {
    id: genId(name === 'orders' ? 'o' : name === 'customers' ? 'c' : 'a'),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  if (name === 'orders') {
    record.orderNo = genOrderNo();
    delete record.createdAt;
    record.createdAt = now;
  }
  col.push(record);
  saveDb();
  return record;
}

export function updateRecord(name, id, data) {
  const col = getDb()[name] || [];
  const idx = col.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  col[idx] = { ...col[idx], ...data, id, updatedAt: now };
  saveDb();
  return col[idx];
}

export function deleteRecord(name, id) {
  const col = getDb()[name] || [];
  const idx = col.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  col.splice(idx, 1);
  saveDb();
  return true;
}
