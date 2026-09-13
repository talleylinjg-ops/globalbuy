// 快递商管理 API（后台）
// 挂载于 /api/admin/carriers
import { Router } from 'express';
import {
  getCarrierConfigs, getCarrierConfig, upsertCarrier, deleteCarrier,
} from '../services/carrierStore.js';
import { createCarrierAdapter, CARRIER_ADAPTERS } from '../carriers/index.js';
import { authMiddleware as auth, requireSuper } from '../services/auth.js';

const router = Router();

// 可用适配器元信息（用于后台表单渲染字段）
router.get('/meta', auth, (req, res) => {
  res.json({ adapters: CARRIER_ADAPTERS });
});

// 列表（脱敏：隐藏密钥字段）
router.get('/', auth, (req, res) => {
  const list = getCarrierConfigs().map(mask);
  res.json(list);
});

// 详情（脱敏）
router.get('/:id', auth, (req, res) => {
  const c = getCarrierConfig(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(mask(c));
});

// 新增
router.post('/', auth, requireSuper, (req, res) => {
  const { code, name } = req.body || {};
  if (!code || !CARRIER_ADAPTERS[code]) return res.status(400).json({ error: 'valid code required' });
  const record = upsertCarrier({
    code,
    name: name || CARRIER_ADAPTERS[code].name,
    enabled: req.body.enabled !== false,
    mode: req.body.mode || 'standard',
    markupRate: req.body.markupRate || 0,
    ...pickFields(code, req.body),
  });
  res.json(mask(record));
});

// 更新
router.put('/:id', auth, requireSuper, (req, res) => {
  const existing = getCarrierConfig(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = {
    ...existing,
    ...req.body,
    ...pickFields(existing.code, req.body),
  };
  const record = upsertCarrier(merged);
  res.json(mask(record));
});

// 删除
router.delete('/:id', auth, requireSuper, (req, res) => {
  const ok = deleteCarrier(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// 测试连接：发起一次真实报价请求验证凭据
router.post('/:id/test', auth, async (req, res) => {
  const c = getCarrierConfig(req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  const adapter = createCarrierAdapter(c);
  if (!adapter) return res.status(400).json({ error: 'unsupported carrier code' });
  const result = await adapter.test();
  res.json(result);
});

// 脱敏：不返回密钥字段值，仅返回是否已配置
function mask(c) {
  const meta = CARRIER_ADAPTERS[c.code];
  const secretFields = meta ? meta.fields : [];
  const out = { ...c };
  secretFields.forEach((f) => {
    out[f] = out[f] ? '******' : '';
  });
  out.hasRealConfig = secretFields.some((f) => c[f]);
  return out;
}

function pickFields(code, body) {
  const meta = CARRIER_ADAPTERS[code];
  if (!meta) return {};
  const out = {};
  meta.fields.forEach((f) => {
    if (body[f] !== undefined && body[f] !== '******') out[f] = body[f];
  });
  return out;
}

export default router;
