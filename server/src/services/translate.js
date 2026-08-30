import { config } from '../config.js';

// 内置中英商品词条词典（用于关键词翻译与标题翻译的兜底）
// 海外买家输入英文关键词 -> 中文；中文标题 -> 英文展示
const DICT = {
  // 电子产品
  'wireless': '无线', 'bluetooth': '蓝牙', 'earbuds': '耳机', 'headphones': '耳机',
  'headset': '耳机', 'noise cancelling': '降噪', 'smartphone': '智能手机',
  'phone': '手机', 'case': '壳', 'charger': '充电器', 'cable': '数据线',
  'power bank': '充电宝', 'smartwatch': '智能手表', 'tablet': '平板',
  'laptop': '笔记本电脑', 'keyboard': '键盘', 'mouse': '鼠标', 'screen protector': '钢化膜',
  'speaker': '音箱', 'webcam': '摄像头', 'drone': '无人机', 'camera': '相机',
  'microphone': '麦克风', 'earphone': '耳机', 'gaming': '游戏',
  'true wireless': '真无线', 'anc': '主动降噪',
  // 服装
  't-shirt': 'T恤', 'tee': 'T恤', 'shirt': '衬衫', 'hoodie': '卫衣',
  'sweatshirt': '卫衣', 'sweater': '毛衣', 'jacket': '夹克', 'coat': '外套',
  'down jacket': '羽绒服', 'jeans': '牛仔裤', 'pants': '裤子', 'trousers': '裤子',
  'dress': '连衣裙', 'skirt': '裙子', 'sneakers': '运动鞋', 'shoes': '鞋',
  'socks': '袜子', 'cap': '帽子', 'hat': '帽子', 'scarf': '围巾',
  'underwear': '内衣', 'pajamas': '睡衣', 'leather': '皮', 'cotton': '棉',
  'linen': '亚麻', 'winter': '冬季', 'summer': '夏季', 'men': '男', 'women': '女',
  'unisex': '中性', 'kids': '儿童', 'baby': '婴儿',
  // 箱包
  'backpack': '背包', 'bag': '包', 'handbag': '手提包', 'wallet': '钱包',
  'luggage': '行李箱', 'suitcase': '行李箱', 'tote': '托特包', 'crossbody': '斜挎包',
  // 配饰
  'watch': '手表', 'jewelry': '首饰', 'necklace': '项链', 'bracelet': '手链',
  'ring': '戒指', 'earrings': '耳环', 'glasses': '眼镜', 'sunglasses': '太阳镜',
  'belt': '腰带', 'scrunchie': '发圈', 'hair clip': '发夹',
  // 美妆个护
  'lipstick': '口红', 'lip gloss': '唇釉', 'makeup': '彩妆', 'cosmetics': '化妆品',
  'foundation': '粉底', 'mascara': '睫毛膏', 'eyeliner': '眼线笔',
  'eyeshadow': '眼影', 'blush': '腮红', 'skincare': '护肤品', 'moisturizer': '面霜',
  'serum': '精华', 'toner': '爽肤水', 'cleanser': '洁面', 'sunscreen': '防晒',
  'face mask': '面膜', 'sheet mask': '面膜', 'perfume': '香水', 'shampoo': '洗发水',
  'conditioner': '护发素', 'body wash': '沐浴露', 'lotion': '身体乳', 'razor': '剃须刀',
  'nail polish': '指甲油',
  // 家居
  'lamp': '台灯', 'light': '灯', 'led': 'LED', 'curtain': '窗帘', 'pillow': '枕头',
  'blanket': '毛毯', 'towel': '毛巾', 'bedsheet': '床单', 'duvet cover': '被套',
  'mug': '马克杯', 'cup': '杯子', 'water bottle': '保温杯', 'thermos': '保温杯',
  'kitchen': '厨房', 'cookware': '厨具', 'pot': '锅', 'pan': '煎锅', 'utensils': '餐具',
  'cutlery': '餐具', 'storage box': '收纳盒', 'umbrella': '雨伞', 'candle': '蜡烛',
  'diffuser': '香薰机', 'vacuum': '吸尘器', 'robot vacuum': '扫地机器人',
  'air fryer': '空气炸锅', 'kettle': '电水壶', 'coffee maker': '咖啡机',
  // 运动户外
  'yoga': '瑜伽', 'fitness': '健身', 'gym': '健身房', 'dumbbell': '哑铃',
  'resistance band': '弹力带', 'yoga mat': '瑜伽垫', 'running': '跑步',
  'cycling': '骑行', 'bike': '自行车', 'camping': '露营', 'tent': '帐篷',
  'hiking': '徒步', 'backpacking': '背包旅行', 'fishing': '钓鱼', 'fishing rod': '鱼竿',
  // 玩具母婴
  'toy': '玩具', 'figurine': '手办', 'plush': '毛绒玩具', 'doll': '娃娃',
  'lego': '积木', 'blocks': '积木', 'remote control': '遥控', 'rc': '遥控',
  'stroller': '婴儿车', 'diaper': '纸尿裤', 'baby bottle': '奶瓶', 'milk powder': '奶粉',
  'bath toy': '洗澡玩具', 'puzzle': '拼图',
  // 宠物
  'pet': '宠物', 'dog': '狗', 'cat': '猫', 'dog leash': '狗绳', 'cat litter': '猫砂',
  'pet bed': '宠物窝', 'pet feeder': '宠物喂食器', 'grooming': '宠物美容',
  // 其他
  'led strip': '灯带', 'projector': '投影仪', 'printer': '打印机',
  'cups': '杯子', 'foldable': '折叠', 'portable': '便携', 'mini': '迷你',
  'electric': '电动', 'smart': '智能', 'waterproof': '防水', 'solar': '太阳能',
  'rechargeable': '可充电', 'adjustable': '可调节', 'stainless steel': '不锈钢',
  'silicone': '硅胶', 'wooden': '木质', 'plastic': '塑料', 'metal': '金属',
  'ceramic': '陶瓷', 'glass': '玻璃', 'leather': '皮革', 'fabric': '布料',
  'black': '黑色', 'white': '白色', 'red': '红色', 'blue': '蓝色', 'green': '绿色',
  'pink': '粉色', 'yellow': '黄色', 'purple': '紫色', 'gray': '灰色', 'grey': '灰色',
  'brown': '棕色', 'gold': '金色', 'silver': '银色', 'beige': '米色', 'cream': '奶油色',
  'dark': '深', 'light': '浅', 'large': '大号', 'medium': '中号', 'small': '小号',
  'plus': '加大', 'xl': '加大码', 'set': '套装', 'kit': '套装', 'bundle': '套装',
};

