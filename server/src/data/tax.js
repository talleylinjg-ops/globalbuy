// 目的国进口税则表（简化版，用于估算）
// deMinimis: 免征关税的货值门槛（单位：当地货币）
// vatThreshold: 免征增值税的货值门槛（单位：当地货币）。欧盟自 2021 年起 VAT 无小额免征，故为 0
// vatRate: 标准增值税率
// importDutyRate: 该品类一般性关税税率（用于无品类映射时的兜底）

export const TAX_RULES = {
  US: {
    name: '美国',
    currency: 'USD',
    deMinimis: 0,         // 2025-08-29 起 $800 小额豁免正式取消
    vatThreshold: 0,      // 美国无联邦增值税
    vatRate: 0,
    importDutyRate: 0.025,
    note: '2025-08-29 起 $800 小额包裹豁免取消，大多数进口包裹需缴纳关税；仅低于 $100 的个人文件及礼品可能免税', noteEn: 'Since Aug 29, 2025, the $800 de minimis exemption has been removed; most imports are subject to duty; only personal documents & gifts under $100 may be duty-free',
  },
  GB: {
    name: '英国',
    currency: 'GBP',
    deMinimis: 135,       // 低于 £135 免关税
    vatThreshold: 0,      // 但 VAT 自 2021 年起对小包全面征收
    vatRate: 0.20,
    importDutyRate: 0.03,
    note: '申报价值 ≤£135 免关税，需缴纳 20% VAT；皮革鞋类等除外', noteEn: 'Declared value ≤£135 is duty-free but subject to 20% VAT; leather & footwear excluded',
  },
  DE: {
    name: '德国',
    currency: 'EUR',
    deMinimis: 150,
    vatThreshold: 0,
    vatRate: 0.19,
    importDutyRate: 0.03,
    note: '低于 €150 免关税，需缴纳 19% VAT；计划 2028 年 3 月起取消 €150 豁免', noteEn: 'Under €150 is duty-free but subject to 19% VAT; the €150 exemption is planned to end in March 2028',
  },
  FR: {
    name: '法国',
    currency: 'EUR',
    deMinimis: 150,
    vatThreshold: 0,
    vatRate: 0.20,
    importDutyRate: 0.03,
    note: '需缴纳 20% VAT；计划 2028 年 3 月起取消 €150 关税豁免', noteEn: 'Subject to 20% VAT; the €150 duty exemption is planned to end in March 2028',
  },
  NL: {
    name: '荷兰',
    currency: 'EUR',
    deMinimis: 150,
    vatThreshold: 0,
    vatRate: 0.21,
    importDutyRate: 0.03,
    note: '需缴纳 21% VAT；计划 2028 年 3 月起取消 €150 关税豁免', noteEn: 'Subject to 21% VAT; the €150 duty exemption is planned to end in March 2028',
  },
  IT: {
    name: '意大利',
    currency: 'EUR',
    deMinimis: 150,
    vatThreshold: 0,
    vatRate: 0.22,
    importDutyRate: 0.03,
    note: '需缴纳 22% VAT；计划 2028 年 3 月起取消 €150 关税豁免', noteEn: 'Subject to 22% VAT; the €150 duty exemption is planned to end in March 2028',
  },
  ES: {
    name: '西班牙',
    currency: 'EUR',
    deMinimis: 150,
    vatThreshold: 0,
    vatRate: 0.21,
    importDutyRate: 0.03,
    note: '需缴纳 21% VAT；计划 2028 年 3 月起取消 €150 关税豁免', noteEn: 'Subject to 21% VAT; the €150 duty exemption is planned to end in March 2028',
  },
  CA: {
    name: '加拿大',
    currency: 'CAD',
    deMinimis: 20,        // 低于 20 加元免关税
    vatThreshold: 40,     // 低于 40 加元免 GST
    vatRate: 0.05,
    importDutyRate: 0.03,
    note: '20 加元以下免税，以上按品类征收 GST + 关税', noteEn: 'Duty-free under CAD 20; above that, GST + category duty apply',
  },
  AU: {
    name: '澳大利亚',
    currency: 'AUD',
    deMinimis: 1000,
    vatThreshold: 1000,
    vatRate: 0.10,
    importDutyRate: 0.03,
  },
  JP: {
    name: '日本',
    currency: 'JPY',
    deMinimis: 10000,     // 低于 1 万日元免税
    vatThreshold: 10000,
    vatRate: 0.10,
    importDutyRate: 0.03,
    note: '申报价值 ≤10,000 日元免税；皮革制品、鞋类等特定商品除外', noteEn: 'Declared value ≤¥10,000 is duty-free; leather goods & footwear excluded',
  },
  KR: {
    name: '韩国',
    currency: 'KRW',
    deMinimis: 150000,    // 低于 15 万韩元免税（关税+增值税）
    vatThreshold: 150000,
    vatRate: 0.10,
    importDutyRate: 0.03,
  },
  SG: {
    name: '新加坡',
    currency: 'SGD',
    deMinimis: 400,
    vatThreshold: 400,
    vatRate: 0.09,
    importDutyRate: 0.0,
  },
  MY: {
    name: '马来西亚',
    currency: 'MYR',
    deMinimis: 500,
    vatThreshold: 500,
    vatRate: 0.10,
    importDutyRate: 0.03,
  },
  TH: {
    name: '泰国',
    currency: 'THB',
    deMinimis: 1500,
    vatThreshold: 1500,
    vatRate: 0.07,
    importDutyRate: 0.03,
  },
  VN: {
    name: '越南',
    currency: 'VND',
    deMinimis: 1000000,
    vatThreshold: 1000000,
    vatRate: 0.10,
    importDutyRate: 0.03,
  },
  PH: {
    name: '菲律宾',
    currency: 'PHP',
    deMinimis: 10000,
    vatThreshold: 10000,
    vatRate: 0.12,
    importDutyRate: 0.03,
  },
  ID: {
    name: '印度尼西亚',
    currency: 'IDR',
    deMinimis: 500000,
    vatThreshold: 500000,
    vatRate: 0.11,
    importDutyRate: 0.03,
  },
  IN: {
    name: '印度',
    currency: 'INR',
    deMinimis: 0,         // 无免税
    vatThreshold: 0,
    vatRate: 0.18,
    importDutyRate: 0.10,
  },
  SA: {
    name: '沙特阿拉伯',
    currency: 'SAR',
    deMinimis: 1000,
    vatThreshold: 1000,
    vatRate: 0.15,
    importDutyRate: 0.03,
  },
  AE: {
    name: '阿联酋',
    currency: 'AED',
    deMinimis: 300,
    vatThreshold: 300,
    vatRate: 0.05,
    importDutyRate: 0.03,
  },
  BR: {
    name: '巴西',
    currency: 'BRL',
    deMinimis: 50,
    vatThreshold: 50,
    vatRate: 0.17,
    importDutyRate: 0.15,
    note: '50 美元以下免税，以上征收较高关税 + 州税', noteEn: 'Duty-free under USD 50; above that, higher duties + state taxes apply',
  },
  MX: {
    name: '墨西哥',
    currency: 'MXN',
    deMinimis: 50,
    vatThreshold: 50,
    vatRate: 0.16,
    importDutyRate: 0.10,
  },
  RU: {
    name: '俄罗斯',
    currency: 'RUB',
    deMinimis: 200,
    vatThreshold: 200,
    vatRate: 0.20,
    importDutyRate: 0.10,
    note: '计划 2027 年起逐步取消 200 欧元以下包裹免税', noteEn: 'The duty exemption for parcels under €200 is planned to phase out from 2027',
  },
  TR: {
    name: '土耳其',
    currency: 'TRY',
    deMinimis: 30,
    vatThreshold: 30,
    vatRate: 0.20,
    importDutyRate: 0.10,
  },
  ZA: {
    name: '南非',
    currency: 'ZAR',
    deMinimis: 500,
    vatThreshold: 500,
    vatRate: 0.15,
    importDutyRate: 0.05,
  },
  NZ: {
    name: '新西兰',
    currency: 'NZD',
    deMinimis: 1000,
    vatThreshold: 1000,
    vatRate: 0.15,
    importDutyRate: 0.03,
  },
  CH: {
    name: '瑞士',
    currency: 'CHF',
    deMinimis: 65,        // CHF 65（部分渠道 300）
    vatThreshold: 65,
    vatRate: 0.081,
    importDutyRate: 0.03,
  },
  SE: {
    name: '瑞典',
    currency: 'SEK',
    deMinimis: 0,
    vatThreshold: 0,
    vatRate: 0.25,
    importDutyRate: 0.03,
  },
  NO: {
    name: '挪威',
    currency: 'NOK',
    deMinimis: 0,
    vatThreshold: 0,
    vatRate: 0.25,
    importDutyRate: 0.03,
  },
  PL: {
    name: '波兰',
    currency: 'PLN',
    deMinimis: 150,
    vatThreshold: 0,
    vatRate: 0.23,
    importDutyRate: 0.03,
  },
  HK: {
    name: '中国香港',
    currency: 'HKD',
    deMinimis: Infinity,
    vatThreshold: Infinity,
    vatRate: 0,
    importDutyRate: 0.0,
    note: '香港一般无进口增值税，仅部分品类有关税', noteEn: 'Hong Kong generally has no import VAT; only a few categories carry duty',
  },
  TW: {
    name: '中国台湾',
    currency: 'TWD',
    deMinimis: 2000,
    vatThreshold: 2000,
    vatRate: 0.05,
    importDutyRate: 0.03,
  },
};

