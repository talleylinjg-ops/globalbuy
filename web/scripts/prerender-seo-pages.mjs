// 预渲染 SEO 落地页：从 demo 快照生成与原站（en 界面搜索结果页）完全一致的静态页面
// 运行时机：vite build 之后（需要 dist/assets 的 CSS 哈希文件名）
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickShippingTiers } from '../src/utils/shipping.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const PUBLIC = join(ROOT, 'public');
const SITE = 'https://globalbuy.pages.dev';

const CARRIER_EN = { '顺丰国际': 'SF International', '华源': 'Huayuan', '4PX 递四方': '4PX', '4PX': '4PX', 'sfintl': 'SF International', 'huayuan': 'Huayuan', '4px': '4PX' };
// 渠道名模式匹配（兼容全名/别名：华源国际专线、顺丰国际、4PX 递四方等）
function carrierEn(name) {
  const s = String(name || '');
  if (!s) return '';
  if (/4PX|递四方/i.test(s)) return '4PX';
  if (/顺丰/.test(s)) return 'SF International';
  if (/华源/.test(s)) return 'Huayuan';
  if (/云途/.test(s)) return 'YunExpress Line';
  // estimate 模式产品名后缀（如「云途专线 经济专线」）
  if (/经济专线/.test(s)) return 'Economy Line';
  if (/标准快递/.test(s)) return 'Standard Express';
  if (/特快专递/.test(s)) return 'Express Courier';
  return CARRIER_EN[s] || s;
}
const SHIP_LABEL_EN = { shipFastest: 'Fastest', shipCheapest: 'Cheapest', shipMiddle: 'Middle' };
const PLATFORM_EN = { '淘宝': 'Taobao', '天猫': 'Tmall', '京东': 'JD.com', '拼多多': 'Pinduoduo', '1688': '1688' };
const PLATFORM_ID = { '淘宝': 'taobao', '天猫': 'tmall', '京东': 'jd', '拼多多': 'pdd', '1688': '1688' };
const CATEGORY_EN = { '蓝牙耳机': 'Bluetooth Earbuds', '无线充电器': 'Wireless Chargers', '充电器': 'Chargers', '瑜伽垫': 'Yoga Mats', '保温杯': 'Thermal Bottles', '手机壳': 'Phone Cases', '键盘': 'Keyboards', '智能手表': 'Smart Watches', '运动鞋': 'Sneakers', '行李箱': 'Luggage', 'LED台灯': 'LED Lamps', '灯具': 'Lighting', '健身器材': 'Fitness Gear', '宠物玩具': 'Pet Toys', '玩具': 'Toys', '零食': 'Snacks', '默认': 'General' };
const PRODUCT_NAME_EN = {
  'FED-5DAY-空派DDP小货': 'FED-5DAY Air DDP Small Parcel',
  'FEDEX美国空快-包裹（包税）': 'FEDEX US Air Express (Tax Included)',
  'HKUPS蓝单南美6000（UPL22）': 'HKUPS Blue Line South America 6000 (UPL22)',
  'USXB-V06美国FEDEX专线小包（不接手表）': 'USXB-V06 US FEDEX Line Small Parcel (No Watches)',
};
function productNameEn(name) {
  const s = String(name || '');
  if (!s) return '';
  if (PRODUCT_NAME_EN[s]) return PRODUCT_NAME_EN[s];
  if (/[\u4e00-\u9fff]/.test(s)) {
    const ascii = s.replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
    return ascii || s;
  }
  return s;
}