// 品牌/型号通常保持原文，这里不翻译
export function translateKeywordToChinese(query) {
  if (!query) return query;
  const lower = query.toLowerCase().trim();
  const tokens = lower.split(/[\s,，]+/).filter(Boolean);

  // 逐 token 匹配词典，同时尝试短语匹配（如 noise cancelling, true wireless）
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    // 尝试两词短语
    const two = `${tokens[i]} ${tokens[i + 1]}`;
    if (DICT[two]) {
      result.push(DICT[two]);
      i += 2;
      continue;
    }
    result.push(DICT[tokens[i]] ?? ES_DICT[tokens[i]] ?? tokens[i]);
    i += 1;
  }
  return result.join(' ');
}

// 西班牙语 -> 中文 商品词条词典（海外西语用户常用）
const ES_DICT = {
  // 电子产品
  'auriculares': '耳机', 'inalámbricos': '无线', 'inalambricos': '无线',
  'bluetooth': '蓝牙', 'audífonos': '耳机', 'audifonos': '耳机', 'cancelación': '降噪',
  'cancelacion': '降噪', 'ruido': '降噪', 'teléfono': '手机', 'telefono': '手机',
  'móvil': '手机', 'movil': '手机', 'smartphone': '智能手机', 'funda': '手机壳',
  'carcasa': '手机壳', 'cargador': '充电器', 'cable': '数据线', 'batería': '充电宝',
  'bateria': '充电宝', 'reloj': '手表', 'inteligente': '智能', 'tablet': '平板',
  'portátil': '笔记本电脑', 'portatil': '笔记本电脑', 'ordenador': '电脑',
  'teclado': '键盘', 'ratón': '鼠标', 'raton': '鼠标', 'altavoz': '音箱',
  'cámara': '相机', 'camara': '相机', 'dron': '无人机', 'micrófono': '麦克风',
  'microfono': '麦克风', 'gaming': '游戏', 'pantalla': '屏幕', 'protector': '保护膜',
  'pantalla': '钢化膜',
  // 服装
  'camiseta': 'T恤', 'camisa': '衬衫', 'sudaderas': '卫衣', 'sudadera': '卫衣',
  'buzo': '卫衣', 'suéter': '毛衣', 'sueter': '毛衣', 'jersey': '毛衣',
  'chaqueta': '夹克', 'abrigo': '外套', 'abrigos': '外套', 'plumífero': '羽绒服',
  'vaqueros': '牛仔裤', 'jeans': '牛仔裤', 'pantalones': '裤子', 'pantalón': '裤子',
  'pantalon': '裤子', 'vestido': '连衣裙', 'falda': '裙子', 'zapatillas': '运动鞋',
  'zapatos': '鞋', 'calcetines': '袜子', 'gorra': '帽子', 'sombrero': '帽子',
  'bufanda': '围巾', 'ropa': '服装', 'interior': '内衣', 'pijama': '睡衣',
  'algodón': '棉', 'algodon': '棉', 'lino': '亚麻', 'invierno': '冬季',
  'verano': '夏季', 'hombre': '男', 'mujer': '女', 'niños': '儿童', 'niños:': '儿童',
  'bebé': '婴儿', 'bebe': '婴儿', 'impermeable': '防水',
  // 箱包
  'mochila': '背包', 'bolso': '包', 'cartera': '钱包', 'maleta': '行李箱',
  'bolsos': '包', 'bandolera': '斜挎包',
  // 配饰
  'joyería': '首饰', 'joyeria': '首饰', 'collar': '项链', 'pulsera': '手链',
  'anillo': '戒指', 'aretes': '耳环', 'pendientes': '耳环', 'gafas': '眼镜',
  'lentes': '眼镜', 'sol': '太阳镜', 'cinturón': '腰带', 'cinturon': '腰带',
  'relojes': '手表', 'reloj': '手表',
  // 美妆个护
  'labial': '口红', 'pintalabios': '口红', 'maquillaje': '彩妆', 'cosméticos': '化妆品',
  'cosmeticos': '化妆品', 'base': '粉底', 'pestañas': '睫毛膏', 'delineador': '眼线笔',
  'sombra': '眼影', 'rubor': '腮红', 'cuidado': '护肤', 'piel': '护肤品',
  'crema': '面霜', 'hidratante': '面霜', 'sérum': '精华', 'serum': '精华',
  'tónico': '爽肤水', 'tonico': '爽肤水', 'limpiador': '洁面', 'protector': '防晒',
  'mascarilla': '面膜', 'perfume': '香水', 'champú': '洗发水', 'champu': '洗发水',
  'acondicionador': '护发素', 'gel': '沐浴露', 'loción': '身体乳', 'locion': '身体乳',
  'maquinilla': '剃须刀', 'afeitadora': '剃须刀', 'esmalte': '指甲油',
  // 家居
  'lámpara': '台灯', 'lampara': '台灯', 'luz': '灯', 'cortina': '窗帘',
  'almohada': '枕头', 'manta': '毛毯', 'toalla': '毛巾', 'sábana': '床单',
  'sabana': '床单', 'edredón': '被套', 'edredon': '被套', 'taza': '马克杯',
  'vaso': '杯子', 'botella': '保温杯', 'agua': '保温杯', 'termo': '保温杯',
  'cocina': '厨房', 'olla': '锅', 'sartén': '煎锅', 'sarten': '煎锅',
  'cubiertos': '餐具', 'paraguas': '雨伞', 'vela': '蜡烛', 'difusor': '香薰机',
  'aspiradora': '吸尘器', 'freidora': '空气炸锅', 'hervidor': '电水壶',
  'cafetera': '咖啡机', 'almacenamiento': '收纳盒',
  // 运动户外
  'yoga': '瑜伽', 'fitness': '健身', 'gimnasio': '健身', 'mancuernas': '哑铃',
  'banda': '弹力带', 'esterilla': '瑜伽垫', 'correr': '跑步', 'ciclismo': '骑行',
  'bicicleta': '自行车', 'bici': '自行车', 'camping': '露营', 'tienda': '帐篷',
  'senderismo': '徒步', 'pesca': '钓鱼', 'caña': '鱼竿', 'pescar': '钓鱼',
  // 玩具母婴
  'juguete': '玩具', 'figura': '手办', 'peluche': '毛绒玩具', 'muñeca': '娃娃',
  'muneca': '娃娃', 'bloques': '积木', 'control': '遥控', 'cochecito': '婴儿车',
  'pañal': '纸尿裤', 'panal': '纸尿裤', 'biberón': '奶瓶', 'biberon': '奶瓶',
  'polvo': '奶粉', 'leche': '奶粉', 'rompecabezas': '拼图',
  // 宠物
  'mascota': '宠物', 'perro': '狗', 'gato': '猫', 'correa': '狗绳', 'arena': '猫砂',
  'cama': '宠物窝', 'alimentador': '宠物喂食器', 'mascotas': '宠物',
  // 其他
  'proyector': '投影仪', 'impresora': '打印机', 'plegable': '折叠', 'portátil': '便携',
  'portatil': '便携', 'mini': '迷你', 'eléctrico': '电动', 'electrico': '电动',
  'solar': '太阳能', 'recargable': '可充电', 'ajustable': '可调节', 'inoxidable': '不锈钢',
  'silicona': '硅胶', 'madera': '木质', 'plástico': '塑料', 'plastico': '塑料',
  'metal': '金属', 'cerámica': '陶瓷', 'ceramica': '陶瓷', 'vidrio': '玻璃',
  'cuero': '皮革', 'tela': '布料', 'negro': '黑色', 'blanco': '白色',   'rojo': '红色',
  'azul': '蓝色', 'verde': '绿色', 'rosa': '粉色', 'amarillo': '黄色', 'morado': '紫色',
  'gris': '灰色', 'marrón': '棕色', 'marron': '棕色', 'dorado': '金色',
  'plateado': '银色', 'beige': '米色', 'oscuro': '深', 'claro': '浅', 'grande': '大号',
  'mediano': '中号', 'pequeño': '小号', 'pequeno': '小号', 'conjunto': '套装',
  'juego': '套装', 'multiusos': '多用途', 'original': '正品', 'calidad': '品质',
  'deportivas': '运动', 'deportivo': '运动', 'running': '跑步', 'puma': '彪马',
  'correa': '表带', 'doble': '双', 'rápido': '快充', 'rapido': '快充',
  'inalámbrico': '无线', 'inalambrico': '无线', 'magnético': '磁吸', 'magnetico': '磁吸',
  'cargador': '充电器', 'portátiles': '笔记本', 'tabletas': '平板', 'pantalla': '屏幕',
};

