// SEO/GEO 动态注入：标题、meta 描述、canonical、OpenGraph、JSON-LD 结构化数据
// GEO（生成式引擎优化）：向 AI 爬虫输出结构化、语义清晰的商品与业务数据
const SITE = 'https://globalbuy.pages.dev';

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertJsonLd(id, obj) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(obj);
}

// 搜索结果页动态化（Google/AI 引擎抓取 SPA 渲染后的 DOM）
export function applySearchSeo({ keyword, translated, total, topProducts }) {
  const label = translated || keyword || '';
  document.title = label
    ? `${label} - 中国电商比价 | CrossBuy 全球购`
    : 'CrossBuy 全球购 - 淘宝京东拼多多1688 一站比价代购 | Buy More Save More';

  const desc = label
    ? `在 CrossBuy 一键比价「${label}」：聚合淘宝、京东、拼多多、1688 共 ${total || 0} 件商品，实时计算含国际运费、关税、增值税的到手总价，直邮全球。`
    : document.querySelector('meta[name="description"]')?.content || '';

  upsertMeta('name', 'description', desc);
  upsertMeta('property', 'og:title', document.title);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:url', `${SITE}/?q=${encodeURIComponent(keyword || '')}`);

  // ItemList：向生成式引擎输出可引用的商品清单
  if (topProducts && topProducts.length) {
    upsertJsonLd('cb-jsonld-itemlist', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${label} 比价结果`,
      numberOfItems: topProducts.length,
      itemListElement: topProducts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: p.title,
          image: p.imageUrl || undefined,
          offers: {
            '@type': 'Offer',
            price: p.price,
            priceCurrency: 'CNY',
            availability: 'https://schema.org/InStock',
          },
        },
      })),
    });
  }
}

// 面包屑（全站恒定，GEO 站点结构信号）
export function applyBreadcrumbSeo() {
  upsertJsonLd('cb-jsonld-breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: SITE },
      { '@type': 'ListItem', position: 2, name: '商品比价', item: `${SITE}/?q=` },
    ],
  });
}

// 服务可视化：把业务流程转成 HowTo 结构化数据（生成式引擎高频引用格式）
export function applyHowToSeo() {
  upsertJsonLd('cb-jsonld-howto', {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: '如何在 CrossBuy 购买中国商品并直邮海外',
    totalTime: 'PT5M',
    step: [
      { '@type': 'HowToStep', position: 1, name: '搜索比价', text: '输入中文或英文关键词，一次搜索淘宝、京东、拼多多、1688 同款商品' },
      { '@type': 'HowToStep', position: 2, name: '查看到手价', text: '系统自动计算国际运费、关税、增值税、服务费，展示透明到手总价' },
      { '@type': 'HowToStep', position: 3, name: '确认下单', text: '选择国际快递渠道与服务费，填写收货地址，多件商品可合并包裹' },
      { '@type': 'HowToStep', position: 4, name: '等待收货', text: '包裹从中国直邮到家，全程可查物流时效' },
    ],
  });
}
