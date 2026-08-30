import { config } from '../config.js';

// 平台信誉权重（京东自营 > 天猫旗舰 > 京东第三方 > 淘宝 > 1688 > 拼多多）
const PLATFORM_WEIGHT = {
  '京东': 1.0,
  '天猫': 0.95,
  '淘宝': 0.85,
  '1688': 0.8,
  '拼多多': 0.7,
};

const SHOP_TYPE_WEIGHT = {
  '旗舰店': 1.0,
  '自营': 1.0,
  '专营店': 0.9,
  '官方店': 0.95,
  '普通': 0.8,
  '企业店': 0.85,
  '金牌卖家': 0.9,
};

// 排序权重配置（可按需调整）
export const DEFAULT_WEIGHTS = {
  price: 0.4,      // 到手总价
  reputation: 0.25, // 平台+店铺信誉
  sales: 0.15,      // 销量
  speed: 0.1,       // 物流时效
  commission: 0.1,  // 平台可靠性
};

// 价格得分：总成本越低分越高（线性映射到 0-100）
function priceScore(total, minTotal, maxTotal) {
  if (maxTotal <= minTotal) return 80;
  const ratio = (total - minTotal) / (maxTotal - minTotal);
  return Math.max(10, 100 - ratio * 90);
}

function reputationScore(product) {
  const platform = PLATFORM_WEIGHT[product.platform] ?? 0.8;
  const shop = SHOP_TYPE_WEIGHT[product.shopType] ?? 0.8;
  const rating = Number(product.rating) || 95;
  return (platform * 0.5 + shop * 0.3 + (rating / 100) * 0.2) * 100;
}

function salesScore(product, maxSales) {
  if (!maxSales) return 50;
  return Math.min(100, (Number(product.sales || 0) / maxSales) * 100);
}

function speedScore(shipping) {
  const avgDays = ((shipping.daysMin || 10) + (shipping.daysMax || 18)) / 2;
  return Math.max(10, 100 - avgDays * 5);
}

function commissionScore(product) {
  // 联盟返佣率，未配置返佣按平台可靠性给分
  const commissionRate = Number(product.commissionRate) || 0;
  return Math.min(100, 40 + commissionRate * 100);
}

/**
 * 推荐排序：对每个"平台报价"计算综合得分并排序
 * @param {Array} groups 归一化后的商品分组 [{...group, options: [product]}]
 * @param {Object} opts { destCountry, currency, profitRate, weights }
 */
export function rankProducts(groups, opts = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(opts.weights || {}) };
  const destCountry = opts.destCountry || config.defaultDestCountry;
  const currency = opts.currency || config.defaultCurrency;

  // 第一步：计算每个报价的总成本
  const scored = groups.map((group) => {
    const options = group.options.map((product) => ({
      ...product,
      landed: computeLanding(product, opts),
    }));
    return { ...group, options };
  });

  // 第二步：找到所有报价中的总价范围（用于价格归一化）
  const allTotals = scored.flatMap((g) => g.options.map((o) => o.landed.breakdown.total));
  const minTotal = Math.min(...allTotals);
  const maxTotal = Math.max(...allTotals);

  // 第三步：为每个报价打分
  const rankedOptions = [];
  for (const group of scored) {
    for (const opt of group.options) {
      const maxSales = maxSalesOf(scored);
      const price = priceScore(opt.landed.breakdown.total, minTotal, maxTotal);
      const reputation = reputationScore(opt);
      const sales = salesScore(opt, maxSales);
      const speed = speedScore(opt.landed.shipping);
      const commission = commissionScore(opt);

      const total =
        price * weights.price +
        reputation * weights.reputation +
        sales * weights.sales +
        speed * weights.speed +
        commission * weights.commission;

      rankedOptions.push({
        ...opt,
        groupId: group.groupId,
        scores: {
          price: round(price),
          reputation: round(reputation),
          sales: round(sales),
          speed: round(speed),
          commission: round(commission),
          total: round(total),
        },
      });
    }
  }

  // 排序：按综合得分降序
  rankedOptions.sort((a, b) => b.scores.total - a.scores.total);

  // 标记 Top 推荐
  return rankedOptions.map((opt, idx) => ({
    ...opt,
    rank: idx + 1,
    isTopPick: idx === 0,
    isRecommended: idx < 5,
  }));
}

// 避免循环依赖：把 computeLandedCost 引入
import { computeLandedCost } from './pricing.js';
function computeLanding(product, opts) {
  return computeLandedCost(product, opts);
}

function maxSalesOf(scored) {
  let m = 0;
  for (const g of scored) {
    for (const o of g.options) {
      m = Math.max(m, Number(o.sales || 0));
    }
  }
  return m;
}

function round(n, digits = 2) {
  return Number(n.toFixed(digits));
}