// 中文标题 -> 英文展示（兜底：未命中词条保留中文）
const ZH_TO_EN = {
  '无线': 'Wireless', '蓝牙': 'Bluetooth', '耳机': 'Earbuds', '降噪': 'Noise Cancelling',
  '智能': 'Smart', '手机': 'Phone', '壳': 'Case', '充电器': 'Charger', '数据线': 'Cable',
  '充电宝': 'Power Bank', '手表': 'Watch', '平板': 'Tablet', '笔记本电脑': 'Laptop',
  '笔记本': 'Laptop', '键盘': 'Keyboard', '鼠标': 'Mouse', '音箱': 'Speaker',
  '摄像头': 'Webcam', '无人机': 'Drone', '相机': 'Camera', '麦克风': 'Microphone',
  'T恤': 'T-Shirt', '卫衣': 'Hoodie', '毛衣': 'Sweater', '夹克': 'Jacket', '外套': 'Coat',
  '羽绒服': 'Down Jacket', '牛仔裤': 'Jeans', '裤子': 'Pants', '连衣裙': 'Dress',
  '裙子': 'Skirt', '运动鞋': 'Sneakers', '鞋': 'Shoes', '袜子': 'Socks', '帽子': 'Cap',
  '围巾': 'Scarf', '背包': 'Backpack', '包': 'Bag', '钱包': 'Wallet', '行李箱': 'Luggage',
  '项链': 'Necklace', '手链': 'Bracelet', '戒指': 'Ring', '耳环': 'Earrings',
  '眼镜': 'Glasses', '太阳镜': 'Sunglasses', '口红': 'Lipstick', '彩妆': 'Makeup',
  '化妆品': 'Cosmetics', '粉底': 'Foundation', '睫毛膏': 'Mascara', '眼影': 'Eyeshadow',
  '护肤品': 'Skincare', '面霜': 'Moisturizer', '精华': 'Serum', '爽肤水': 'Toner',
  '洁面': 'Cleanser', '防晒': 'Sunscreen', '面膜': 'Face Mask', '香水': 'Perfume',
  '洗发水': 'Shampoo', '护发素': 'Conditioner', '沐浴露': 'Body Wash', '剃须刀': 'Razor',
  '台灯': 'Lamp', '灯': 'Light', '窗帘': 'Curtain', '枕头': 'Pillow', '毛毯': 'Blanket',
  '毛巾': 'Towel', '床单': 'Bedsheet', '被套': 'Duvet Cover', '马克杯': 'Mug',
  '杯子': 'Cup', '保温杯': 'Water Bottle', '厨具': 'Cookware', '锅': 'Pot', '餐具': 'Utensils',
  '雨伞': 'Umbrella', '蜡烛': 'Candle', '吸尘器': 'Vacuum', '空气炸锅': 'Air Fryer',
  '电水壶': 'Kettle', '咖啡机': 'Coffee Maker', '瑜伽': 'Yoga', '健身': 'Fitness',
  '哑铃': 'Dumbbell', '瑜伽垫': 'Yoga Mat', '跑步': 'Running', '骑行': 'Cycling',
  '自行车': 'Bike', '露营': 'Camping', '帐篷': 'Tent', '徒步': 'Hiking', '钓鱼': 'Fishing',
  '鱼竿': 'Fishing Rod', '玩具': 'Toy', '手办': 'Figurine', '毛绒玩具': 'Plush Toy',
  '积木': 'Blocks', '遥控': 'Remote Control', '婴儿车': 'Stroller', '纸尿裤': 'Diaper',
  '奶瓶': 'Baby Bottle', '奶粉': 'Milk Powder', '拼图': 'Puzzle', '宠物': 'Pet',
  '狗': 'Dog', '猫': 'Cat', '狗绳': 'Dog Leash', '猫砂': 'Cat Litter', '宠物窝': 'Pet Bed',
  '投影仪': 'Projector', '打印机': 'Printer', '折叠': 'Foldable', '便携': 'Portable',
  '迷你': 'Mini', '电动': 'Electric', '防水': 'Waterproof', '太阳能': 'Solar',
  '可充电': 'Rechargeable', '可调节': 'Adjustable', '不锈钢': 'Stainless Steel',
  '硅胶': 'Silicone', '木质': 'Wooden', '塑料': 'Plastic', '金属': 'Metal',
  '陶瓷': 'Ceramic', '玻璃': 'Glass', '皮革': 'Leather', '黑色': 'Black',
  '白色': 'White', '红色': 'Red', '蓝色': 'Blue', '绿色': 'Green', '粉色': 'Pink',
  '黄色': 'Yellow', '紫色': 'Purple', '灰色': 'Gray', '棕色': 'Brown', '金色': 'Gold',
  '银色': 'Silver', '米色': 'Beige', '深': 'Dark', '浅': 'Light', '大号': 'Large',
  '中号': 'Medium', '小号': 'Small', '加大码': 'XL', '套装': 'Set',
};

export function translateTitleToEnglish(title) {
  if (!title) return title;
  // 如果标题中没有中文字符，直接返回（可能本身就是英文）
  if (!/[\u4e00-\u9fa5]/.test(title)) return title;
  return title.replace(/[\u4e00-\u9fa5A-Za-z0-9]+/g, (word) => {
    if (/^[A-Za-z0-9]+$/.test(word)) return word;
    return ZH_TO_EN[word] ?? word;
  });
}

// 检测输入是否主要为英文（用于决定是否需要翻译成中文）
export function isMostlyAscii(text) {
  if (!text) return false;
  const ascii = (text.match(/[a-zA-Z]/g) || []).length;
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  return ascii > cjk;
}

// 平台适配器密钥检测辅助：是否已配置某平台
export function isPlatformConfigured(name) {
  const p = config.platforms[name];
  if (!p) return false;
  return Object.values(p).some((v) => typeof v === 'string' && v.length > 0);
}
