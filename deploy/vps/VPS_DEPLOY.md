# CrossBuy VPS 部署指南

从 Cloudflare Pages 迁移到自有 VPS（单端口方案：Node 同时伺服 API 与前端静态文件）。

## 1. 服务器准备

```bash
# Node 20+ 与 pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# MySQL / MariaDB（已有可跳过）
sudo apt-get install -y mariadb-server
```

## 2. 拉取代码与配置

```bash
git clone https://github.com/talleylinjg-ops/globalbuy.git
cd globalbuy
```

创建 `server/.env`（参考 `server/.env.example`），必填项：

```ini
PORT=3001
DB_HOST=127.0.0.1
DB_USER=crossbuy
DB_PASSWORD=你的数据库密码
DB_NAME=crossbuy

# 渠道凭据（顺丰/EMS/4PX 等，按需填写）
CARRIER_EMS_SENDER_NO=C1100296646500
CARRIER_EMS_AUTHORIZATION=...
CARRIER_EMS_BASE_URL=https://api.ems.com.cn/amp-prod-api/f/amp/api/open
CARRIER_EMS_SIGN_KEY=...
CARRIER_EMS_SENDER_ADDRESS=福建省厦门市思明区湖滨南路
```

注意：
- VPS 公网 IP 需加入邮政 EMS 协议客户 IP 白名单
- 前端默认走同源 `/api`（Vite 构建时若设了 `VITE_API_BASE` 会指向绝对地址；VPS 同域部署无需设置，反代由 Nginx/Node 本身承担）

## 3. 一键部署

```bash
chmod +x deploy/vps/deploy-vps.sh
./deploy/vps/deploy-vps.sh
```

脚本执行：git pull → 后端依赖 → 前端构建（含 12 个 SEO 落地页预渲染）→ pm2 启动/重载 → 健康检查。

## 4. Nginx + HTTPS（对外 80/443）

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp deploy/vps/nginx.conf.example /etc/nginx/sites-available/crossbuy.conf
# 编辑 server_name 为你的域名
sudo nano /etc/nginx/sites-available/crossbuy.conf
sudo ln -s /etc/nginx/sites-available/crossbuy.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

无域名时可直接访问 `http://<VPS公网IP>:3001`（Node 已同源伺服前端与 API）。

## 5. 常用运维命令

```bash
pm2 status                     # 进程状态
pm2 logs crossbuy-server       # 实时日志
pm2 restart crossbuy-server    # 重启
pm2 save && pm2 startup        # 开机自启
```

## 6. 与 Cloudflare Pages 的关系

- 迁移后 Cloudflare Pages 仍在线作为过渡；切换 DNS 到 VPS 即完成迁移
- 快照降级链（后端不可达时前端读静态快照）在 VPS 同源部署下自然失效——前端与 API 同源，API 始终可达
- SEO：sitemap/canonical/OG 当前指向 `globalbuy.pages.dev`，切换域名后需全局替换为正式域名（一处常量：`web/scripts/prerender-seo-pages.mjs` 的 `SITE` 与 `web/index.html`）
