#!/bin/bash
# 顺丰国际凭据落库 + 重启 + 全链路验证
# 用法（宝塔终端执行）：curl -fsSL https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/sfintl-fix.sh | bash
exec 2>&1
BASE='https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master'

echo '===== [1] 同步 store 修复与落库脚本 ====='
cd /opt/globalbuy/server
cp src/services/carrierStore.js src/services/carrierStore.js.bak-$(date +%m%d%H%M) 2>/dev/null || true
curl -fsSL "$BASE/server/src/services/carrierStore.js" -o src/services/carrierStore.js
curl -fsSL "$BASE/server/update-sfintl-prod.mjs" -o update-sfintl-prod.mjs
grep -q "data.code" src/services/carrierStore.js && echo 'carrierStore.js: upsert 按 code 匹配修复 OK'

echo '===== [2] 顺丰凭据落库 ====='
node update-sfintl-prod.mjs

echo '===== [3] 重启应用 ====='
pm2 restart crossbuy-server >/dev/null 2>&1
sleep 8
pm2 status | grep crossbuy || true

echo '===== [4] 全链路验证（顺丰/4PX/云途均应出街，EMS 防错价拦截中） ====='
curl -s -m 55 -G 'http://127.0.0.1:3001/api/search' --data-urlencode 'q=连衣裙' | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('搜索接口无响应，请稍后重跑第4步'); sys.exit(0)
qs=d.get('carrierQuotes',[])
from collections import Counter
cnt=Counter(str(q.get('carrierName','')) for q in qs)
print('商品数:', len(d.get('results',[])), '| 报价总数:', len(qs))
for name,n in cnt.items(): print(' ', name, ':', n)
sf=[q for q in qs if '顺丰' in str(q.get('carrierName',''))]
if sf: print('顺丰示例:', json.dumps([{k:sf[0].get(k) for k in ('productName','priceUsd')}], ensure_ascii=False))
print('推荐渠道:', d.get('carrier',{}).get('carrierName'))"

echo '===== [5] 应用日志尾 ====='
tail -3 /var/log/crossbuy/server.error-0.log 2>/dev/null
echo SFINTL-DONE
