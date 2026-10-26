#!/bin/bash
# 同步 EMS 防错价修复 + signKey 映射到 VPS（源码以 GitHub 为准）
# 用法（宝塔终端执行）：curl -fsSL https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/sync-carrier-fix.sh | bash
exec 2>&1
set -e
BASE='https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master'

echo '===== [1] 同步修复后的源码 ====='
cd /opt/globalbuy/server
cp src/services/carrierStore.js src/services/carrierStore.js.bak-$(date +%m%d%H%M) 2>/dev/null || true
cp src/carriers/ems.js src/carriers/ems.js.bak-$(date +%m%d%H%M) 2>/dev/null || true
curl -fsSL "$BASE/server/src/services/carrierStore.js" -o src/services/carrierStore.js
curl -fsSL "$BASE/server/src/carriers/ems.js" -o src/carriers/ems.js
grep -q 'signKey: process.env.CARRIER_EMS_SIGN_KEY' src/services/carrierStore.js && echo 'carrierStore.js: signKey 映射 OK'
grep -q '缺少目的国收件地址配置' src/carriers/ems.js && echo 'ems.js: 国际防错价防护 OK'

echo '===== [2] 确认 .env 有 EMS 生产参数 ====='
grep -q 'CARRIER_EMS_SIGN_KEY=Vkd1' .env && echo '.env EMS 参数 OK' || echo '.env 缺 CARRIER_EMS_SIGN_KEY（需检查）'

echo '===== [3] 重启应用 ====='
pm2 restart crossbuy-server >/dev/null 2>&1
sleep 8
pm2 status | grep crossbuy || true

echo '===== [4] 验证（EMS 不应出街，4PX/云途正常） ====='
curl -s -m 55 -G 'http://127.0.0.1:3001/api/search' --data-urlencode 'q=连衣裙' | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('搜索接口无响应，请稍后重跑第4步'); sys.exit(0)
qs=d.get('carrierQuotes',[])
ems=[q for q in qs if 'ems' in str(q.get('carrier','')).lower() or 'EMS' in str(q.get('carrierName',''))]
names=[str(q.get('carrierName','')) for q in qs]
print('商品数:', len(d.get('results',[])), '| 报价总数:', len(qs), '| 渠道:', names)
print('EMS:', len(ems), '(应为 0，防错价拦截生效)' if len(ems)==0 else '!! 仍在出街，需检查')
print('推荐渠道:', d.get('carrier',{}).get('carrierName'))"

echo '===== [5] 应用日志尾 ====='
tail -3 /var/log/crossbuy/server.error-0.log 2>/dev/null
echo SYNC-DONE
