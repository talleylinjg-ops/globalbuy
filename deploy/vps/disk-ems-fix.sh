#!/bin/bash
# CrossBuy 磁盘清理 + MySQL 恢复 + EMS 全链路修复
# 用法（宝塔终端执行）：curl -fsSL https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/disk-ems-fix.sh | bash
exec 2>&1

echo '===== [0] 磁盘大头排查 ====='
df -h / | tail -1
du -sh /www/wwwlogs /www/server/data /www/Recycle_bin /var/log /www/server/panel/logs /tmp 2>/dev/null | sort -rh | head -8

echo '===== [1] 清空网站访问日志（保留文件只清内容） ====='
find /www/wwwlogs -name '*.log' -size +10M -exec truncate -s 0 {} \; 2>/dev/null
du -sh /www/wwwlogs 2>/dev/null

echo '===== [2] 清空宝塔回收站 ====='
rm -rf /www/Recycle_bin/* 2>/dev/null && echo '回收站已清空'

echo '===== [3] 系统日志收缩到 50M + 包管理缓存 ====='
journalctl --vacuum-size=50M 2>/dev/null | tail -1
yum clean all 2>/dev/null; npm cache clean --force 2>/dev/null
truncate -s 0 /var/log/mysqld.log 2>/dev/null

echo '===== [4] 清理后磁盘 ====='
df -h / | tail -1

echo '===== [5] 启动 MySQL ====='
systemctl restart mysqld 2>/dev/null || /etc/init.d/mysqld start 2>&1 | tail -2
sleep 6
if ss -tlnp | grep -q :3306; then
  echo 'MySQL 3306 已监听'
  mysql -uroot -pCb2026Mysql9z -N -e "PURGE BINARY LOGS BEFORE NOW();" 2>/dev/null && echo 'binlog 已清理'
  mysql -uroot -pCb2026Mysql9z -N -e "SELECT COUNT(*) FROM information_schema.files WHERE file_name LIKE '%bin%';" 2>/dev/null
else
  echo 'MySQL 仍未启动，日志尾：'
  tail -8 /var/log/mysqld.log 2>/dev/null
fi
df -h / | tail -1

echo '===== [6] EMS 生产参数落库 ====='
cd /opt/globalbuy/server || exit 1
node update-ems-prod.mjs 2>&1 | tail -1

echo '===== [7] 重启应用 ====='
pm2 restart crossbuy-server >/dev/null 2>&1
sleep 6
pm2 status | grep crossbuy

echo '===== [8] 全链路验证 ====='
curl -s -m 55 -G 'http://127.0.0.1:3001/api/search' --data-urlencode 'q=连衣裙' | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('搜索接口无响应（应用可能仍在重连数据库，请稍后重跑本脚本第8步）'); sys.exit(0)
qs=d.get('carrierQuotes',[])
ems=[q for q in qs if 'EMS' in str(q.get('carrierName','')) or 'ems' in str(q.get('carrier','')).lower()]
sf=[q for q in qs if '顺丰' in str(q.get('carrierName',''))]
print('商品数:', len(d.get('results',[])), '| 报价总数:', len(qs))
print('EMS:', len(ems), json.dumps(ems[:2], ensure_ascii=False)[:250] if ems else '(无)')
print('顺丰:', len(sf), json.dumps(sf[:2], ensure_ascii=False)[:200] if sf else '(无)')
print('推荐渠道:', d.get('carrier',{}).get('carrierName'))"

echo '===== [9] 应用日志尾 ====='
tail -4 /var/log/crossbuy/server.error-0.log 2>/dev/null
echo ALL-DONE
