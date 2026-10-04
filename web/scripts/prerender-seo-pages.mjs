// 预渲染 SEO 落地页：从 demo 快照生成与原站视觉一致的静态页面
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
const SHIP_LABEL_EN = { shipFastest: 'Fastest', shipCheapest: 'Cheapest', shipMiddle: 'Balanced' };
const PLATFORM_EN = { '淘宝': 'Taobao', '天猫': 'Tmall', '京东': 'JD.com', '拼多多': 'Pinduoduo', '1688': '1688' };

const en = JSON.parse(readFileSync(join(ROOT, 'src/locales/en.json'), 'utf8'));
const t = (o, k) => k.split('.').reduce((acc, part) => (acc || {})[part], o) ?? k;

function money(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slugOf(file) {
  return file.replace(/^search-/, '').replace(/\.json$/, '');
}

function productCard(item, kw, tiers, idx) {
  const b = item.landed.breakdown;
  const title = item.titleEn && item.titleEn !== item.title ? item.titleEn : item.title;
  const platform = PLATFORM_EN[item.platform] || item.platform;
  const carrier = CARRIER_EN[item.landed.shipping.carrier] || item.landed.shipping.carrier;
  const imgPath = item.imageUrl || '';
  const badge = item.isTopPick ? '<span class="badge">Top Pick</span>' : item.isRecommended ? '<span class="badge rec">Recommended</span>' : '';

  // 三档快递到手价换算（与原站 ProductCard 一致：税费/服务费与运费无关，直接重算）
  const refUsd = item.landed.shipping.quoteUsd;
  const rate = refUsd ? b.intlShipping / refUsd : null;
  const tierRows = (tiers || []).map(({ labels, quote }) => {
    const tierPrice = rate != null ? quote.priceUsd * rate : null;
    const tierTotal = tierPrice != null ? b.total - b.intlShipping + tierPrice : null;
    const tagHtml = labels.map((label) => `<em class="tier-tag ${label}">${SHIP_LABEL_EN[label] || label}</em>`).join('');
    const name = CARRIER_EN[quote.carrierName] || CARRIER_EN[quote.carrier] || quote.carrierName || quote.carrier;
    return `<div class="ship-tier"><span class="tier-tags">${tagHtml}</span><span class="tier-name">${esc(name)}${quote.productName ? ` · ${esc(quote.productName)}` : ''}</span><span class="tier-days">${quote.daysMin}-${quote.daysMax} days</span><span class="tier-price">${money(tierTotal)}</span></div>`;
  }).join('\n          ');

  const breakdownRows = [
    ['Item price', b.goodsValue],
    [`International shipping · ${carrier} (${item.landed.shipping.weightGrams}g)`, b.intlShipping],
    [`Duty (${(item.landed.dutyRate * 100).toFixed(0)}%)`, b.duty],
    [`VAT (${(item.landed.vatRate * 100).toFixed(0)}%)`, b.vat],
    ['Service fee', b.serviceFee],
    ['Payment fee', b.paymentFee],
  ];
  const taxNote = item.landed.taxNoteEn ? `<div class="tax-note">Note: ${item.landed.taxNoteEn}</div>` : '';

  return `<div class="card ${item.isTopPick ? 'top' : item.isRecommended ? 'recommended' : ''}">
      <div class="card-media">
        <span class="platform-badge">${platform}</span>
        ${imgPath ? `<img src="${imgPath}" alt="${esc(title)}" loading="${idx === 0 ? 'eager" fetchpriority="high' : 'lazy'}" />` : ''}
        ${badge}
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(title)}</h3>
        <div class="card-meta">
          ${item.category ? `<span class="pill">${esc(item.category)}</span>` : ''}
          ${item.inStock ? '<span class="pill good">In stock</span>' : ''}
        </div>
        <div class="price-line">
          <span class="price-total">${money(b.goodsValue)}</span>
          <span class="price-unit">USD</span>
        </div>
        <div class="price-note">Shown price is the item price. Landed price below includes all fees.</div>
        ${tierRows ? `<div class="ship-tiers">\n          ${tierRows}\n        </div>` : `<div class="cost-strip"><span>Landed total</span><span class="val">${money(b.total)}</span></div>`}
        <div class="breakdown">
          ${breakdownRows.map(([label, v]) => `<div class="breakdown-row"><span>${esc(label)}</span><span class="val">${money(v)}</span></div>`).join('\n          ')}
          <div class="breakdown-row total"><span>Landed total</span><span class="val">${money(b.total)}</span></div>
          ${taxNote}
        </div>
        <div class="card-stats">
          <div class="stat"><div class="num">${fmtSales(item.sales)}</div><div class="lbl">Sales</div></div>
          <div class="stat"><div class="num">${(item.rating || 0).toFixed(1)}</div><div class="lbl">Rating</div></div>
          <div class="stat"><div class="num">${item.landed.shipping.daysMin}-${item.landed.shipping.daysMax}</div><div class="lbl">Delivery (days)</div></div>
        </div>
        <div class="card-actions">
          <a class="btn btn-primary" href="${SITE}/?q=${encodeURIComponent(kw)}" rel="nofollow">View &amp; order on CrossBuy</a>
        </div>
      </div>
    </div>`;
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

// 从 dist/index.html 提取主站 CSS（build 后 hash 文件名）
const distHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const cssMatch = distHtml.match(/<link rel="stylesheet"[^>]*>/g) || [];
const cssLinks = cssMatch.map((l) => l.replace(/href="\//, `href="${SITE}/`)).join('\n    ');

const files = readdirSync(join(PUBLIC, 'demo')).filter((f) => /^search-.*\.json$/.test(f)).sort();
const cap = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());

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
  const title = `${cap(kw)} from China — Landed Price, Duty &amp; Shipping Calculator | CrossBuy`;
  const prices = items.map((i) => i.landed.breakdown.total).filter((v) => v != null);
  const minP = prices.length ? Math.min(...prices) : null;
  const maxP = prices.length ? Math.max(...prices) : null;
  const desc = `Compare ${kw} across Taobao, Tmall, JD.com, Pinduoduo and 1688. Landed price from ${minP ? money(minP) : '—'} to ${maxP ? money(maxP) : '—'} USD with international shipping, customs duty and VAT included. Ships from China worldwide.`;

  const productsLd = items.map((item, idx) => {
    const b = item.landed.breakdown;
    const titleEn = item.titleEn && item.titleEn !== item.title ? item.titleEn : item.title;
    const platform = PLATFORM_EN[item.platform] || item.platform;
    const imgPath = item.imageUrl || '';
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
          url: `${SITE}/?q=${encodeURIComponent(kw)}`,
          seller: { '@type': 'Organization', name: platform },
        },
      },
    };
  });

  const faqEntities = Object.keys(en.faq)
    .filter((k) => /^q\d+$/.test(k))
    .map((k) => ({
      '@type': 'Question',
      name: en.faq[k],
      acceptedAnswer: { '@type': 'Answer', text: en.faq[k.replace('q', 'a')] },
    }));

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
      { '@type': 'FAQPage', mainEntity: faqEntities },
    ],
  };

  const cards = items.map((it, idx) => productCard(it, kw, pickShippingTiers(d.carrierQuotes), idx)).join('\n    ');
  const otherPages = allPages.length > 1
    ? `<nav class="seo-related"><h2>Popular searches</h2><ul>${allPages.filter((p) => p.slug !== slug).map((p) => `<li><a href="/p/${p.slug}/">${esc(p.kw)}</a></li>`).join('')}</ul></nav>`
    : '';

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
    <link rel="alternate" hreflang="zh-CN" href="${SITE}/?q=${encodeURIComponent(kw)}" />
    <link rel="alternate" hreflang="es" href="${SITE}/?q=${encodeURIComponent(kw)}&amp;lang=es" />
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
    <div id="root">
      <main class="container">
        <header class="seo-header">
          <a class="seo-brand" href="${SITE}/">CrossBuy <small>Buy More Save More</small></a>
          <a class="btn btn-primary" href="${SITE}/?q=${encodeURIComponent(kw)}">Open live search</a>
        </header>
        <h1>${cap(kw)} from China — landed price comparison</h1>
        <p class="seo-lead">Prices below are compared across Taobao, Tmall, JD.com, Pinduoduo and 1688. Every item shows the full landed price — international shipping, customs duty, VAT, service fee and payment fee — for delivery from mainland China worldwide.</p>
        <section class="results-grid seo-grid">
    ${cards}
        </section>
        ${otherPages}
        <section class="faq-section">
          <h2>Frequently asked questions</h2>
          <div class="faq-list">
            ${faqEntities.map((q) => `<details class="faq-item"><summary>${esc(q.name)}</summary><p>${esc(q.acceptedAnswer.text)}</p></details>`).join('\n            ')}
          </div>
        </section>
        <footer class="seo-footer">
          <p>CrossBuy — cross-border price comparison &amp; shopping agent for China's major e-commerce marketplaces. <a href="${SITE}/">globalbuy.pages.dev</a></p>
        </footer>
      </main>
    </div>
  </body>
</html>
`;

  const outDir = join(PUBLIC, 'p', slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  console.log(`prerendered /p/${slug}/ (${items.length} products)`);
}

console.log(`done: ${allPages.length} SEO pages`);

// build 链中本脚本在 vite build 之后运行，public/p 需再拷入 dist 才会随部署发布
if (existsSync(DIST)) {
  cpSync(join(PUBLIC, 'p'), join(DIST, 'p'), { recursive: true });
  console.log('copied public/p -> dist/p');
}