// 品类到默认关税税率的映射（简化，供无官方税则时估算）
export const CATEGORY_DUTY_RATE = {
  '手机壳': 0.03,
  '手机配件': 0.03,
  '数码产品': 0.03,
  '电子产品': 0.03,
  '蓝牙耳机': 0.03,
  '耳机': 0.03,
  '智能手表': 0.03,
  '平板电脑': 0.0,
  '笔记本电脑': 0.0,
  '电脑配件': 0.03,
  'T恤': 0.12,
  '卫衣': 0.12,
  '毛衣': 0.12,
  '外套': 0.12,
  '夹克': 0.12,
  '羽绒服': 0.12,
  '牛仔裤': 0.12,
  '裤子': 0.12,
  '裙子': 0.12,
  '运动鞋': 0.12,
  '皮鞋': 0.12,
  '拖鞋': 0.12,
  '袜子': 0.12,
  '帽子': 0.12,
  '围巾': 0.12,
  '包': 0.12,
  '背包': 0.12,
  '行李箱': 0.12,
  '手表': 0.05,
  '首饰': 0.08,
  '眼镜': 0.05,
  '化妆品': 0.10,
  '护肤品': 0.10,
  '口红': 0.10,
  '面膜': 0.10,
  '香水': 0.10,
  '洗护用品': 0.10,
  '玩具': 0.05,
  '模型': 0.05,
  '手办': 0.05,
  '灯具': 0.08,
  '家居': 0.05,
  '厨具': 0.05,
  '杯子': 0.05,
  '保温杯': 0.05,
  '餐具': 0.05,
  '床上用品': 0.05,
  '毛巾': 0.05,
  '雨伞': 0.08,
  '汽车配件': 0.05,
  '工具': 0.05,
  '健身器材': 0.05,
  '户外': 0.05,
  '宠物用品': 0.05,
  '食品': 0.15,
  '零食': 0.15,
  '茶叶': 0.15,
  '保健品': 0.05,
  '书籍': 0.0,
  '乐器': 0.05,
  '运动器材': 0.05,
  '母婴': 0.05,
  '奶粉': 0.05,
  '纸尿裤': 0.05,
  '家电': 0.08,
  '小家电': 0.08,
  '电吹风': 0.08,
  '美容仪': 0.08,
  '摄影器材': 0.05,
  '无人机': 0.05,
  '默认': 0.03,
};

