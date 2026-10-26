#!/bin/bash
# CrossBuy EMS 修复：重启 MySQL + 更新 EMS 生产参数 + 重启应用 + 验证
# 用法（宝塔终端执行）：curl -fsSL https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/ems-fix.sh | bash
exec 2>&1

echo '===== [1] 重启 MySQL ====='
systemctl restart mysqld 2>/dev/null || /etc/init.d/mysqld restart 2>&1 | tail -2
sleep 5
if ss -tlnp | grep -q :3306; then
  echo 'MySQL 3306 已监听'
else
  echo '警告：3306 仍未监听，最近日志：'
  tail -10 /var/log/mysqld.log 2>/dev/null
  echo '提示：请检查宝塔首页 MySQL 状态，以及磁盘是否写满（df -h）'
  df -h / | tail -1
fi

echo '===== [2] 更新 EMS 生产参数 ====='
cd /opt/globalbuy/server || exit 1
node update-ems-prod.mjs 2>&1 | tail -2

echo '===== [3] 重启应用 ====='
pm2 restart crossbuy-server >/dev/null 2>&1
sleep 6
pm2 status | grep crossbuy

echo '===== [4] EMS 报价验证 ====='
curl -s -m 55 -G 'http://127.0.0.1:3001/api/search' --data-urlencode 'q=连衣裙' | python3 -c "
import json,sys
d=json.load(sys.stdin)
qs=d.get('carrierQuotes',[])
ems=[q for q in qs if 'EMS' in str(q.get('carrierName','')) or 'ems' in str(q.get('carrier','')).lower()]
sf=[q for q in qs if '顺丰' in str(q.get('carrierName',''))]
print('报价总数:', len(qs))
print('EMS:', len(ems), json.dumps(ems[:2], ensure_ascii=False)[:250] if ems else '(无)')
print('顺丰:', len(sf), json.dumps(sf[:2], ensure_ascii=False)[:200] if sf else '(无)')
print('推荐渠道:', d.get('carrier',{}).get('carrierName'))"

echo '===== [5] 应用日志尾 ====='
tail -5 /var/log/crossbuy/server.error-0.log 2>/dev/null
echo EMS-FIX-DONE
