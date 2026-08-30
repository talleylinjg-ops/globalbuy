import { Router } from 'express';

const router = Router();

// 平台主题色
const PLATFORM_COLORS = {
  taobao: { from: '#ff5000', to: '#ff7f3f' },
  tmall: { from: '#ff0036', to: '#ff5f7e' },
  jd: { from: '#e1251b', to: '#ff5f52' },
  pdd: { from: '#e02e24', to: '#ff7aa8' },
  '1688': { from: '#ff9f1c', to: '#ffd54f' },
  default: { from: '#38bdf8', to: '#818cf8' },
};

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 生成商品占位图 SVG：GET /api/img/:category/:platform?label=xxx&w=400&h=300
router.get('/img/:category/:platform', (req, res) => {
  const category = req.params.category || 'Product';
  const platform = (req.params.platform || 'default').toLowerCase();
  const label = (req.query.label || category).slice(0, 12);
  const w = parseInt(req.query.w, 10) || 400;
  const h = parseInt(req.query.h, 10) || 300;
  const colors = PLATFORM_COLORS[platform] || PLATFORM_COLORS.default;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.from}"/>
      <stop offset="100%" stop-color="${colors.to}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" rx="12"/>
  <text x="50%" y="46%" text-anchor="middle" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="rgba(255,255,255,0.92)">${escapeXml(platform === 'default' ? 'GOODS' : platform.toUpperCase())}</text>
  <text x="50%" y="62%" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="rgba(255,255,255,0.92)">${escapeXml(label)}</text>
  <text x="50%" y="76%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.6)">${escapeXml(category)}</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

export default router;
