#!/bin/bash
# 生成前端演示快照（后端 API 响应 → web/public/demo/*.json + 引用的商品图片）
# 后端可用时重新执行即可刷新快照
set -e
API="${1:-http://localhost:3001}"
OUT="/workspace/web/public/demo"
mkdir -p "$OUT/images"

curl -sf --max-time 15 "$API/api/meta" -o "$OUT/meta.json"
curl -sf --max-time 30 "$API/api/search?q=wireless%20earbuds&country=US&currency=USD" -o "$OUT/search-wireless-earbuds.json"
curl -sf --max-time 30 "$API/api/search?q=phone%20case&country=US&currency=USD" -o "$OUT/search-phone-case.json"
curl -sf --max-time 30 "$API/api/search?q=smart%20watch&country=US&currency=USD" -o "$OUT/search-smart-watch.json"
curl -sf --max-time 30 "$API/api/search?q=luggage&country=US&currency=USD" -o "$OUT/search-luggage.json"
curl -sf --max-time 30 "$API/api/search?q=keyboard&country=US&currency=USD" -o "$OUT/search-keyboard.json"
curl -sf --max-time 30 "$API/api/search?q=sneakers&country=US&currency=USD" -o "$OUT/search-sneakers.json"
curl -sf --max-time 30 "$API/api/search?q=wireless%20charger&country=US&currency=USD" -o "$OUT/search-wireless-charger.json"
curl -sf --max-time 30 "$API/api/search?q=thermos&country=US&currency=USD" -o "$OUT/search-thermos.json"
curl -sf --max-time 30 "$API/api/search?q=LED%20desk%20lamp&country=US&currency=USD" -o "$OUT/search-led-lamp.json"
curl -sf --max-time 30 "$API/api/search?q=yoga%20mat&country=US&currency=USD" -o "$OUT/search-yoga-mat.json"
curl -sf --max-time 30 "$API/api/search?q=cat%20toys&country=US&currency=USD" -o "$OUT/search-cat-toys.json"
curl -sf --max-time 30 "$API/api/search?q=snacks&country=US&currency=USD" -o "$OUT/search-snacks.json"

# 拷贝快照引用的商品图片，保证离线/降级时图片完整
IMGS=$(node -e "
const fs = require('fs');
const urls = new Set();
for (const f of fs.readdirSync('$OUT').filter(n => n.startsWith('search-') && n.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync('$OUT/' + f, 'utf8'));
  (j.results || []).forEach(r => { if (r.imageUrl) urls.add(r.imageUrl); });
}
console.log([...urls].join(' '));
")
for u in $IMGS; do
  f=$(basename "$u")
  if [ -f "/workspace/server/public/images/$f" ]; then
    cp "/workspace/server/public/images/$f" "$OUT/images/$f"
  fi
done

ls -la "$OUT" "$OUT/images" | tail -n +2
