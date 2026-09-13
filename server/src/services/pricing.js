import { config } from '../config.js';
import { getShippingRates } from '../data/shipping.js';
import { getTaxRule, getCategoryDutyRate } from '../data/tax.js';
import { cnyToCurrency } from './currency.js';

/**
 * 计算单个平台报价的"到手总成本"
 * 公式（本币）：
 *   货值本币 = 商品原价(CNY) * 汇率
 *   国际运费 = base + perKg * weight(kg)，取不低于 min
 *   完税货值 = max(货值本币 - deMinimis, 0) 部分征税
 *   关税 = 完税货值 * dutyRate（简化：deMinimis 以内免关税）
 *   VAT = (货值本币 + 关税) * vatRate（超起征点才征收）
 *   服务费 = 货值本币 * serviceFeeRate
 *   支付费 = 货值本币 * paymentFeeRate
 *   利润 = 货值本币 * profitRate
 *   总成本 = 货值本币 + 国际运费 + 关税 + VAT + 服务费 + 支付费 + 利润
 */
export function computeLandedCost(product, opts = {}) {
  const destCountry = opts.destCountry || config.defaultDestCountry;
  const currency = opts.currency || config.defaultCurrency;
  const profitRate = opts.profitRate !== undefined ? opts.profitRate : config.profitRate;

  const priceCny = Number(product.price) || 0;
  const weightKg = (product.weightGrams || 500) / 1000;

  const ship = getShippingRates(destCountry);
  const tax = getTaxRule(destCountry);
  const dutyRate = product.dutyRate ?? getCategoryDutyRate(product.category || '默认');

  // 国际运费：实时快递报价优先，静态估算兜底
  const carrierQuote = opts.carrierQuote;
  let intlShippingUsd;
  let carrierName;
  let daysMin;
  let daysMax;
  let shippingSource = 'estimate';
  if (carrierQuote && carrierQuote.priceUsd) {
    // 按代表性重量(chargedKg)线性缩放；重量越大运费越高
    const refKg = Math.max(carrierQuote.chargedKg || 0.5, 0.1);
    intlShippingUsd = Math.max(carrierQuote.priceUsd * (weightKg / refKg), carrierQuote.priceUsd * 0.8);
    carrierName = carrierQuote.carrierName || carrierQuote.carrier;
    daysMin = carrierQuote.daysMin;
    daysMax = carrierQuote.daysMax;
    shippingSource = carrierQuote.source || 'api';
  } else {
    intlShippingUsd = Math.max(ship.base + ship.perKg * weightKg, ship.min);
    carrierName = ship.carrier;
    daysMin = ship.daysMin;
    daysMax = ship.daysMax;
  }
  const intlShippingCny = intlShippingUsd * (config.ratesUsdToCny || 7.2);

  const goodsValueCny = priceCny;
  const goodsValueCur = cnyToCurrency(goodsValueCny, currency);

  // 完税货值（超出免征额部分，deMinimis 以目的国货币计，折算为 CNY）
  const deMinimisCny = tax.deMinimis === Infinity ? Infinity : tax.deMinimis * taxRateCny(currency, destCountry, tax);
  const taxableBaseCny = Math.max(goodsValueCny - deMinimisCny, 0);
  const dutyCny = taxableBaseCny > 0 ? taxableBaseCny * dutyRate : 0;

  // VAT：欧盟等 vatThreshold=0 无小额免征；高于门槛才征收
  const vatThresholdCny = tax.vatThreshold === Infinity ? Infinity : tax.vatThreshold * taxRateCny(currency, destCountry, tax);
  const vatBaseCny = Math.max(goodsValueCny - vatThresholdCny, 0);
  const vatCny = vatBaseCny > 0 ? (vatBaseCny + dutyCny) * tax.vatRate : 0;

  const serviceFeeCny = goodsValueCny * config.serviceFeeRate;
  const paymentFeeCny = goodsValueCny * config.paymentFeeRate;
  const profitCny = goodsValueCny * profitRate;

  const intlShippingCur = cnyToCurrency(intlShippingCny, currency);
  const dutyCur = cnyToCurrency(dutyCny, currency);
  const vatCur = cnyToCurrency(vatCny, currency);
  const serviceFeeCur = cnyToCurrency(serviceFeeCny, currency);
  const paymentFeeCur = cnyToCurrency(paymentFeeCny, currency);
  const profitCur = cnyToCurrency(profitCny, currency);

  const totalCny = goodsValueCny + intlShippingCny + dutyCny + vatCny + serviceFeeCny + paymentFeeCny + profitCny;
  const totalCur = cnyToCurrency(totalCny, currency);

  return {
    destCountry,
    currency,
    currencySymbol: curSymbol(currency),
    breakdown: {
      goodsValue: round(goodsValueCur),
      goodsValueCny: round(goodsValueCny, 2),
      intlShipping: round(intlShippingCur),
      intlShippingCny: round(intlShippingCny, 2),
      duty: round(dutyCur),
      dutyCny: round(dutyCny, 2),
      vat: round(vatCur),
      vatCny: round(vatCny, 2),
      serviceFee: round(serviceFeeCur),
      paymentFee: round(paymentFeeCur),
      profit: round(profitCur),
      total: round(totalCur),
      totalCny: round(totalCny, 2),
    },
    shipping: {
      carrier: carrierName,
      daysMin,
      daysMax,
      weightGrams: product.weightGrams || 500,
      source: shippingSource,
      quoteUsd: carrierQuote ? carrierQuote.priceUsd : null,
    },
    taxNote: tax.note || '',
    vatRate: tax.vatRate,
    dutyRate,
    deMinimis: tax.deMinimis,
  };
}

// 税率换算辅助：目标币种到 CNY 的汇率（近似，用于 deMinimis 折算）
export function taxRateCny(currency, destCountry, tax) {
  // deMinimis 使用目的国货币计，转为 CNY 估算（USD/EUR/GBP 基准汇率）
  const approx = {
    USD: 7.2, EUR: 7.8, GBP: 9.1, CAD: 5.3, AUD: 4.7, JPY: 0.05,
    KRW: 0.0053, SGD: 5.3, MYR: 1.6, THB: 0.21, VND: 0.0003, PHP: 0.13,
    IDR: 0.00047, INR: 0.086, SAR: 1.92, AED: 1.96, BRL: 1.4, MXN: 0.42,
    RUB: 0.09, TRY: 0.26, ZAR: 0.39, CHF: 8.1, SEK: 0.68, NOK: 0.67,
    PLN: 1.8, HKD: 0.92, TWD: 0.23,
  };
  return approx[currency] ?? approx[destCountry] ?? 7.2;
}

function round(n, digits = 2) {
  return Number(n.toFixed(digits));
}

export function curSymbol(currency) {
  const symbols = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', KRW: '₩', CNY: '¥', SGD: 'S$',
    CAD: 'C$', AUD: 'A$', HKD: 'HK$', TWD: 'NT$', INR: '₹', BRL: 'R$',
    MXN: 'MX$', RUB: '₽', TRY: '₺', ZAR: 'R', CHF: 'Fr', SEK: 'kr', NOK: 'kr',
    PLN: 'zł', THB: '฿', VND: '₫', MYR: 'RM', PHP: '₱', IDR: 'Rp', AED: 'د.إ', SAR: 'ر.س',
  };
  return symbols[currency] ?? currency;
}
