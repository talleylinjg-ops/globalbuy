// MySQL(MariaDB) 持久层：建表、迁移旧 JSON 数据、行级读写
// 表结构：customers/addresses/orders(含 JSON data 列)/admins/settings(kv)
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'crossbuy',
  password: process.env.MYSQL_PASSWORD || 'crossbuy_local_dev',
  database: process.env.MYSQL_DATABASE || 'crossbuy',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
};

export const pool = mysql.createPool(DB_CONFIG);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_email (email(64))
) ENGINE=InnoDB;
`;

// MariaDB 的 JSON 列不能直接对内层字段建索引，email 索引改用生成列
const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(190) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.email'))) STORED,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_email (email)
) ENGINE=InnoDB;
`;

async function ensureTable(name, ddl) {
  try {
    await pool.query(ddl);
  } catch (e) {
    if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.errno === 1050) return;
    throw e;
  }
}

export async function ensureSchema() {
  await ensureTable('customers', `
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(190) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.email'))) STORED,
      data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customers_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureTable('addresses', `
    CREATE TABLE IF NOT EXISTS addresses (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.customerId'))) STORED,
      data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_addresses_customer (customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureTable('orders', `
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) PRIMARY KEY,
      order_no VARCHAR(32) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.orderNo'))) STORED,
      status VARCHAR(32) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.status'))) STORED,
      data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_orders_no (order_no),
      INDEX idx_orders_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureTable('admins', `
    CREATE TABLE IF NOT EXISTS admins (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      role VARCHAR(16) NOT NULL DEFAULT 'operator',
      salt VARCHAR(64) NOT NULL,
      password_hash VARCHAR(128) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureTable('settings', `
    CREATE TABLE IF NOT EXISTS settings (
      k VARCHAR(64) PRIMARY KEY,
      v JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

// ===== 行级读写 =====
// JSON 列读取容错：mysql2 对 JSON 类型列可能自动 parse（MariaDB 返回裸字符串时，
// 已解析的值直接用，未解析的字符串尝试 parse，parse 失败原样返回）
function parseJsonCol(v) {
  if (v !== null && typeof v === 'object') return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

export async function loadTable(table) {
  const [rows] = await pool.query(`SELECT data FROM ${table}`);
  return rows.map((r) => parseJsonCol(r.data));
}

export async function loadSettings() {
  const [rows] = await pool.query('SELECT k, v FROM settings');
  const out = {};
  for (const r of rows) out[r.k] = parseJsonCol(r.v);
  return out;
}

export async function saveSetting(k, v) {
  await pool.query(
    'INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
    [k, JSON.stringify(v ?? null)]
  );
}

export async function loadAdmins() {
  const [rows] = await pool.query('SELECT * FROM admins');
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role,
    salt: r.salt,
    passwordHash: r.password_hash,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function upsertAdmin(a) {
  await pool.query(
    `INSERT INTO admins (id, username, role, salt, password_hash) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE username = VALUES(username), role = VALUES(role),
       salt = VALUES(salt), password_hash = VALUES(password_hash)`,
    [a.id, a.username, a.role, a.salt, a.passwordHash]
  );
}

export async function deleteAdminRow(id) {
  await pool.query('DELETE FROM admins WHERE id = ?', [id]);
}

export async function upsertRecord(table, record) {
  await pool.query(
    `INSERT INTO ${table} (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [record.id, JSON.stringify(record)]
  );
}

export async function deleteRow(table, id) {
  await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function ping() {
  const [r] = await pool.query('SELECT 1 AS ok');
  return r[0].ok === 1;
}