// 原站 en 词条（与 src/locales/en.json 同步维护）
const T = {
  searchPlaceholder: 'Try: wireless earbuds, yoga mat, phone case…',
  searchButton: 'Search',
  searchTabLink: 'Product link',
  searchSuggestions: 'Popular:',
  bannerDemo: "Demo mode — showing built-in sample data while live comparison is being connected",
  settingsTo: 'To', settingsCurrency: 'Currency', settingsPlatforms: 'Platforms', settingsServiceFee: 'Service fee',
  carrierTitle: 'International Courier',
  sortRecommended: 'Recommended', sortPriceAsc: 'Price ↑', sortPriceDesc: 'Price ↓', sortRating: 'Rating', sortSales: 'Sales', sortSpeed: 'Fastest delivery',
  resultTotal: '{total} offers found from {platforms} platforms',
  topPick: 'TOP PICK', recommended: 'Recommended', inStock: 'In stock',
  score: 'Score', sales: 'sales', rating: 'Rating', estDelivery: 'Est. delivery', days: 'days',
  landedTotal: 'Total landed cost', price: 'Price', shipping: 'Intl. shipping', duty: 'Import duty', vat: 'VAT',
  serviceFee: 'Service fee', paymentFee: 'Payment fee',
  purchaseNote: 'China purchase price · Excl. shipping, tax & duty',
  viewBreakdown: 'View cost breakdown', addToCombine: 'Add to combine', orderCta: 'Order via purchasing agent',
  sourceMock: 'Demo data',
  faqTitle: 'Frequently asked questions',
  faqSubtitle: 'Everything you need to know about buying from China with CrossBuy',
  footerNote: 'Prices are estimates including international shipping, duties & VAT. Actual customs may vary; any difference will be settled.',
  footerDisclaimer: 'Demo system — connect real platform affiliate APIs via server/.env for production use.',
};

const en = JSON.parse(readFileSync(join(ROOT, 'src/locales/en.json'), 'utf8'));

