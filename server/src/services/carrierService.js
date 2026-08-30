// 国际快递报价服务：并行询价 -> 自动排序 -> 推荐最优
// 数据源优先级：已配置 API 的快递商走真实接口；未配置的走估算模式；均失败返回估算兜底
import { getCarrierConfigs, hasRealCarrier } from './carrierStore.js';
import { createCarrierAdapter } from '../carriers/index.js';
import { EstimateAdapter } from '../carriers/estimate.js';

/**
 * 并行获取所有已启用快递商的报价
 * @param {object} p
 * @param {string} p.country 目的国
 * @param {number} p.weightKg 重量
 * @param {object} [p.dims] 尺寸 {lengthCm,widthCm,heightCm}
 * @param {number} [p.valueUsd] 申报货值
 * @returns {Promise<{quotes: Array, recommended: string|null, hasRealData: boolean}>}
 */
export async function getCarrierQuotes(p) {
  const configs = getCarrierConfigs().filter((c) => c.enabled !== false);

  // 全部走估算模式（未配置任何真实 API）
  const anyReal = configs.some((c) => {
    const adapter = createCarrierAdapter(c);
    return adapter && adapter.configured;
  });

  const jobs = configs.map(async (cfg) => {
    const adapter = createCarrierAdapter(cfg) || new EstimateAdapter(cfg);
    if (adapter.configured) {
      try {
        const quote = await adapter.quote(p);
        return { ...quote, status: 'ok', configId: cfg.id };
      } catch (e) {
        // 真实 API 失败：回退到该快递商的估算报价，并标记 error
        const est = new EstimateAdapter({ ...cfg, mode: cfg.mode || 'standard' });
        try {
          const q = await est.quote(p);
          return { ...q, status: 'error', error: e.message, configId: cfg.id };
        } catch {
          return { status: 'error', error: e.message, carrier: cfg.code, carrierName: cfg.name, configId: cfg.id };
        }
      }
    }
    const est = new EstimateAdapter({ ...cfg, mode: cfg.mode || 'standard' });
    const q = await est.quote(p);
    return { ...q, status: 'ok', configId: cfg.id };
  });

  const settled = await Promise.allSettled(jobs);
  const quotes = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && r.value) quotes.push(r.value);
  });

  const available = quotes.filter((q) => q.available);
  const recommended = available.length ? pickBest(available).carrier : null;

  return {
    quotes: sortQuotes(available),
    recommended,
    hasRealData: anyReal,
    countries: configs.map((c) => c.code),
  };
}

/**
 * 综合评分：价格权重 0.6，时效权重 0.4（归一化后加权）
 * 价格越低分越高、时效越短分越高
 */
function scoreQuote(q, minPrice, maxPrice, minDays, maxDays) {
  const priceRange = Math.max(maxPrice - minPrice, 0.01);
  const daysRange = Math.max(maxDays - minDays, 1);
  const priceScore = 1 - (q.priceUsd - minPrice) / priceRange;
  const daysScore = 1 - ((q.daysMin + q.daysMax) / 2 - minDays) / daysRange;
  return priceScore * 0.6 + daysScore * 0.4;
}

function pickBest(available) {
  const minPrice = Math.min(...available.map((q) => q.priceUsd));
  const maxPrice = Math.max(...available.map((q) => q.priceUsd));
  const avgDays = available.map((q) => (q.daysMin + q.daysMax) / 2);
  const minDays = Math.min(...avgDays);
  const maxDays = Math.max(...avgDays);

  return available
    .map((q) => ({ ...q, score: Number(scoreQuote(q, minPrice, maxPrice, minDays, maxDays).toFixed(3)) }))
    .sort((a, b) => b.score - a.score || a.priceUsd - b.priceUsd)[0];
}

function sortQuotes(quotes) {
  return [...quotes].sort((a, b) => a.priceUsd - b.priceUsd || (a.daysMin + a.daysMax) - (b.daysMin + b.daysMax));
}

// 导出给外部使用的便捷判断
export { hasRealCarrier };
