#!/usr/bin/env bash
# CrossBuy VPS 一键初始化（Ubuntu 22.04 / 24.04，需 root）
# 用法：把整个仓库上传到 VPS 后，以 root 执行 bash deploy/vps-setup.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/crossbuy"

echo "==> 1/7 系统依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx mariadb-server

echo "==> 2/7 Node.js 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> 3/7 数据库"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
mysql -e "CREATE DATABASE IF NOT EXISTS crossbuy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'crossbuy'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON crossbuy.* TO 'crossbuy'@'localhost'; FLUSH PRIVILEGES;"
systemctl enable --now mariadb

echo "==> 4/7 代码与依赖"
mkdir -p "${APP_DIR}"
cp -r "${REPO_DIR}/server" "${REPO_DIR}/web" "${APP_DIR}/"
cd "${APP_DIR}/server"
[ -f .env ] || cp .env.example .env
sed -i "s/^MYSQL_PASSWORD=.*/MYSQL_PASSWORD=${DB_PASS}/" .env
npm install --omit=dev

echo "==> 5/7 前端构建（API 同源走 nginx，无需配置 VITE_API_BASE）"
cd "${APP_DIR}/web"
npm install
npm run build

echo "==> 6/7 systemd 服务"
sed "s#__APP_DIR__#${APP_DIR}#g" "${REPO_DIR}/deploy/crossbuy-backend.service" > /etc/systemd/system/crossbuy-backend.service
systemctl daemon-reload
systemctl enable --now crossbuy-backend

echo "==> 7/7 nginx（静态前端 + /api 反代）"
sed "s#__SERVER_NAME__#${SERVER_NAME:-_}#g" "${REPO_DIR}/deploy/nginx-crossbuy.conf" > /etc/nginx/sites-available/crossbuy
ln -sf /etc/nginx/sites-available/crossbuy /etc/nginx/sites-enabled/crossbuy
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=============================================="
echo " 部署完成"
echo " 站点根目录: ${APP_DIR}/web/dist"
echo " 数据库密码: ${DB_PASS}   （已写入 ${APP_DIR}/server/.env，请妥善保管）"
echo " 后台登录:   http://<你的服务器IP或域名>/#/admin（默认 admin/admin123，请立即修改）"
echo "=============================================="