export function getTaxRule(country) {
  return TAX_RULES[country] ?? TAX_RULES.US;
}

export function getCategoryDutyRate(category) {
  return CATEGORY_DUTY_RATE[category] ?? CATEGORY_DUTY_RATE['默认'];
}

// ===== 全球国家注册表：重点市场置顶，其余按洲际排列 =====
// 格式 "ISO2:货币"，重点市场即已配置税则的 32 国（TAX_RULES）
const RAW_GROUPS = [
  ['asia', 'JP:JPY KR:KRW SG:SGD MY:MYR TH:THB VN:VND PH:PHP ID:IDR IN:INR PK:PKR BD:BDT LK:LKR NP:NPR MM:MMK KH:KHR LA:LAK MN:MNT KZ:KZT UZ:UZS KG:KGS TJ:TJS TM:TMT AZ:AZN AM:AMD GE:GEL MV:MVR BN:BND MO:MOP IL:ILS JO:JOD LB:LBP OM:OMR QA:QAR KW:KWD BH:BHD IQ:IQD IR:IRR SY:SYP YE:YER AF:AFN TR:TRY'],
  ['europe', 'BE:EUR LU:EUR PT:EUR AT:EUR IE:EUR FI:EUR GR:EUR SI:EUR SK:EUR LT:EUR LV:EUR EE:EUR CY:EUR MT:EUR HR:EUR ME:EUR CZ:CZK HU:HUF RO:RON BG:BGN DK:DKK IS:ISK UA:UAH BY:BYN MD:MDL RS:RSD BA:BAM MK:MKD AL:ALL XK:EUR'],
  ['north-america', 'GT:GTQ BZ:BZD SV:USD HN:HNL NI:NIO CR:CRC PA:PAB CU:CUP JM:JMD HT:HTG DO:DOP TT:TTD BB:BBD BS:BSD AG:XCD DM:XCD GD:XCD LC:XCD VC:XCD KN:XCD BM:BMD KY:KYD PR:USD VI:USD GL:DKK'],
  ['south-america', 'AR:ARS CL:CLP CO:COP PE:PEN UY:UYU PY:PYG BO:BOB EC:USD VE:VES GY:GYD SR:SRD'],
  ['oceania', 'FJ:FJD PG:PGK SB:SBD VU:VUV WS:WST TO:TOP TV:AUD KI:AUD NR:AUD PW:USD MH:USD FM:USD MP:USD NC:XPF PF:XPF'],
  ['africa', 'EG:EGP NG:NGN KE:KES GH:GHS MA:MAD DZ:DZD TN:TND LY:LYD ET:ETB TZ:TZS UG:UGX RW:RWF ZM:ZMW ZW:USD BW:BWP NA:NAD MZ:MZN AO:AOA CD:CDF CG:XAF CM:XAF CI:XOF SN:XOF ML:XOF BF:XOF NE:XOF TG:XOF BJ:XOF GN:GNF SL:SLE LR:LRD GM:GMD GW:XOF CV:CVE MR:MRU TD:XAF CF:XAF GQ:XAF GA:XAF ST:STN MG:MGA MU:MUR SC:SCR KM:KMF DJ:DJF SO:SOS SS:SSP SD:SDG MW:MWK LS:LSL SZ:SZL BI:BIF ER:ERN'],
];

export const CONTINENT_GROUPS = [
  { key: 'priority', codes: Object.keys(TAX_RULES) },
  ...RAW_GROUPS.map(([continent, str]) => ({
    key: continent,
    codes: str.split(' ').map((pair) => pair.split(':')[0]),
  })),
];

// ISO2 → { continent, currency } 全量查询表（重点市场复用 TAX_RULES 的币种）
export const GLOBAL_COUNTRIES = Object.fromEntries(
  CONTINENT_GROUPS.flatMap((g) => g.codes.map((code) => [code, {
    continent: g.key,
    currency: g.key === 'priority' ? TAX_RULES[code].currency : Object.fromEntries(RAW_GROUPS.find(([k]) => k === g.key)[1].split(' ').map((p) => p.split(':')))[code],
  }]))
);

// 全球去重货币清单（重点市场货币在前）
export const GLOBAL_CURRENCIES = [...new Set([
  ...Object.keys(TAX_RULES).map((c) => TAX_RULES[c].currency),
  ...Object.values(GLOBAL_COUNTRIES).map((c) => c.currency),
])];
