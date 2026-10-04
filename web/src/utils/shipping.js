// 从渠道报价中挑选三档展示（最快 / 最便宜 / 居中），价格数值互不相同
export function pickShippingTiers(quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  const byPrice = [...quotes].sort((a, b) => a.priceUsd - b.priceUsd);
  const byDays = [...quotes].sort(
    (a, b) => (a.daysMin + a.daysMax) / 2 - (b.daysMin + b.daysMax) / 2
  );
  const cheapest = byPrice[0];
  const fastest = byDays[0];
  // 按价格数字去重：三个档位的价格数值必须互不相同，视觉上才是三个价格
  const usedPrices = new Set([cheapest, fastest].map((q) => q.priceUsd));

  // 居中：从价格中位出发向两侧找与最便宜/最快价格不同的报价
  let middle = null;
  const start = Math.floor(byPrice.length / 2);
  for (let d = 0; d < byPrice.length && !middle; d++) {
    for (const i of [start + d, start - d]) {
      if (i >= 0 && i < byPrice.length) {
        const q = byPrice[i];
        if (!usedPrices.has(q.priceUsd)) {
          middle = q;
          break;
        }
      }
    }
  }

  const tiers = [];
  const push = (label, quote) => {
    const existing = tiers.find((tr) => tr.quote === quote);
    if (existing) existing.labels.push(label);
    else tiers.push({ labels: [label], quote });
  };
  push('shipFastest', fastest);
  push('shipCheapest', cheapest);
  if (middle) push('shipMiddle', middle);
  return tiers;
}
