import { createAdapters } from '../platforms/index.js';
import { normalizeProduct, groupAndDedupe } from './normalize.js';
import { rankProducts } from './rank.js';
import { refreshRatesIfNeeded } from './currency.js';
import { translateTitleToEnglish } from './translate.js';
import { config } from '../config.js';
import { getCarrierQuotes } from './carrierService.js';

/**
 * 主搜索编排：并行调用各平台 -> 归一化 -> 去重分组 -> 计算总成本 -> 推荐排序
 */
export async function searchAndCompare(rawKeyword, opts = {}) {
  await refreshRatesIfNeeded();

  // 获取国际快递报价（用于实时运费 + 自动推荐最优快递商）
  const carrierOpts = {
    country: opts.destCountry || config.defaultDestCountry,
    weightKg: 0.5,
    dims: { lengthCm: 12, widthCm: 10, heightCm: 4 },
    valueUsd: 20,
  };
  const carrierResult = await getCarrierQuotes(carrierOpts);
  const preferred = opts.carrier
    ? carrierResult.quotes.find((q) => q.carrier === opts.carrier || q.configId === opts.carrier)
    : null;
  const carrierQuote = preferred || carrierResult.quotes.find((q) => q.carrier === carrierResult.recommended) || carrierResult.quotes[0] || null;

  const adapters = createAdapters();
  const selected = opts.platforms && opts.platforms.length
    ? Object.keys(adapters).filter((k) => opts.platforms.includes(k))
    : Object.keys(adapters);

  // 并行搜索各平台
  const results = await Promise.allSettled(
    selected.map((key) => adapters[key].search(rawKeyword, opts))
  );

  const rawItems = [];
  const sourceInfo = [];
  results.forEach((r, i) => {
    const key = selected[i];
    if (r.status === 'fulfilled') {
      const res = r.value;
      rawItems.push(...res.items);
      sourceInfo.push({
        platform: key,
        name: adapterName(key),
        status: res.sourceType,
        count: res.items.length,
      });
    } else {
      sourceInfo.push({
        platform: key,
        name: adapterName(key),
        status: 'error',
        count: 0,
        error: r.reason?.message || '未知错误',
      });
    }
  });

  // 归一化 + 英文标题（供海外买家展示）
  const normalized = rawItems.map((item) => ({
    ...normalizeProduct(item),
    titleEn: translateTitleToEnglish(item.title || ''),
  }));

  // 去重分组
  const groups = groupAndDedupe(normalized);

  // 推荐排序（含总成本计算，传入快递报价）
  const ranked = rankProducts(groups, { ...opts, carrierQuote });

  return {
    keyword: rawKeyword,
    translatedKeyword: opts.translatedKeyword,
    sourceInfo,
    total: ranked.length,
    results: ranked,
    carrier: carrierQuote
      ? {
          carrier: carrierQuote.carrier,
          carrierName: carrierQuote.carrierName,
          productName: carrierQuote.productName,
          priceUsd: carrierQuote.priceUsd,
          daysMin: carrierQuote.daysMin,
          daysMax: carrierQuote.daysMax,
          source: carrierQuote.source,
          recommended: carrierQuote.carrier === carrierResult.recommended,
        }
      : null,
    carrierQuotes: carrierResult.quotes.map((q) => ({
      carrier: q.carrier,
      carrierName: q.carrierName,
      productName: q.productName,
      priceUsd: q.priceUsd,
      daysMin: q.daysMin,
      daysMax: q.daysMax,
      source: q.source,
      recommended: q.carrier === carrierResult.recommended,
    })),
  };
}

function adapterName(key) {
  const map = { taobao: '淘宝', jd: '京东', pdd: '拼多多', '1688': '1688' };
  return map[key] ?? key;
}
