#!/bin/bash
# 生成前端演示快照（后端 API 响应 → web/public/demo/*.json）
# 后端可用时重新执行即可刷新快照
set -e
API="${1:-http://localhost:3001}"
OUT="/workspace/web/public/demo"
mkdir -p "$OUT"

curl -sf --max-time 15 "$API/api/meta" -o "$OUT/meta.json"
curl -sf --max-time 30 "$API/api/search?q=wireless%20earbuds&country=US&currency=USD" -o "$OUT/search-wireless-earbuds.json"
curl -sf --max-time 30 "$API/api/search?q=phone%20case&country=US&currency=USD" -o "$OUT/search-phone-case.json"

ls -la "$OUT"
