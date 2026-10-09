#!/bin/bash
# CrossBuy VPS 一键部署/更新
# 前置条件：Node 20+、MySQL/MariaDB 已就绪、server/.env 已配置
set -e
cd "$(dirname "$0")/../.."

echo "==> 拉取最新代码"
git pull --ff-only origin master

echo "==> 安装后端依赖"
(cd server && npm install --omit=dev)

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
