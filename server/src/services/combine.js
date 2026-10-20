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
  // 商品解析：默认查内置商品池；真实平台商品（如拼多多）由调用方注入 resolveProduct
  const resolveProduct =
    typeof opts.resolveProduct === 'function'
      ? opts.resolveProduct
      : (itemId) => MOCK_PRODUCTS.find((p) => p.itemId === itemId) || null;
  const productOrNulls = await Promise.all(
    rawItems.map(({ itemId, priceOverride }) =>
      Promise.resolve()
        .then(() => resolveProduct(String(itemId)))
        .catch(() => null)
        .then((p) => ({ product: p || null, priceOverride }))
    )
  );
  const resolved = rawItems
    .map(({ itemId, quantity }, idx) => {
      const { product, priceOverride } = productOrNulls[idx];
      if (!product) return null;
      const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
      // SKU 级价格覆盖：买家选择规格后由服务端查得的规格价（防客户端传价篡改）
      const p = Number(priceOverride) > 0 ? { ...product, price: Number(priceOverride) } : product;
      return { product: p, quantity: qty };
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

  // 按发货仓分组：同仓商品可合并一个国际包裹，跨仓拆单（各包裹独立计费与清关）
  const groupsMap = new Map();
  for (const { product, quantity } of resolved) {
    const wh = product.warehouse || 'sz';
    if (!groupsMap.has(wh)) groupsMap.set(wh, []);
    groupsMap.get(wh).push({ product, quantity });
  }
  const groups = [...groupsMap.entries()].map(([warehouse, members]) => ({
    warehouse,
    members,
    weightKg: members.reduce((s, { product, quantity }) => s + ((product.weightGrams || 500) / 1000) * quantity, 0),
    valueCny: members.reduce((s, { product, quantity }) => s + (Number(product.price) || 0) * quantity, 0),
  }));

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

  // 运费：单次询价（与商品搜索共用报价缓存），各组按自身计费重缩放（不足首重按首重全价）

  // 统一税费基线（单仓合并寄时与各组口径一致）；跨仓拆单后实际税费按各组包裹独立判定
  const tax = getTaxRule(destCountry);

  // 跨仓拆单：各仓库包裹独立计费（首重各自起步）与独立清关（免征额按各自包裹货值判定）
  const groupResults = groups.map((g) => {
    const taxG = getTaxRule(destCountry);
    const fxG = taxRateCny(currency, destCountry, taxG);
    const deMinimisG = taxG.deMinimis === Infinity ? Infinity : taxG.deMinimis * fxG;
    const vatThresholdG = taxG.vatThreshold === Infinity ? Infinity : taxG.vatThreshold * fxG;
    const factorG = chosen ? Math.max(g.weightKg, 0.05) / (chosen.chargedKg || 0.5) : 0;
    const shippingCnyG = chosen ? chosen.priceUsd * Math.max(factorG, 1) * (config.ratesUsdToCny || 7.2) : 0;
    let dutyCnyG = 0;
    let vatCnyG = 0;
    for (const { product, quantity } of g.members) {
      const lineValueCny = (Number(product.price) || 0) * quantity;
      const share = g.valueCny > 0 ? lineValueCny / g.valueCny : 0;
      const dutyRate = getCategoryDutyRate(product.category || '默认');
      const freeCny = deMinimisG === Infinity ? lineValueCny : Math.min(deMinimisG * share, lineValueCny);
      const lineDuty = Math.max(lineValueCny - freeCny, 0) * dutyRate;
      const freeVatCny = vatThresholdG === Infinity ? lineValueCny : Math.min(vatThresholdG * share, lineValueCny);
      const lineVatBase = Math.max(lineValueCny - freeVatCny, 0);
      const lineVat = lineVatBase > 0 ? (lineVatBase + lineDuty) * taxG.vatRate : 0;
      dutyCnyG += lineDuty;
      vatCnyG += lineVat;
    }
    return {
      warehouse: g.warehouse,
      weightKg: round(g.weightKg, 3),
      goodsValueCny: round(g.valueCny, 2),
      shippingCny: round(shippingCnyG, 2),
      dutyCny: round(dutyCnyG, 2),
      vatCny: round(vatCnyG, 2),
      itemCount: g.members.reduce((s, { quantity }) => s + quantity, 0),
      lineDutyVat: g.members.map(({ product, quantity }) => {
        const lineValueCny = (Number(product.price) || 0) * quantity;
        const share = g.valueCny > 0 ? lineValueCny / g.valueCny : 0;
        const dutyRate = getCategoryDutyRate(product.category || '默认');
        const freeCny = deMinimisG === Infinity ? lineValueCny : Math.min(deMinimisG * share, lineValueCny);
        const lineDuty = Math.max(lineValueCny - freeCny, 0) * dutyRate;
        const freeVatCny = vatThresholdG === Infinity ? lineValueCny : Math.min(vatThresholdG * share, lineValueCny);
        const lineVatBase = Math.max(lineValueCny - freeVatCny, 0);
        const lineVat = lineVatBase > 0 ? (lineVatBase + lineDuty) * taxG.vatRate : 0;
        return { itemId: product.itemId, dutyCny: lineDuty, vatCny: lineVat, dutyRate };
      }),
    };
  });

  // 拆单后：运费/税费取各组和；单仓时与合并口径完全一致
  const shippingCny = groupResults.reduce((s, g) => s + g.shippingCny, 0);
  const dutyCnyTotal = groupResults.reduce((s, g) => s + g.dutyCny, 0);
  const vatCnyTotal = groupResults.reduce((s, g) => s + g.vatCny, 0);
  const lineDutyVatMap = new Map();
  for (const g of groupResults) {
    for (const lv of g.lineDutyVat) {
      const prev = lineDutyVatMap.get(lv.itemId);
      lineDutyVatMap.set(lv.itemId, {
        dutyCny: (prev?.dutyCny || 0) + lv.dutyCny,
        vatCny: (prev?.vatCny || 0) + lv.vatCny,
        dutyRate: lv.dutyRate,
      });
    }
  }

  const perItem = resolved.map(({ product, quantity }) => {
    const p = product;
    const lineCount = quantity;
    const priceCny = Number(p.price) || 0;
    const lineWeightKg = ((p.weightGrams || 500) / 1000) * lineCount;
    // 拆单后运费分摊（展示用）：按重量比例摊整单运费
    const shippingShareCny = totalWeightKg > 0 ? shippingCny * (lineWeightKg / totalWeightKg) : 0;
    const lv = lineDutyVatMap.get(p.itemId) || { dutyCny: 0, vatCny: 0, dutyRate: getCategoryDutyRate(p.category || '默认') };
    return {
      itemId: p.itemId,
      title: p.title,
      platform: p.platform,
      warehouse: p.warehouse || 'sz',
      quantity: lineCount,
      price: priceCny,
      weightGrams: p.weightGrams || 500,
      dutyRate: lv.dutyRate,
      dutyCny: round(lv.dutyCny, 2),
      vatCny: round(lv.vatCny, 2),
      // 运费分摊（展示用）：按重量比例
      shippingShareCny: round(shippingShareCny, 2),
      shippingShare: round(cnyToCurrency(shippingShareCny, currency)),
    };
  });

  // 服务费率：买家下单时自选（默认 5%），独立于利润加成
  const serviceFeeRate = opts.serviceFeeRate !== undefined ? opts.serviceFeeRate : config.serviceFeeRate;
  const serviceFeeCny = goodsValueCny * serviceFeeRate;
  const paymentFeeCny = goodsValueCny * config.paymentFeeRate;
  const profitCny = goodsValueCny * profitRate;
  const totalCny = goodsValueCny + shippingCny + dutyCnyTotal + vatCnyTotal + serviceFeeCny + paymentFeeCny + profitCny;

  // 对比：各商品行分开单独寄的到手合计（同一快递报价，按各自重量缩放），单位 CNY 后统一转目的币
  const separateTotalCny = lines.reduce(
    (s, p) => s + computeLandedCost(p, {
      destCountry,
      currency,
      profitRate,
      serviceFeeRate,
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
      serviceFeeCny: round(serviceFeeCny, 2),
      serviceFeeRate: round(serviceFeeRate, 4),
      paymentFee: round(cnyToCurrency(paymentFeeCny, currency)),
      paymentFeeCny: round(paymentFeeCny, 2),
      profit: round(cnyToCurrency(profitCny, currency)),
      profitCny: round(profitCny, 2),
      total: round(cnyToCurrency(totalCny, currency)),
      totalCny: round(totalCny, 2),
    },
    perItem,
    separateTotal: round(cnyToCurrency(separateTotalCny, currency)),
    combinedTotal: round(cnyToCurrency(totalCny, currency)),
    savings: round(cnyToCurrency(separateTotalCny - totalCny, currency)),
    taxNote: tax.note || '',
    taxNoteEn: tax.noteEn || '',
    // 按仓库拆单：包裹数预告与各仓计费明细
    expectedParcels: groupResults.length,
    warehouses: groupResults.map((g) => g.warehouse),
    groups: groupResults.map((g) => ({
      warehouse: g.warehouse,
      weightKg: g.weightKg,
      goodsValueCny: g.goodsValueCny,
      shippingCny: g.shippingCny,
      dutyCny: g.dutyCny,
      vatCny: g.vatCny,
      itemCount: g.itemCount,
    })),
  };
}
