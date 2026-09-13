// 多商品合并包裹统一计价
// 运费：按合并总重量向快递商询价（一次寄送），享有规模效应
// 关税/增值税：按合并货值对照目的国免征额，免征额在各商品间按货值比例分摊，
//              各商品超出部分按自身品类税率计税（合并是否免税由总货值决定）
import { MOCK_PRODUCTS } from '../data/mockProducts.js';
import { getTaxRule, getCategoryDutyRate } from '../data/tax.js';
import { getCarrierQuotes } from './carrierService.js';
import { computeLandedCost, taxRateCny, curSymbol } from './pricing.js';
import { cnyToCurrency } from './currency.js';
import { config } from '../config.js';

function round(n, digits = 2) {
  return Number(n.toFixed(digits));
}

export async function computeCombinedQuote(opts) {
  const destCountry = opts.country || config.defaultDestCountry;
  const currency = opts.currency || config.defaultCurrency;
  const profitRate = opts.profitRate !== undefined ? opts.profitRate : config.profitRate;
  const carrier = opts.carrier;

  // 兼容两种入参：items: [{itemId, quantity}] 或 itemIds: [id]（数量默认 1）
  const rawItems = Array.isArray(opts.items)
    ? opts.items
    : (Array.isArray(opts.itemIds)
        ? opts.itemIds.map((id) => ({ itemId: id, quantity: 1 }))
        : []);
  const resolved = rawItems
    .map(({ itemId, quantity }) => {
      const product = MOCK_PRODUCTS.find((p) => p.itemId === itemId);
      if (!product) return null;
      const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
      return { product, quantity: qty };
    })
    .filter(Boolean);
  if (resolved.length === 0) {
    throw Object.assign(new Error('no valid items'), { status: 400 });
  }

  // 展开为商品行（同商品多数量按多行参与重量/货值/税费计算）
  const lines = resolved.flatMap(({ product, quantity }) =>
    Array.from({ length: quantity }, () => product)
  );
  const items = resolved.map(({ product }) => product);

  const totalWeightKg = lines.reduce((s, p) => s + (p.weightGrams || 500) / 1000, 0);
  const goodsValueCny = lines.reduce((s, p) => s + (Number(p.price) || 0), 0);

  // 统一运费：按标准 0.5kg 档询价（与商品搜索共用报价缓存，下单秒回），再按实际计费重缩放
  const carrierResult = await getCarrierQuotes({
    country: destCountry,
    weightKg: 0.5,
    valueUsd: goodsValueCny / (config.ratesUsdToCny || 7.2),
    currency: 'USD',
  });
  // carrier 参数支持渠道名（productName，多渠道场景）或快递商 code
  const chosen =
    (carrier && (carrierResult.quotes.find((q) => q.productName === carrier) || carrierResult.quotes.find((q) => q.carrier === carrier))) ||
    carrierResult.quotes.find((q) => q.productName === carrierResult.recommendedKey) ||
    carrierResult.quotes.find((q) => q.carrier === carrierResult.recommended) ||
    carrierResult.quotes[0];

  // 运费按实际总重量/报价计费重线性缩放；不足首重（0.5kg）按首重全价
  const weightFactor = chosen ? Math.max(totalWeightKg, 0.05) / (chosen.chargedKg || 0.5) : 0;
  const shippingUsd = chosen ? chosen.priceUsd * Math.max(weightFactor, 1) : 0;
  const shippingCny = shippingUsd * (config.ratesUsdToCny || 7.2);

  // 统一税费：免征额按合并货值判定，再按货值比例分摊到各商品
  const tax = getTaxRule(destCountry);
  const fx = taxRateCny(currency, destCountry, tax);
  const deMinimisCny = tax.deMinimis === Infinity ? Infinity : tax.deMinimis * fx;
  const vatThresholdCny = tax.vatThreshold === Infinity ? Infinity : tax.vatThreshold * fx;

  let dutyCnyTotal = 0;
  let vatCnyTotal = 0;
  const perItem = resolved.map(({ product, quantity }) => {
    const p = product;
    const lineCount = quantity;
    const priceCny = Number(p.price) || 0;
    const lineValueCny = priceCny * lineCount;
    const share = goodsValueCny > 0 ? lineValueCny / goodsValueCny : 0;
    const dutyRate = getCategoryDutyRate(p.category || '默认');
    const freeCny = deMinimisCny === Infinity ? lineValueCny : Math.min(deMinimisCny * share, lineValueCny);
    const taxableCny = Math.max(lineValueCny - freeCny, 0);
    const dutyCny = taxableCny * dutyRate;
    const freeVatCny = vatThresholdCny === Infinity ? lineValueCny : Math.min(vatThresholdCny * share, lineValueCny);
    const vatBaseCny = Math.max(lineValueCny - freeVatCny, 0);
    const vatCny = vatBaseCny > 0 ? (vatBaseCny + dutyCny) * tax.vatRate : 0;
    dutyCnyTotal += dutyCny;
    vatCnyTotal += vatCny;
    const lineWeightKg = ((p.weightGrams || 500) / 1000) * lineCount;
    const shippingShareCny = totalWeightKg > 0 ? shippingCny * (lineWeightKg / totalWeightKg) : 0;
    return {
      itemId: p.itemId,
      title: p.title,
      platform: p.platform,
      quantity: lineCount,
      price: priceCny,
      weightGrams: p.weightGrams || 500,
      dutyRate,
      dutyCny: round(dutyCny, 2),
      vatCny: round(vatCny, 2),
      // 运费分摊（展示用）：按重量比例
      shippingShareCny: round(shippingShareCny, 2),
      shippingShare: round(cnyToCurrency(shippingShareCny, currency)),
    };
  });

  const serviceFeeCny = goodsValueCny * config.serviceFeeRate;
  const paymentFeeCny = goodsValueCny * config.paymentFeeRate;
  const profitCny = goodsValueCny * profitRate;
  const totalCny = goodsValueCny + shippingCny + dutyCnyTotal + vatCnyTotal + serviceFeeCny + paymentFeeCny + profitCny;

  // 对比：各商品行分开单独寄的到手合计（同一快递报价，按各自重量缩放），单位 CNY 后统一转目的币
  const separateTotalCny = lines.reduce(
    (s, p) => s + computeLandedCost(p, {
      destCountry,
      currency,
      profitRate,
      carrierQuote: chosen ? { ...chosen, chargedKg: Math.max(totalWeightKg, 0.1) } : null,
    }).breakdown.totalCny,
    0
  );

  return {
    country: destCountry,
    currency,
    currencySymbol: curSymbol(currency),
    itemsCount: items.length,
    totalWeightKg: round(totalWeightKg, 3),
    carrier: chosen ? (chosen.productName || chosen.carrierName || chosen.carrier) : null,
    daysMin: chosen ? chosen.daysMin : null,
    daysMax: chosen ? chosen.daysMax : null,
    shippingSource: chosen ? chosen.source : 'estimate',
    breakdown: {
      goodsValue: round(cnyToCurrency(goodsValueCny, currency)),
      goodsValueCny: round(goodsValueCny, 2),
      intlShipping: round(cnyToCurrency(shippingCny, currency)),
      intlShippingCny: round(shippingCny, 2),
      duty: round(cnyToCurrency(dutyCnyTotal, currency)),
      dutyCny: round(dutyCnyTotal, 2),
      vat: round(cnyToCurrency(vatCnyTotal, currency)),
      vatCny: round(vatCnyTotal, 2),
      serviceFee: round(cnyToCurrency(serviceFeeCny, currency)),
      paymentFee: round(cnyToCurrency(paymentFeeCny, currency)),
      profit: round(cnyToCurrency(profitCny, currency)),
      total: round(cnyToCurrency(totalCny, currency)),
      totalCny: round(totalCny, 2),
    },
    perItem,
    separateTotal: round(cnyToCurrency(separateTotalCny, currency)),
    combinedTotal: round(cnyToCurrency(totalCny, currency)),
    savings: round(cnyToCurrency(separateTotalCny - totalCny, currency)),
    taxNote: tax.note || '',
  };
}
