import { inferCategory, estimateWeightGrams } from '../data/weights.js';
import { getCategoryDutyRate } from '../data/tax.js';

// 提取数字+单位的规格（如 500ml, 1kg, 128GB）
function extractSpecs(title) {
  const specs = [];
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(ml|ml|cl|l|litre|liter|kg|g|gb|tb|mah|w|wh|cm|mm|inch|寸|对|个|条|片|张)/gi,
    /(\d+(?:\.\d+)?)[x×*](\d+(?:\.\d+)?)(?:[x×*](\d+(?:\.\d+)?))?/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(title)) !== null) {
      specs.push(m[0].toLowerCase());
    }
  }
  return specs;
}

// 从标题提取品牌（常见品牌表）
const BRANDS = [
  'xiaomi', 'mi', 'huawei', 'honor', 'oppo', 'vivo', 'realme', 'oneplus',
  'apple', 'iphone', 'samsung', 'sony', 'lg', 'anker', 'awei', 'baseus',
  'u green', 'ugreen', 'belkin', 'jbl', 'edifier', 'soundcore', 'marvel',
  'disney', 'nike', 'adidas', 'puma', 'new balance', 'converse', 'vans',
  'zara', 'h&m', 'uniqlo', 'shein', 'anker', 'romic', 'roma', 'yobola',
  'haylou', 'tozo', 'soundpeats', 'lenovo', 'dell', 'hp', 'acer', 'asus',
  'microsoft', 'roborock', 'dreame', 'ecovacs', 'tineco', 'mijia',
];

function extractBrand(title) {
  const lower = title.toLowerCase();
  for (const brand of BRANDS) {
    if (lower.includes(brand)) return brand.toUpperCase();
  }
  return null;
}

// 单位归一化：将各种写法统一（500ml / 500毫升 / 0.5L）
export function normalizeUnit(spec) {
  if (!spec) return null;
  let s = String(spec).toLowerCase().trim();
  s = s.replace(/毫升/g, 'ml').replace(/升/g, 'l');
  s = s.replace(/克/g, 'g').replace(/千克/g, 'kg').replace(/公斤/g, 'kg');
  s = s.replace(/个/g, 'pc').replace(/件/g, 'pc').replace(/条/g, 'pcs').replace(/片/g, 'pcs');
  // 0.5l -> 500ml 形式
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(ml|l|g|kg|gb|tb|mah|w)$/);
  if (m) {
    const num = parseFloat(m[1]);
    const unit = m[2];
    if (unit === 'l') return `${num * 1000}ml`;
    if (unit === 'kg') return `${num * 1000}g`;
  }
  return s;
}

// 商品归一化：标准化字段、推断类目、提取品牌规格、估算重量与默认关税
export function normalizeProduct(raw) {
  const title = (raw.title || '').trim();
  const specs = extractSpecs(title);
  const category = inferCategory([title, raw.category, raw.keywords]);
  const brand = raw.brand || extractBrand(title);
  const weightGrams = raw.weightGrams || estimateWeightGrams(category);

  return {
    ...raw,
    title,
    category,
    brand,
    specs,
    weightGrams,
    dutyRate: getCategoryDutyRate(category),
    // 平台名归一化
    platform: normalizePlatform(raw.platform),
    // 销售指标兜底
    sales: raw.sales ?? raw.monthSales ?? 0,
    rating: raw.rating ?? raw.goodRate ?? 0,
    reviews: raw.reviews ?? 0,
    shopName: raw.shopName || raw.shop || '综合店铺',
    shopType: raw.shopType || '普通',
    // 是否现货
    inStock: raw.inStock !== false,
  };
}

export function normalizePlatform(platform) {
  const map = {
    taobao: '淘宝',
    tmall: '天猫',
    tb: '淘宝',
    tm: '天猫',
    jd: '京东',
    jdcom: '京东',
    pdd: '拼多多',
    pinduoduo: '拼多多',
    '1688': '1688',
    ali1688: '1688',
  };
  return map[String(platform).toLowerCase()] ?? String(platform);
}

// 文本相似度（简易 Jaccard）
function jaccard(a, b) {
  const setA = new Set(a.toLowerCase().split(/[\s\-,./]+/).filter((x) => x.length > 1));
  const setB = new Set(b.toLowerCase().split(/[\s\-,./]+/).filter((x) => x.length > 1));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter += 1;
  return inter / (setA.size + setB.size - inter);
}

// 归一化去重：基于品牌+规格+标题相似度，返回去重后的商品列表
// 同一款商品在多个平台出现时合并为一个分组（group），保留各平台报价
export function groupAndDedupe(products) {
  const groups = [];
  const THRESHOLD = 0.55;

  for (const p of products) {
    let matched = null;
    let bestScore = 0;
    for (const g of groups) {
      const ref = g.reference;
      // 品牌不同不匹配（如果两者都有品牌）
      if (ref.brand && p.brand && ref.brand !== p.brand) continue;
      // 规格交集判断
      const specIntersect = ref.specs.some((s) => p.specs.includes(s));
      const score = jaccard(ref.title, p.title) + (specIntersect ? 0.2 : 0);
      if (score > bestScore) {
        bestScore = score;
        matched = g;
      }
    }
    if (matched && bestScore >= THRESHOLD) {
      matched.items.push(p);
    } else {
      groups.push({ reference: p, items: [p] });
    }
  }

  // 每组生成组级对象
  return groups.map((g) => {
    const ref = g.reference;
    return {
      groupId: `g_${Math.random().toString(36).slice(2, 10)}`,
      title: ref.title,
      brand: ref.brand,
      category: ref.category,
      specs: ref.specs,
      weightGrams: ref.weightGrams,
      dutyRate: ref.dutyRate,
      imageUrl: ref.imageUrl,
      options: g.items,
    };
  });
}