function money(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSales(n) {
  if (n == null) return '—';
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const slugOf = (file) => file.replace(/^search-/, '').replace(/\.json$/, '');
const cap = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());

function productCard(item, kw, tiers, idx) {
  const b = item.landed.breakdown;
  const title = item.titleEn && item.titleEn !== item.title ? item.titleEn : item.title;
  const platform = PLATFORM_EN[item.platform] || item.platform;
    const imgPath = item.imageUrl ? (item.imageUrl.startsWith('/demo/') ? item.imageUrl : `/demo${item.imageUrl}`) : '';
  const badge = item.isTopPick ? `<span class="badge">${T.topPick}</span>` : item.isRecommended ? `<span class="badge rec">${T.recommended}</span>` : '';

  const breakdownRows = [
    [`${T.price} (${item.shopName || platform})`, b.goodsValue],
    [`${T.shipping} · ${carrierEn(item.landed.shipping.carrier)} (${item.landed.shipping.weightGrams}g)`, b.intlShipping],
    [`${T.duty} (${(item.landed.dutyRate * 100).toFixed(0)}%)`, b.duty],
    [`${T.vat} (${(item.landed.vatRate * 100).toFixed(0)}%)`, b.vat],
    [T.serviceFee, b.serviceFee],
    [T.paymentFee, b.paymentFee],
  ];
  const taxNote = item.landed.taxNoteEn ? `<div class="tax-note">Note: ${item.landed.taxNoteEn}</div>` : '';

  const refUsd = item.landed.shipping.quoteUsd;
  const rate = refUsd ? b.intlShipping / refUsd : null;
  const tierRows = (tiers || []).map(({ labels, quote }) => {
    const tierPrice = rate != null ? quote.priceUsd * rate : null;
    const tierTotal = tierPrice != null ? b.total - b.intlShipping + tierPrice : null;
    const tagHtml = labels.map((l) => `<em class="tier-tag ${l}">${SHIP_LABEL_EN[l] || l}</em>`).join('');
    const name = carrierEn(quote.carrierName || quote.carrier);
    return `<div class="ship-tier"><span class="tier-tags">${tagHtml}</span><span class="tier-name">${esc(name)}${quote.productName ? ` · ${esc(productNameEn(quote.productName))}` : ''}</span><span class="tier-days">${quote.daysMin}-${quote.daysMax} ${T.days}</span><span class="tier-price">${money(tierTotal)}</span></div>`;
  }).join('\n          ');

  const score = item.scores?.total ?? 0;

  return `<div class="card ${item.isTopPick ? 'top' : item.isRecommended ? 'recommended' : ''}">
      <div class="card-media">
        <span class="platform-badge">${platform}</span>
        ${imgPath ? `<img src="${imgPath}" alt="${esc(title)}" loading="${idx === 0 ? 'eager" fetchpriority="high' : 'lazy'}" />` : ''}
        ${badge}
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(title)}</h3>
        <div class="card-meta">
          ${item.category ? `<span class="pill">${esc(CATEGORY_EN[item.category] || item.category)}</span>` : ''}
          ${item.inStock ? `<span class="pill good">${T.inStock}</span>` : ''}
          <span class="pill source-badge">${T.sourceMock}</span>
        </div>
        <div class="price-line">
          <span class="price-total">${money(b.goodsValue)}</span>
          <span class="price-unit">USD</span>
        </div>
        <div class="price-note">${T.purchaseNote}</div>
        ${tierRows ? `<div class="ship-tiers">\n          ${tierRows}\n        </div>` : `<div class="cost-strip"><span>${T.landedTotal}</span><span class="val">${money(b.total)}</span></div>`}
        <div class="card-stats">
          <div class="stat"><div class="num">${fmtSales(item.sales)}</div><div class="lbl">${T.sales}</div></div>
          <div class="stat"><div class="num">${(item.rating || 0).toFixed(1)}</div><div class="lbl">${T.rating}</div></div>
          <div class="stat"><div class="num">${item.landed.shipping.daysMin}-${item.landed.shipping.daysMax}</div><div class="lbl">${T.estDelivery} (${T.days})</div></div>
        </div>
        <div class="score-bar">
          <div class="score-bar-top"><span>${T.score}</span><span>${Number(score).toFixed(1)}</span></div>
          <div class="score-track"><div class="score-fill" style="width: ${Number(score)}%"></div></div>
        </div>
        <div class="card-actions">
          <details class="breakdown-toggle">
            <summary class="btn btn-ghost btn-sm">${T.viewBreakdown}</summary>
            <div class="breakdown">
              ${breakdownRows.map(([label, v]) => `<div class="breakdown-row"><span>${esc(label)}</span><span class="val">${money(v)}</span></div>`).join('\n              ')}
              <div class="breakdown-row total"><span>${T.landedTotal}</span><span class="val">${money(b.total)}</span></div>
              ${taxNote}
            </div>
          </details>
          <button type="button" class="btn btn-ghost btn-sm">${T.addToCombine}</button>
          <a class="btn-order" style="margin-top: 12px" href="${SITE}/?q=${encodeURIComponent(kw)}" rel="nofollow">${T.orderCta}</a>
        </div>
      </div>
    </div>`;
}

// 从 dist/index.html 提取主站 CSS（build 后 hash 文件名）
const distHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const cssMatch = distHtml.match(/<link rel="stylesheet"[^>]*>/g) || [];
// 与落地页同域部署，CSS 用根相对路径（本地/生产均可用）
const cssLinks = cssMatch.map((l) => l.replace(/href="\//, 'href="/')).join('\n    ');

const files = readdirSync(join(PUBLIC, 'demo')).filter((f) => /^search-.*\.json$/.test(f)).sort();

// 先扫全部关键词，供每个页面互链（内链网）
const allPages = files.map((file) => {
  const meta = JSON.parse(readFileSync(join(PUBLIC, 'demo', file), 'utf8'));
  return { slug: slugOf(file), kw: meta.inputKeyword || slugOf(file).replace(/-/g, ' ') };
});

for (const file of files) {
  const slug = slugOf(file);
  const d = JSON.parse(readFileSync(join(PUBLIC, 'demo', file), 'utf8'));
  const items = (d.results || []).slice(0, 9);
  const kw = d.inputKeyword || slug.replace(/-/g, ' ');
  const liveUrl = `${SITE}/?q=${encodeURIComponent(kw)}`;
  const title = `${cap(kw)} from China — Landed Price, Duty &amp; Shipping Calculator | CrossBuy`;
  const prices = items.map((i) => i.landed.breakdown.total).filter((v) => v != null);
  const minP = prices.length ? Math.min(...prices) : null;
  const maxP = prices.length ? Math.max(...prices) : null;
  const desc = `Compare ${kw} across Taobao, Tmall, JD.com, Pinduoduo and 1688. Landed price from ${minP ? money(minP) : '—'} to ${maxP ? money(maxP) : '—'} USD with international shipping, customs duty and VAT included. Ships from China worldwide.`;
  const platforms = new Set(items.map((i) => i.platform)).size;

  // 热搜 pill：有落地页的内链，其余回主站
  const suggestPills = allPages.slice(0, 6).map((p) => {
    const href = p.slug === slug ? liveUrl : `${SITE}/p/${p.slug}/`;
    return `<button type="button" class="suggestion-pill" onclick="location.href='${href}'">${esc(p.kw)}</button>`;
  }).join('\n          ');

  // 平台 chips（原站默认全选）
  const platformChips = Object.entries(PLATFORM_ID).map(([zh, id]) =>
    `<button type="button" class="btn-chip active">${tPlatform(id)}</button>`
  ).join('\n          ');

  function tPlatform(id) {
    const map = { taobao: 'Taobao', tmall: 'Tmall', jd: 'JD.com', pdd: 'Pinduoduo', '1688': '1688' };
    return map[id] || id;
  }

  // 设置面板：目的国（重点 32 国）/ 币种（主流 24）/ 平台 / 服务费 —— 静态只读复刻
  const priorityCountries = [['US', 'United States'], ['GB', 'United Kingdom'], ['DE', 'Germany'], ['FR', 'France'], ['NL', 'Netherlands'], ['IT', 'Italy'], ['ES', 'Spain'], ['CA', 'Canada'], ['AU', 'Australia'], ['JP', 'Japan'], ['KR', 'South Korea'], ['SG', 'Singapore'], ['MY', 'Malaysia'], ['TH', 'Thailand'], ['VN', 'Vietnam'], ['PH', 'Philippines'], ['ID', 'Indonesia'], ['IN', 'India'], ['SA', 'Saudi Arabia'], ['AE', 'United Arab Emirates'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['RU', 'Russia'], ['TR', 'Turkey'], ['ZA', 'South Africa'], ['NZ', 'New Zealand'], ['CH', 'Switzerland'], ['SE', 'Sweden'], ['NO', 'Norway'], ['PL', 'Poland'], ['HK', 'Hong Kong'], ['TW', 'Taiwan']];
  const countryOptions = priorityCountries.map(([code, name]) =>
    `<option value="${code}" ${code === 'US' ? 'selected' : ''}>${name} (${code})</option>`
  ).join('');
  const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD', 'CAD', 'AUD', 'NZD', 'HKD', 'TWD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'INR', 'THB', 'VND', 'MYR', 'PHP', 'IDR'].map((c) =>
    `<option value="${c}" ${c === 'USD' ? 'selected' : ''}>${c}</option>`
  ).join('');

  // 渠道选择器：选中行 + 可展开完整报价列表（details 折叠与原站收起状态一致）
  const quotes = d.carrierQuotes || [];
  const carrierRows = quotes.map((q, i) => {
    const name = carrierEn(q.carrierName || q.carrier);
    return `<div class="carrier-option ${i === 0 ? 'active' : ''}"><div class="carrier-option-left">${q.recommended ? `<span class="carrier-best">${T.recommended}</span>` : ''}<b>${esc(productNameEn(q.productName))}</b><span class="carrier-days">${esc(name)} · ${q.daysMin}-${q.daysMax} ${T.days}</span></div><div class="carrier-option-right"><span class="carrier-price">${money(q.priceUsd)}</span></div></div>`;
  }).join('\n          ');

  const sortBar = [['recommended', T.sortRecommended], ['price', T.sortPriceAsc], ['priceDesc', T.sortPriceDesc], ['rating', T.sortRating], ['sales', T.sortSales], ['speed', T.sortSpeed]].map(([id, label]) =>
    `<button type="button" class="btn-chip ${id === 'recommended' ? 'active' : ''}">${label}</button>`
  ).join('\n              ');

  const cards = items.map((it, idx) => productCard(it, kw, pickShippingTiers(quotes), idx)).join('\n    ');

  const faqEntities = Object.keys(en.faq)
    .filter((k) => /^q\d+$/.test(k))
    .map((k) => ({ name: en.faq[k], text: en.faq[k.replace('q', 'a')] }));

  const faqHtml = faqEntities.map((q, i) =>
    `<details class="faq-item" ${i < 2 ? 'open' : ''}><summary>${esc(q.name)}</summary><p>${esc(q.text)}</p></details>`
  ).join('\n            ');

  const otherPages = allPages.length > 1
    ? `<nav class="seo-related"><h2>Popular searches</h2><ul>${allPages.filter((p) => p.slug !== slug).map((p) => `<li><a href="/p/${p.slug}/">${esc(p.kw)}</a></li>`).join('')}</ul></nav>`
    : '';

  const productsLd = items.map((item, idx) => {
    const b = item.landed.breakdown;
    const titleEn = item.titleEn && item.titleEn !== item.title ? item.titleEn : item.title;
    const platform = PLATFORM_EN[item.platform] || item.platform;
  const imgPath = item.imageUrl ? (item.imageUrl.startsWith('/demo/') ? item.imageUrl : `/demo${item.imageUrl}`) : '';
    return {
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Product',
        name: titleEn,
        image: imgPath ? [`${SITE}${imgPath}`] : undefined,
        offers: {
          '@type': 'Offer',
          price: b.goodsValue != null ? Number(b.goodsValue).toFixed(2) : undefined,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: liveUrl,
          seller: { '@type': 'Organization', name: platform },
        },
      },
    };
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/p/${slug}/#page`,
        url: `${SITE}/p/${slug}/`,
        name: title,
        description: desc,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CrossBuy', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: cap(kw), item: `${SITE}/p/${slug}/` },
        ],
      },
      { '@type': 'ItemList', itemListElement: productsLd, numberOfItems: productsLd.length },
      { '@type': 'FAQPage', mainEntity: faqEntities.map((q) => ({ '@type': 'Question', name: q.name, acceptedAnswer: { '@type': 'Answer', text: q.text } })) },
    ],
  };

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <link rel="canonical" href="${SITE}/p/${slug}/" />
    <link rel="alternate" hreflang="en" href="${SITE}/p/${slug}/" />
    <link rel="alternate" hreflang="zh-CN" href="${liveUrl}" />
    <link rel="alternate" hreflang="es" href="${liveUrl}&amp;lang=es" />
    <link rel="alternate" hreflang="x-default" href="${SITE}/p/${slug}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="CrossBuy" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${SITE}/p/${slug}/" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${SITE}/og.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="${SITE}/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="${SITE}/apple-touch-icon.png" />
    ${cssLinks}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <header class="header">
      <div class="lang-switcher">
        <form action="${SITE}/" method="get">
          <input type="hidden" name="q" value="${esc(kw)}" />
          <select class="lang-select" onchange="this.form.submit()" aria-label="Language">
            <option value="en" selected>English</option>
            <option value="es">Español</option>
            <option value="zh">中文</option>
          </select>
          <noscript><button type="submit">Go</button></noscript>
        </form>
      </div>
      <div class="container header-inner">
        <h1 class="logo">CrossBuy</h1>
        <p class="tagline">Buy More Save More</p>
      </div>
    </header>
    <main class="container">
      <div class="search-panel">
        <form class="search-row" action="${SITE}/" method="get">
          <button type="button" class="link-toggle">${T.searchTabLink}</button>
          <input class="search-input" name="q" value="${esc(kw)}" placeholder="${esc(T.searchPlaceholder)}" />
          <button class="btn btn-primary" type="submit">${T.searchButton}</button>
        </form>
        <div class="suggestions">
          <span>${T.searchSuggestions}</span>
          ${suggestPills}
        </div>
      </div>
      <div class="demo-banner" role="status">${T.bannerDemo}</div>
      <div class="settings-panel">
        <div class="settings-field field-country">
          <label class="settings-label">${T.settingsTo}</label>
          <select class="settings-control" disabled>${countryOptions}</select>
        </div>
        <div class="settings-field field-currency">
          <label class="settings-label">${T.settingsCurrency}</label>
          <select class="settings-control" disabled>${currencyOptions}</select>
        </div>
        <div class="settings-field field-platforms">
          <label class="settings-label">${T.settingsPlatforms}</label>
          <div class="platform-row">
            ${platformChips}
          </div>
        </div>
        <div class="settings-field field-profit">
          <label class="settings-label">${T.settingsServiceFee}: 5%</label>
          <input class="settings-control" type="range" min="0" max="30" value="5" style="--fill: 16.7%" disabled />
        </div>
        ${quotes.length ? `<div class="carrier-inline">
          <details>
            <summary class="carrier-selected"><span class="carrier-arrow">▼</span></summary>
            <div class="carrier-list">
          ${carrierRows}
            </div>
          </details>
        </div>` : ''}
      </div>
      <div class="results-head">
        <div class="results-count">
          <span>${T.resultTotal.replace('{total}', items.length).replace('{platforms}', platforms)}</span>
        </div>
        <div class="sort-bar">
              ${sortBar}
        </div>
      </div>
      <div class="result-grid seo-grid">
    ${cards}
      </div>
      <section class="faq-section" aria-labelledby="faq-title">
        <h2 id="faq-title">${T.faqTitle}</h2>
        <p class="faq-subtitle">${T.faqSubtitle}</p>
        <div class="faq-list">
            ${faqHtml}
        </div>
      </section>
      ${otherPages}
      <footer class="footer">
        <p class="note">${T.footerNote}</p>
        <p>${T.footerDisclaimer}</p>
      </footer>
    </main>
  </body>
</html>
`;

  const outDir = join(PUBLIC, 'p', slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  console.log(`prerendered /p/${slug}/ (${items.length} products)`);
}

console.log(`done: ${allPages.length} SEO pages`);

// 生成 LLMs-full.txt（完整版 LLM 上下文：功能 + FAQ 全文 + 各关键词商品数据）
const faqFull = Object.keys(en.faq)
  .filter((k) => /^q\d+$/.test(k))
  .map((k) => `### ${en.faq[k]}\n${en.faq[k.replace('q', 'a')]}`)
  .join('\n\n');

const catalogSections = allPages.map(({ slug, kw }) => {
  const data = JSON.parse(readFileSync(join(PUBLIC, 'demo', `search-${slug}.json`), 'utf8'));
  const rows = (data.results || []).map((item, idx) => {
    const b = item.landed.breakdown;
    const titleEn = item.titleEn && item.titleEn !== item.title ? item.titleEn : item.title;
    const platform = PLATFORM_EN[item.platform] || item.platform;
    return `${idx + 1}. ${titleEn} — item ${money(b.goodsValue)} USD, landed ${money(b.total)} USD (${item.landed.shipping.daysMin}-${item.landed.shipping.daysMax} days), from ${platform}`;
  }).join('\n');
  return `## ${cap(kw)} (${SITE}/p/${slug}/)\n\n${rows}`;
}).join('\n\n');

const llmsFull = `# CrossBuy Global — full reference (LLMs-full)

This is the complete reference for CrossBuy (https://globalbuy.pages.dev/), a cross-border price comparison and shopping agent platform for China's major e-commerce marketplaces (Taobao, Tmall, JD.com, Pinduoduo, 1688). Slogan: Buy More Save More.

## How it works

1. Buyer searches once; CrossBuy queries all five marketplaces and merges the same product into one card with best / fastest / recommended rankings.
2. Every product shows the full landed price: item price + international shipping + customs duty + VAT + service fee + payment fee, computed per destination country.
3. Buyer picks an international carrier (4PX, Huayuan, SF International and more) with real-time prices and delivery estimates.
4. Multiple items can be combined into one parcel; shipping is billed on combined weight and duty-free thresholds apply to the merged value.

## Key facts

- Destinations: 200+ countries and regions. Key markets first (US, GB, DE, FR, IT, ES, CA, AU, JP, KR, SG and more), then grouped by continent.
- Currencies: 140+ display currencies with live FX rates; item prices are quoted in CNY and converted for display.
- Service fee: buyer-selected 0%-30% (default 5%), shown as a separate line.
- Languages: Simplified Chinese (zh-CN), English (en), Spanish (es).
- Pre-rendered keyword landing pages: ${allPages.map((p) => `${SITE}/p/${p.slug}/`).join(', ')}

## FAQ (full text)

${faqFull}

## Product catalog snapshot (per keyword)

${catalogSections}
`;

writeFileSync(join(PUBLIC, 'llms-full.txt'), llmsFull);
console.log('generated llms-full.txt');

// build 链中本脚本在 vite build 之后运行，需把生成物拷入 dist 才会随部署发布
if (existsSync(DIST)) {
  cpSync(join(PUBLIC, 'p'), join(DIST, 'p'), { recursive: true });
  cpSync(join(PUBLIC, 'llms-full.txt'), join(DIST, 'llms-full.txt'));
  console.log('copied public/p + llms-full.txt -> dist');
}
