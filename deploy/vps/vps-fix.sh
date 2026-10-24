#!/bin/bash
# CrossBuy 一键修复部署：解封 SSH + MySQL + 应用 + nginx 反代
# 用法（宝塔终端执行）：curl -fsSL https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/vps-fix.sh | bash
exec 2>&1

echo '===== [1] 诊断并解除 SSH 封禁 ====='
MYIP=212.107.28.56
command -v fail2ban-client >/dev/null && {
  fail2ban-client status 2>/dev/null
  fail2ban-client status sshd 2>&1 | tail -8
  fail2ban-client set sshd unbanip $MYIP 2>&1
}
grep -n "$MYIP" /etc/hosts.deny 2>/dev/null && { sed -i "\#$MYIP#d" /etc/hosts.deny; echo 'hosts.deny 已清理'; }
nft list ruleset 2>/dev/null | grep "$MYIP" | head -5
iptables-save 2>/dev/null | grep "$MYIP" | head -5
grep -rn "$MYIP" /www/server/panel/data/ 2>/dev/null | grep -v '\.db:' | head -5

echo '===== [2] MySQL root 密码与建库 ====='
if ! mysql -uroot -pCb2026Mysql9z -e "SELECT 1;" >/dev/null 2>&1; then
  echo 'root 密码不对，强制重设（bt 7）'
  printf 'Cb2026Mysql9z\nCb2026Mysql9z\n' | timeout 60 bt 7 | tail -2
fi
mysql -uroot -pCb2026Mysql9z -e "CREATE DATABASE IF NOT EXISTS crossbuy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'crossbuy'@'localhost' IDENTIFIED BY 'Cb2026Cross9z'; GRANT ALL PRIVILEGES ON crossbuy.* TO 'crossbuy'@'localhost'; FLUSH PRIVILEGES; SELECT '数据库与账号就绪';" | tail -1

echo '===== [3] 应用部署 ====='
cd /opt/globalbuy || { echo '未找到 /opt/globalbuy，请先上传部署包'; exit 1; }
if [ ! -f server/.env ]; then
cat > server/.env <<'ENVEOF'
PORT=3001
NODE_ENV=production
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=crossbuy
MYSQL_PASSWORD=Cb2026Cross9z
MYSQL_DATABASE=crossbuy
DEFAULT_DEST_COUNTRY=US
DEFAULT_CURRENCY=USD
SERVICE_FEE_RATE=0.05
PAYMENT_FEE_RATE=0.03
PROFIT_RATE=0.5
ENVEOF
fi
echo 'env 就绪'

SC=$(mysql -ucrossbuy -pCb2026Cross9z -N -e "SELECT COUNT(*) FROM crossbuy.settings" 2>/dev/null || echo 0)
echo "settings rows: $SC"
if [ "$SC" = "0" ]; then
  mysql -ucrossbuy -pCb2026Cross9z crossbuy < deploy/vps/init-settings.sql 2>/dev/null && echo '渠道配置已导入（顺丰/PDD凭据）'
fi

cd server
NC=$(ls node_modules 2>/dev/null | wc -l)
echo "node_modules entries: $NC"
if [ "$NC" -lt 40 ]; then
  npm install --omit=dev 2>&1 | tail -2
  echo "安装后: $(ls node_modules 2>/dev/null | wc -l)"
fi

cd /opt/globalbuy
mkdir -p /var/log/crossbuy
pm2 delete crossbuy-server 2>/dev/null
pm2 start deploy/vps/ecosystem.config.cjs
pm2 save
sleep 5
pm2 status | grep crossbuy

echo '===== [4] 应用健康检查 ====='
sleep 2
curl -s -o /dev/null -w '应用 3001 / -> %{http_code}\n' http://127.0.0.1:3001/

CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ 2>/dev/null)
echo '===== [5] nginx 反代 ====='
if [ "$CODE" = "200" ]; then
  mkdir -p /www/server/panel/vhost/nginx
  cat > /www/server/panel/vhost/nginx/crossbuy.conf <<'NGXEOF'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGXEOF
  nginx -t 2>&1 && nginx -s reload 2>&1 && echo 'nginx 已配置并重载'
  sleep 2
  curl -s -o /dev/null -w '公网 80 / -> %{http_code}\n' http://127.0.0.1:80/
else
  echo "应用未就绪(code=$CODE)，最近日志："
  pm2 logs crossbuy-server --lines 12 --nostream 2>/dev/null | tail -14
fi
echo FIX-DONE
