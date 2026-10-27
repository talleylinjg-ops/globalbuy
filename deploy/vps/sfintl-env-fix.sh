#!/bin/bash
# 顺丰国际凭据通过 .env seed 链路生效（绕开 node 脚本直连 MySQL 的权限问题）
# 用法（宝塔终端执行）：curl -fsSL https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/sfintl-env-fix.sh | bash
exec 2>&1
BASE='https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master'

echo '===== [1] 同步最新 carrierStore.js 与 sfinternational.js（sfintl seed 映射+token 并发修复） ====='
cd /opt/globalbuy/server
curl -fsSL "$BASE/server/src/services/carrierStore.js" -o src/services/carrierStore.js
curl -fsSL "$BASE/server/src/carriers/sfinternational.js" -o src/carriers/sfinternational.js
grep -q 'CARRIER_SFINTL_APP_KEY' src/services/carrierStore.js && echo 'carrierStore.js: sfintl seed 映射 OK'
grep -q 'tokenInflight' src/carriers/sfinternational.js && echo 'sfinternational.js: token 并发去重 OK'

echo '===== [2] .env 追加顺丰国际凭据（幂等） ====='
if grep -q 'CARRIER_SFINTL_APP_KEY' .env; then
  echo '.env 已有顺丰凭据，跳过'
else
  cat >> .env << 'EOF'

# SF International (顺丰国际开放平台 测试环境)
CARRIER_SFINTL_APP_KEY=cdd169d87a4698d314754a79f180308a
CARRIER_SFINTL_APP_SECRET=69fb3e868a45d0bdd5b0de0ea1db6ece
CARRIER_SFINTL_AES_KEY=oI1YdU1cb1YC70HVjZRa3wXBLUsrIUYr5lDh0gFrMbe
CARRIER_SFINTL_CUSTOMER_CODE=ICRME000SRN93
CARRIER_SFINTL_CUSTOMER_TYPE=2
CARRIER_SFINTL_PRODUCT_CODES=INT0014,INT0020,INT0263,INT0131
CARRIER_SFINTL_BASE_URL=http://api-ifsp-sit.sf.global
EOF
  echo '.env 已追加顺丰凭据'
fi

echo '===== [3] 重启应用 ====='
pm2 restart crossbuy-server >/dev/null 2>&1
sleep 8
pm2 status | grep crossbuy || true

echo '===== [4] 全链路验证（顺丰应出街，EMS 保持拦截） ====='
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
else: print('顺丰未出街，看下面日志')
print('推荐渠道:', d.get('carrier',{}).get('carrierName'))"

echo '===== [5] 应用日志尾 ====='
tail -4 /var/log/crossbuy/server.error-0.log 2>/dev/null
echo SFINTL-ENV-DONE
