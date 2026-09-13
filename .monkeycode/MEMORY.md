# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Cloudflare Pages 部署流程]
- Date: 2026-09-13
- Context: 首次部署前端到 Cloudflare Pages（项目 globalbuy）
- Category: Operations & Deployment
- Instructions:
  - 部署目标：https://globalbuy.pages.dev/（production 分支 master）
  - 凭据经会话内联 export CLOUDFLARE_API_TOKEN 传递（用户在对话中提供，勿写入任何文件；每次 bash 调用是独立 shell，export 必须与 wrangler 命令同一条执行）
  - wrangler 4.131.1 部署新版 Cloudflare Pages（并入 Workers）会失败并提示加 --force：仅 `pages project create` 需要 `--force`，项目已存在后 deploy 等命令直接执行，勿再加 --force
  - 部署命令：`wrangler pages deploy dist --project-name globalbuy --branch master --commit-dirty=true`（在 /workspace/web 下）
  - 沙箱网络无法直接访问 pages.dev 域名（connection timed out），验证部署状态用 `wrangler pages deployment list --project-name globalbuy`
  - SEO 占位域名已写死为 globalbuy.pages.dev（index.html canonical/OG/sitemap/robots），绑自定义域名后需同步修改

[GitHub 推送]
- Date: 2026-09-13
- Context: 用户要求推送代码到 GitHub
- Category: Workflow & Collaboration
- Instructions:
  - 仓库：https://github.com/talleylinjg-ops/globalbuy.git（master 直推）
  - 提交信息用中文，末尾带 Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>

[前端独立部署路线（用户选定）]
- Date: 2026-09-13
- Context: 讨论生产部署方案时确定
- Category: Operations & Deployment
- Instructions:
  - 前端：静态站托管（已上 Cloudflare Pages），API 地址构建时经 VITE_API_BASE 注入（web/.env.example 有说明）
  - 后端：Node + Express + MariaDB，尚无公网地址——线上前端未配 VITE_API_BASE 前搜索/下单不可用，需用户提供后端公网部署位置后重建重发
