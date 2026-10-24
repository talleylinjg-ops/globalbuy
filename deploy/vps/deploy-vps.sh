#!/bin/bash
# CrossBuy VPS 一键部署/更新
# 前置条件：Node 20+、MySQL/MariaDB 已就绪、server/.env 已配置
set -e
cd "$(dirname "$0")/../.."

echo "==> 拉取最新代码（离线包部署时无 git 仓库，自动跳过）"
git pull --ff-only origin master 2>/dev/null || echo "（非 git 环境，跳过拉取）"

echo "==> 安装后端依赖"
(cd server && npm install --omit=dev)

echo "==> 首次部署：导入渠道配置等初始数据"
SETTINGS_COUNT=$(mysql -N -e "SELECT COUNT(*) FROM ${MYSQL_DATABASE:-crossbuy}.settings" 2>/dev/null || echo 0)
if [ "$SETTINGS_COUNT" = "0" ] && [ -f deploy/vps/init-settings.sql ]; then
  mysql "${MYSQL_DATABASE:-crossbuy}" < deploy/vps/init-settings.sql && echo "已导入 init-settings.sql（渠道凭据/后台账号/费率）"
else
  echo "（settings 表已有 $SETTINGS_COUNT 条配置，跳过导入）"
fi

echo "==> 安装前端依赖并构建"
(cd web && npm install && npm run build)

echo "==> 同步前端构建产物到 server 可伺服位置（无操作，server 直接读 web/dist）"

echo "==> 重启服务（pm2）"
mkdir -p /var/log/crossbuy
(pm2 reload deploy/vps/ecosystem.config.cjs --update-env 2>/dev/null || pm2 start deploy/vps/ecosystem.config.cjs)

echo "==> 健康检查"
sleep 2
curl -fsS "http://127.0.0.1:3001/api/health" >/dev/null 2>&1 && echo "API OK" || echo "警告: /api/health 未响应（可能无该路由，请 curl / 检查）"
curl -fsS "http://127.0.0.1:3001/" | head -c 120 && echo " ... 前端 OK"

echo "==> 完成"
