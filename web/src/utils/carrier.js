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
