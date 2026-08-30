import { config } from '../config.js';

// 内置基准汇率（CNY 基准），每日由外部 API 刷新，离线时有兜底值
const BASE_RATES = {
  CNY: 1,
  USD: 0.14,
  EUR: 0.13,
  GBP: 0.11,
  JPY: 21.0,
  KRW: 190.0,
  SGD: 0.19,
  CAD: 0.19,
  AUD: 0.21,
  HKD: 1.09,
  TWD: 4.5,
  INR: 11.8,
  BRL: 0.72,
  MXN: 2.5,
  RUB: 13.0,
  TRY: 4.5,
  ZAR: 2.6,
  CHF: 0.12,
  SEK: 1.5,
  NOK: 1.5,
  PLN: 0.55,
  THB: 5.0,
  VND: 3550,
  MYR: 0.66,
  PHP: 8.0,
  IDR: 2200,
  AED: 0.52,
  SAR: 0.53,
};

let cache = { rates: { ...BASE_RATES }, updatedAt: null };

async function fetchLiveRates() {
  // 使用 open.er-api.com 免费汇率接口（以 USD 为基准），或通过 config 指定
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('https://open.er-api.com/v6/latest/CNY', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.result === 'success' && data.rates) {
      const rates = { CNY: 1, ...data.rates };
      cache = { rates, updatedAt: new Date().toISOString() };
    }
  } catch {
    // 网络不可用时保留兜底汇率
  }
}

export async function refreshRatesIfNeeded() {
  const staleMinutes = cache.updatedAt
    ? (Date.now() - new Date(cache.updatedAt).getTime()) / 60000
    : Infinity;
  if (staleMinutes > config.fxCacheMinutes) {
    await fetchLiveRates();
  }
}

export function getRates() {
  return cache.rates;
}

// 将人民币金额转换为目标货币
export function cnyToCurrency(cny, targetCurrency = config.defaultCurrency) {
  const rates = cache.rates;
  const targetRate = rates[targetCurrency] ?? BASE_RATES[targetCurrency] ?? 0.14;
  return cny * targetRate;
}

export function currencySymbol(currency) {
  const symbols = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', KRW: '₩', CNY: '¥', SGD: 'S$',
    CAD: 'C$', AUD: 'A$', HKD: 'HK$', TWD: 'NT$', INR: '₹', BRL: 'R$',
    MXN: 'MX$', RUB: '₽', TRY: '₺', ZAR: 'R', CHF: 'Fr', SEK: 'kr',
    NOK: 'kr', PLN: 'zł', THB: '฿', VND: '₫', MYR: 'RM', PHP: '₱',
    IDR: 'Rp', AED: 'د.إ', SAR: 'ر.س',
  };
  return symbols[currency] ?? currency;
}
