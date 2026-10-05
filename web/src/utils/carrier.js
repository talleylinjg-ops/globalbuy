// 国际渠道显示名统一映射：兼容渠道 code 与中文别名，按界面语言输出
const CARRIER_PATTERNS = [
  ['4px', /4PX|递四方/i],
  ['huayuan', /华源/],
  ['sfintl', /顺丰国际|顺丰/],
  ['sf', /顺丰/],
];

export function carrierCodeOf(name) {
  const s = String(name || '');
  if (!s) return null;
  for (const [code, re] of CARRIER_PATTERNS) {
    if (re.test(s)) return code;
  }
  return null;
}

// 渠道产品名映射：华源等渠道返回人工维护的中文名，按界面语言输出英文
const PRODUCT_NAME_EN = {
  'FED-5DAY-空派DDP小货': 'FED-5DAY Air DDP Small Parcel',
  'FEDEX美国空快-包裹（包税）': 'FEDEX US Air Express (Tax Included)',
  'HKUPS蓝单南美6000（UPL22）': 'HKUPS Blue Line South America 6000 (UPL22)',
  'USXB-V06美国FEDEX专线小包（不接手表）': 'USXB-V06 US FEDEX Line Small Parcel (No Watches)',
};

// 产品名显示：已知映射 → 英文；未知中文名降级为保留 ASCII 码部分（如 INT0014/S5110）
export function productNameDisplay(name) {
  const s = String(name || '');
  if (!s) return '';
  if (PRODUCT_NAME_EN[s]) return PRODUCT_NAME_EN[s];
  if (/[\u4e00-\u9fff]/.test(s)) {
    const ascii = s.replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
    return ascii || s;
  }
  return s;
}

export function carrierDisplayName(name, t) {
  if (!name) return name || '';
  const directKey = `carrierName.${name}`;
  const direct = t(directKey);
  if (direct !== directKey) return direct;
  const code = carrierCodeOf(name);
  if (code) {
    const key = `carrierName.${code}`;
    const v = t(key);
    if (v !== key) return v;
  }
  return name;
}
