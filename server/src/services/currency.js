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
  NZD: 0.23,
  DKK: 0.97,
  CZK: 3.3,
  HUF: 52.0,
  RON: 0.64,
  BGN: 0.25,
  HRK: 0.97,
  ISK: 19.0,
  UAH: 5.8,
  RSD: 15.0,
  ILS: 0.52,
  QAR: 0.51,
  KWD: 0.043,
  OMR: 0.054,
  BHD: 0.053,
  JOD: 0.099,
  PKR: 39.0,
  BDT: 16.5,
  LKR: 45.0,
  NPR: 18.9,
  KHR: 570.0,
  MMK: 295.0,
  MNT: 490.0,
  KZT: 65.0,
  UZS: 1750.0,
  AZN: 0.24,
  AMD: 54.0,
  GEL: 0.38,
  MOP: 1.12,
  BND: 0.19,
  NGN: 215.0,
  KES: 18.0,
  GHS: 2.1,
  EGP: 6.8,
  MAD: 1.4,
  DZD: 18.7,
  TND: 0.44,
  ETB: 16.0,
  TZS: 360.0,
  UGX: 520.0,
  ZMW: 3.7,
  BWP: 1.9,
  NAD: 2.6,
  MZN: 8.9,
  AOA: 128.0,
  ARS: 140.0,
  CLP: 132.0,
  COP: 560.0,
  PEN: 0.53,
  UYU: 5.5,
  PYG: 1080.0,
  BOB: 0.97,
  GYD: 29.0,
  SRD: 5.0,
  FJD: 0.31,
  PGK: 0.53,
  XCD: 0.38,
  JMD: 21.5,
  TTD: 0.95,
  BSD: 0.14,
  BMD: 0.14,
  GTQ: 1.08,
  HNL: 3.5,
  NIO: 5.1,
  CRC: 72.0,
  PAB: 0.14,
  DOP: 8.2,
  CUP: 3.4,
  HTG: 12.0,
  KYD: 0.12,
  XPF: 15.0,
  WST: 0.38,
  TOP: 0.33,
  VUV: 16.5,
  SBD: 1.2,
  MVR: 2.15,
  SCR: 2.0,
  MUR: 6.4,
  KMF: 64.0,
  DJF: 25.0,
  SOS: 80.0,
  SDG: 84.0,
  SSP: 182.0,
  MWK: 240.0,
  LSL: 2.6,
  SZL: 2.6,
  BIF: 400.0,
  ERN: 2.1,
  GNF: 1200.0,
  SLE: 3.3,
  LRD: 27.0,
  GMD: 9.5,
  CVE: 14.3,
  MRU: 5.5,
  STN: 3.2,
  MGA: 640.0,
  CDF: 400.0,
  XOF: 0.085,
  XAF: 0.085,
  LBP: 12500.0,
  IQD: 183.0,
  IRR: 5900.0,
  SYP: 3600.0,
  YER: 35.0,
  AFN: 9.9,
  BYN: 0.46,
  MDL: 2.5,
  MKD: 8.0,
  ALL: 13.0,
  BAM: 0.25,
  KGS: 12.0,
  TJS: 1.55,
  TMT: 0.49,
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

// 失败冷却：外部汇率 API 不可达时，冷却期内跳过重试，避免每次搜索都等待网络超时
let lastFxAttemptAt = 0;
const FX_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

export async function refreshRatesIfNeeded() {
  const now = Date.now();
  if (now - lastFxAttemptAt < FX_RETRY_COOLDOWN_MS) return;
  const staleMinutes = cache.updatedAt
    ? (now - new Date(cache.updatedAt).getTime()) / 60000
    : Infinity;
  if (staleMinutes > config.fxCacheMinutes) {
    lastFxAttemptAt = now;
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
  NZD: 'NZ$', DKK: 'kr', CZK: 'Kč', HUF: 'Ft', RON: 'lei', BGN: 'лв',
  ISK: 'kr', UAH: '₴', RSD: 'дин', ILS: '₪', QAR: 'ر.ق', KWD: 'د.ك',
  PKR: '₨', BDT: '৳', LKR: 'Rs', NGN: '₦', KES: 'KSh', GHS: 'GH₵',
  EGP: 'E£', MAD: 'د.م.', ARS: 'AR$', CLP: 'CL$', COP: 'COL$', PEN: 'S/',
  UYU: '$U', PYG: '₲', BOB: 'Bs', FJD: 'FJ$', PGK: 'K', XCD: 'EC$',
  JMD: 'J$', TTD: 'TT$', GTQ: 'Q', DOP: 'RD$', XOF: 'CFA', XAF: 'FCFA',
  MUR: '₨', XPF: '₣',
};
  return symbols[currency] ?? currency;
}
