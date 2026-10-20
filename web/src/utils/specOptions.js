// 商品规格属性组（类目驱动）
// 拼多多 CPS 渠道无 SKU 数据，按商品标题推断常见属性组供买家点选，
// 选中值与自由备注合并为 skuName 随订单提交（客服按此配货）
export const SPEC_GROUPS = [
  {
    key: 'color',
    match: /壳|衣|裤|鞋|包|车|机|膜|带|罩|垫|镜/,
    label: { zh: '颜色', en: 'Color', es: 'Color' },
    values: [
      { zh: '黑色', en: 'Black', es: 'Negro', hex: '#1f2937' },
      { zh: '白色', en: 'White', es: 'Blanco', hex: '#f3f4f6' },
      { zh: '红色', en: 'Red', es: 'Rojo', hex: '#d64545' },
      { zh: '蓝色', en: 'Blue', es: 'Azul', hex: '#3b6fd4' },
      { zh: '粉色', en: 'Pink', es: 'Rosa', hex: '#e58fb5' },
      { zh: '绿色', en: 'Green', es: 'Verde', hex: '#3f9d63' },
      { zh: '紫色', en: 'Purple', es: 'Morado', hex: '#7d4fc9' },
      { zh: '金色', en: 'Gold', es: 'Dorado', hex: '#c9a227' },
      { zh: '银色', en: 'Silver', es: 'Plateado', hex: '#b8b8b8' },
      { zh: '透明', en: 'Clear', es: 'Transparente', hex: 'transparent' },
    ],
  },
  {
    key: 'model',
    match: /手机壳|手机膜|手机|iPhone|苹果/i,
    label: { zh: '适配机型', en: 'Model', es: 'Modelo' },
    values: ['iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone 14', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 16', 'iPhone 16 Pro', 'iPhone 16 Pro Max'],
  },
  {
    key: 'size',
    match: /T恤|恤|衬衫|连衣裙|卫衣|裤|裙|外套|夹克|大衣|鞋|袜/,
    label: { zh: '尺码', en: 'Size', es: 'Talla' },
    values: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
  },
  {
    key: 'range',
    match: /电动车|滑板车|电瓶车|平衡车|代步/,
    label: { zh: '航程', en: 'Range', es: 'Autonomía' },
    values: ['25km', '35km', '45km', '60km', '80km', '100km'],
  },
  {
    key: 'capacity',
    match: /杯|壶|保温|瓶/,
    label: { zh: '容量', en: 'Capacity', es: 'Capacidad' },
    values: ['350ml', '500ml', '750ml', '1L', '1.5L'],
  },
];

// 根据商品标题匹配适用的属性组
export function matchSpecGroups(title) {
  const t = String(title || '');
  return SPEC_GROUPS.filter((g) => g.match.test(t));
}

export function specGroupLabel(group, lang) {
  return group.label[lang] || group.label.en;
}

export function specValueLabel(value, lang) {
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.zh;
}
