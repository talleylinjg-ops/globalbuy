// 国际快递/专线运费估算表
// 以中国直发到目的国的经济专线/邮政小包为基准，单位：美元/kg（含燃油附加）
// key: 目的国 ISO alpha-2
export const INTERNATIONAL_SHIPPING = {
  US: { base: 4.8, perKg: 12.5, min: 6.0, daysMin: 8, daysMax: 15, carrier: '云途专线' },
  GB: { base: 5.2, perKg: 13.5, min: 6.5, daysMin: 7, daysMax: 12, carrier: '云途专线' },
  DE: { base: 5.5, perKg: 14.0, min: 7.0, daysMin: 8, daysMax: 14, carrier: '云途专线' },
  FR: { base: 5.5, perKg: 14.0, min: 7.0, daysMin: 8, daysMax: 14, carrier: '云途专线' },
  NL: { base: 5.2, perKg: 13.5, min: 6.5, daysMin: 7, daysMax: 12, carrier: '云途专线' },
  IT: { base: 5.8, perKg: 14.5, min: 7.0, daysMin: 9, daysMax: 15, carrier: '云途专线' },
  ES: { base: 5.5, perKg: 14.0, min: 6.8, daysMin: 8, daysMax: 14, carrier: '云途专线' },
  CA: { base: 5.2, perKg: 13.8, min: 6.5, daysMin: 8, daysMax: 15, carrier: '云途专线' },
  AU: { base: 5.0, perKg: 12.8, min: 6.2, daysMin: 8, daysMax: 14, carrier: '云途专线' },
  JP: { base: 4.2, perKg: 9.5, min: 5.0, daysMin: 5, daysMax: 10, carrier: '云途专线' },
  KR: { base: 4.0, perKg: 9.0, min: 4.8, daysMin: 5, daysMax: 10, carrier: '云途专线' },
  SG: { base: 3.8, perKg: 8.5, min: 4.5, daysMin: 5, daysMax: 9, carrier: '云途专线' },
  MY: { base: 4.0, perKg: 9.0, min: 5.0, daysMin: 6, daysMax: 11, carrier: '云途专线' },
  TH: { base: 4.0, perKg: 9.2, min: 5.0, daysMin: 6, daysMax: 11, carrier: '云途专线' },
  VN: { base: 4.0, perKg: 9.2, min: 5.0, daysMin: 6, daysMax: 11, carrier: '云途专线' },
  PH: { base: 4.2, perKg: 9.8, min: 5.2, daysMin: 7, daysMax: 12, carrier: '云途专线' },
  ID: { base: 4.2, perKg: 9.8, min: 5.2, daysMin: 7, daysMax: 12, carrier: '云途专线' },
  IN: { base: 4.5, perKg: 10.5, min: 5.5, daysMin: 8, daysMax: 14, carrier: '云途专线' },
  SA: { base: 5.0, perKg: 12.0, min: 6.5, daysMin: 9, daysMax: 15, carrier: '云途专线' },
  AE: { base: 4.8, perKg: 11.5, min: 6.0, daysMin: 8, daysMax: 13, carrier: '云途专线' },
  BR: { base: 6.0, perKg: 15.0, min: 8.0, daysMin: 12, daysMax: 22, carrier: '云途专线' },
  MX: { base: 5.8, perKg: 14.5, min: 7.5, daysMin: 10, daysMax: 18, carrier: '云途专线' },
  RU: { base: 5.5, perKg: 13.0, min: 7.0, daysMin: 12, daysMax: 25, carrier: '云途专线' },
  TR: { base: 5.5, perKg: 13.5, min: 7.0, daysMin: 10, daysMax: 18, carrier: '云途专线' },
  ZA: { base: 5.8, perKg: 14.0, min: 7.5, daysMin: 12, daysMax: 20, carrier: '云途专线' },
  NZ: { base: 5.2, perKg: 13.2, min: 6.5, daysMin: 9, daysMax: 16, carrier: '云途专线' },
  CH: { base: 5.5, perKg: 14.5, min: 7.0, daysMin: 8, daysMax: 13, carrier: '云途专线' },
  SE: { base: 5.5, perKg: 14.0, min: 7.0, daysMin: 7, daysMax: 12, carrier: '云途专线' },
  NO: { base: 5.8, perKg: 14.5, min: 7.2, daysMin: 7, daysMax: 12, carrier: '云途专线' },
  PL: { base: 5.5, perKg: 14.0, min: 7.0, daysMin: 8, daysMax: 14, carrier: '云途专线' },
  HK: { base: 3.0, perKg: 6.0, min: 3.5, daysMin: 3, daysMax: 6, carrier: '云途专线' },
  TW: { base: 3.2, perKg: 6.5, min: 3.8, daysMin: 4, daysMax: 7, carrier: '云途专线' },
};

export const DEFAULT_SHIPPING = { base: 5.0, perKg: 12.8, min: 6.0, daysMin: 10, daysMax: 18, carrier: '云途专线' };

export function getShippingRates(country) {
  return INTERNATIONAL_SHIPPING[country] ?? DEFAULT_SHIPPING;
}

// 中国境内转运仓到各口岸的境内运费（元/kg，多数商家包邮故默认 0）
export const DOMESTIC_SHIPPING_CNY_PER_KG = {
  default: 0,
};
