// 公开快递报价 API（无需登录）
// GET  /api/carriers        -> 已启用快递商列表（脱敏）
// POST /api/carriers/quote  -> 自动询价 + 推荐
import { Router } from 'express';
import { getCarrierConfigs } from '../services/carrierStore.js';
import { getCarrierQuotes } from '../services/carrierService.js';
import { CARRIER_ADAPTERS } from '../carriers/index.js';

const router = Router();

router.get('/', (req, res) => {
  const list = getCarrierConfigs()
    .filter((c) => c.enabled !== false)
    .map((c) => {
      const meta = CARRIER_ADAPTERS[c.code];
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        mode: c.mode || 'standard',
        hasRealConfig: meta ? meta.fields.some((f) => c[f]) : false,
      };
    });
  res.json(list);
});

router.post('/quote', async (req, res, next) => {
  try {
    const { country, weightKg, dims, valueUsd, currency } = req.body || {};
    if (!country) return res.status(400).json({ error: 'missing country' });
    const w = Number(weightKg);
    if (!Number.isFinite(w) || w <= 0) return res.status(400).json({ error: 'invalid weightKg' });

    const result = await getCarrierQuotes({
      country: String(country).toUpperCase(),
      weightKg: w,
      dims: dims || {},
      valueUsd: Number(valueUsd) || 0,
      currency: String(currency || 'USD').toUpperCase(),
    });

    // 给每个报价附加 recommended 标记
    result.quotes = result.quotes.map((q) => ({
      ...q,
      recommended: q.carrier === result.recommended,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
