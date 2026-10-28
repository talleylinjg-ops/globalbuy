#!/bin/bash
# CrossBuy 全量部署：从 GitHub master tarball 同步 server 源码 + web/dist 到 VPS
# 用法（宝塔终端执行）：curl -fsSL "https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/deploy-latest.sh?v=$(date +%s)" | bash
exec 2>&1
set -e
APP=/opt/globalbuy
WORK=/tmp/gbdeploy-$$

echo '===== [1] 拉取 master 全量包 ====='
mkdir -p "$WORK" && cd "$WORK"
curl -fsSL "https://codeload.github.com/talleylinjg-ops/globalbuy/tar.gz/refs/heads/master" -o gb.tgz
tar xzf gb.tgz
SRC=$(ls -d globalbuy-master | head -1)
[ -d "$SRC/server/src" ] || { echo '包结构异常'; exit 1; }

echo '===== [2] 同步 server 源码 ====='
cp -r "$SRC/server/src/." "$APP/server/src/"
cp "$SRC/server/package.json" "$APP/server/package.json" 2>/dev/null || true
cp "$SRC/server/ecosystem.config.cjs" "$APP/server/" 2>/dev/null || true
cp "$SRC/server"/*.mjs "$APP/server/" 2>/dev/null || true
grep -q 'adminShipOrder\|orders/:id/ship' "$APP/server/src/routes/admin.js" && echo 'admin.js: 发货接口 OK'
grep -q 'tokenInflight' "$APP/server/src/carriers/sfinternational.js" && echo 'sfintl: token 并发修复 OK'

echo '===== [3] 同步 web/dist（顺丰发货按钮版前端） ====='
rm -rf "$APP/web/dist"
cp -r "$SRC/web/dist" "$APP/web/dist"
grep -o 'AdminPanel-[A-Za-z0-9_-]*\.js' "$APP/web/dist/index.html" | head -1

echo '===== [4] .env 幂等补顺丰下单两行 ====='
cd "$APP/server"
grep -q 'CARRIER_SFINTL_API_USERNAME' .env || printf 'CARRIER_SFINTL_API_USERNAME=popsandBox\n' >> .env
grep -q 'CARRIER_SFINTL_ORDER_PRODUCT_CODE' .env || printf 'CARRIER_SFINTL_ORDER_PRODUCT_CODE=INT0255\n' >> .env
echo '.env 顺丰段 OK'

echo '===== [5] 重启应用 ====='
pm2 restart crossbuy-server >/dev/null 2>&1 || pm2 start ecosystem.config.cjs >/dev/null 2>&1
sleep 8
pm2 status | grep crossbuy || true

echo '===== [6] 全链路验证 ====='
curl -s -m 55 -G 'http://127.0.0.1:3001/api/search' --data-urlencode 'q=连衣裙' | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('搜索接口无响应'); sys.exit(0)
qs=d.get('carrierQuotes',[])
from collections import Counter
cnt=Counter(str(q.get('carrierName','')) for q in qs)
print('商品数:', len(d.get('results',[])), '| 报价总数:', len(qs))
for name,n in cnt.items(): print(' ', name, ':', n)
print('推荐渠道:', d.get('carrier',{}).get('carrierName'))"
curl -s -m 15 -o /dev/null -w '首页HTTP状态: %{http_code}\n' http://127.0.0.1:3001/

echo '===== [7] 应用日志尾 ====='
tail -3 /var/log/crossbuy/server.error-0.log 2>/dev/null
cd /tmp && rm -rf "$WORK" 2>/dev/null || true
echo DEPLOY-LATEST-DONE
