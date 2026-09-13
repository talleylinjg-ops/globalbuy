# CrossBuy 部署指南

## 架构

```
浏览器 ──> nginx (VPS:80/443)
            ├── /            → web/dist 静态文件（React 前端）
            ├── /api/        → 127.0.0.1:3001（Express 后端）
            └── /images/     → server/public/images
                    │
                    └── MariaDB（本机 crossbuy 库）
```

前端与后端同域部署在 VPS，无需配置 VITE_API_BASE，无跨域问题。
Cloudflare Pages（globalbuy.pages.dev）为备用静态入口，如使用它，
需在其构建环境变量中设置 `VITE_API_BASE=https://<你的VPS域名>` 后重新构建。

## VPS 从零上线（约 10 分钟）

### 1. 准备
- 一台 Ubuntu 22.04 / 24.04 VPS（最低 1 核 1G，推荐 2 核 2G）
- 域名一个（可选，IP 也可用），A 记录指到 VPS IP

### 2. 上传代码
```bash
git clone https://github.com/talleylinjg-ops/globalbuy.git
cd globalbuy
```

### 3. 一键初始化（root 执行）
```bash
# 有域名时带上 SERVER_NAME，没有就省略
SERVER_NAME=shop.example.com bash deploy/vps-setup.sh
```

脚本自动完成：系统依赖 → Node 22 → MariaDB 建库建用户（随机密码）→
后端依赖安装与 .env 生成 → 前端构建 → systemd 服务 → nginx 反代。
结束时打印数据库密码，请保存。

### 4. 验证
```bash
systemctl status crossbuy-backend     # 后端运行中
curl http://127.0.0.1:3001/api/health # 健康检查
curl http://127.0.0.1/                # 前端页面
```

### 5. HTTPS（有域名时）
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d shop.example.com
```

## 日常运维

| 操作 | 命令 |
|------|------|
| 查看后端日志 | journalctl -u crossbuy-backend -f |
| 重启后端 | systemctl restart crossbuy-backend |
| 更新代码 | git pull && cp -r server web /opt/crossbuy/ && cd /opt/crossbuy/server && npm install --omit=dev && cd ../web && npm install && npm run build && systemctl restart crossbuy-backend |
| 备份数据库 | mysqldump -u crossbuy -p crossbuy > backup-$(date +%F).sql |

## 安全清单（上线后立即执行）

1. 后台默认账号 admin/admin123 —— 登录 #/admin 修改密码
2. 快递商凭据在后台「系统设置 -> 快递商」里配置，存数据库，无需改代码
3. MariaDB 只监听 localhost（默认即如此），勿开放 3306 到公网
4. 防火墙只放行 22/80/443：`ufw allow 22,80,443/tcp && ufw enable`

## 本地开发环境（沙箱/本机）

```bash
# 数据库
service mariadb start

# 后端（端口 3001）
cd server && npm install && cp .env.example .env && npm run dev

# 前端（端口 5173，vite 代理 /api 到 3001）
cd web && npm install && npm run dev
```
