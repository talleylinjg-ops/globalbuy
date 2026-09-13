// 国际快递报价服务：并行询价 -> 自动排序 -> 推荐最优
// 生产模式：仅返回已配置真实 API 的快递商报价；估算兜底已停用
import { getCarrierConfigs, hasRealCarrier } from './carrierStore.js';
import { createCarrierAdapter } from '../carriers/index.js';

/**
 * 并行获取所有已启用且已配置真实 API 的快递商报价
 * @param {object} p
 * @param {string} p.country 目的国
 * @param {number} p.weightKg 重量
 * @param {object} [p.dims] 尺寸 {lengthCm,widthCm,heightCm}
 * @param {number} [p.valueUsd] 申报货值
 * @returns {Promise<{quotes: Array, recommended: string|null, hasRealData: boolean}>}
 */
// 报价缓存：真实 API 慢（部分接口 40s+），TTL 内复用结果；失败时降级用上次成功值
const QUOTE_TTL = 30 * 60 * 1000;
const quoteCache = new Map(); // key: `${country}:${weightGrams}` -> { at, value }

export async function getCarrierQuotes(p) {
  const key = `${p.country}:${Math.ceil((p.weightKg || 0.5) * 1000)}`;
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL) return hit.value;

  const fresh = await fetchQuotes(p);
  if (fresh.quotes.length > 0) {
    quoteCache.set(key, { at: Date.now(), value: fresh });
    return fresh;
  }
  // 全部失败：有旧缓存则用旧值，否则返回空
  if (hit) return hit.value;
  return fresh;
}

async function fetchQuotes(p) {
  const configs = getCarrierConfigs().filter((c) => c.enabled !== false);

  // 只询价已配置真实 API 的快递商；未接入的直接跳过（生产模式不返回估算价）
  const jobs = configs
    .filter((cfg) => {
      const adapter = createCarrierAdapter(cfg);
      return adapter && adapter.configured;
    })
    .map(async (cfg) => {
      const adapter = createCarrierAdapter(cfg);
      try {
        // 单快递商可能返回多渠道报价（如华源多条专线），统一 flatten
        const result = await adapter.quote(p);
        return (Array.isArray(result) ? result : [result]).map((q) => ({
          ...q,
          status: 'ok',
          configId: cfg.id,
        }));
      } catch (e) {
        // 真实 API 失败：该渠道标记错误并标记不可用，不回退估算
        return [{
          status: 'error',
          error: e.message,
          carrier: cfg.code,
          carrierName: cfg.name,
          configId: cfg.id,
          available: false,
        }];
      }
    });

  const settled = await Promise.allSettled(jobs);
  const quotes = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) quotes.push(...r.value);
  });

  const available = quotes.filter((q) => q.available);
  const best = available.length ? pickBest(available) : null;
  // 推荐精确到具体渠道（同一快递商多渠道时按 routeCode/渠道名区分）
  const recommendedKey = best ? (best.raw?.routeCode || best.productName) : null;

  return {
    quotes: sortQuotes(available),
    recommended: best ? best.carrier : null,
    recommendedKey,
    hasRealData: available.length > 0,
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
