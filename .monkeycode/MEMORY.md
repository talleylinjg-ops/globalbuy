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

[4PX FOP 对接规范]
- Date: 2026-09-23
- Context: 接入递四方快递商时破解并验证 FOP 开放平台对接规范
- Category: Build Methods
- Instructions:
  - 网关：https://open.4px.com/router/api/service；公共参数放 URL query，业务参数放 JSON body
  - 签名：按升序 app_key→format→method→timestamp→v 连接参数名与参数值（无=和&），尾拼 body 原文与 appSecret，MD5 小写；access_token/language 不参与签名
  - 运费试算 method：ds.xms.estimated_cost.get；weight 单位是克（g），lump_sum_fee 是 CNY（转 USD 用 cnyToCurrency 与 zjhygj 一致）
  - 响应 data 可能是 JSON 字符串，必须二次 JSON.parse 后再用
  - 响应外层错误分两类：HTTP 500 + ApiException 文本（method 不存在）与 result:0 + errors[]（业务错误）
  - method 名探测法：先发错 method 名，若报「API接口不存在」说明网关层校验 method 先于签名；用官方示例接口 ds.xms.order.create 校验签名（返回业务参数错误即签名正确）
  - B 类客户（4PX 直接客户）access_token 可不传；沙箱域名 open-test.4px.com
  - 4px.js 的 productName 目前显示产品代码（如 S5537），产品中文名对照需产品列表接口（FOP 控制台查，待定）

[顺丰国际 OpenAPI（sf.global 新网关）对接规范]
- Date: 2026-09-26（沙盒全链路打通）
- Context: 破解顺丰国际 api-ifsp.sf.global 网关加密协议并跑通 IUOP_ESTIMATE_FEE 运费试算
- Category: Troubleshooting & Debugging
- Instructions:
  - 网关：正式 https://api-ifsp.sf.global/openapi/api/dispatch，沙箱 http://api-ifsp-sit.sf.global/openapi/api/dispatch；丰桥体系（sfapi/bspgw/sfapi-hk.sf-express.com）与国际客户隔离，勿再尝试
  - token：GET /openapi/api/token?appKey=&appSecret=（expireIn 7200 秒，新 token 使旧 token 失效，模块级缓存提前 5 分钟刷新）
  - dispatch 公共参数放 HTTP 请求头（msgType/appKey/token/timestamp/nonce/signature/lang），body 为 AES 密文 Base64 纯字符串（非 JSON 包装，Content-Type 必须 application/json）
  - 加解密协议=微信企业号同款（官方样例 storage.googleapis.com/ifsp-public/SampleCode/JS.zip）：签名=SHA256([token,timestamp,nonce,密文].sort().join()) hex 小写；AES-256-CBC，key=Base64(aesKey43字符+"=")，iv=key[0:16]；明文=random16+pack4BE(明文长度)+text+appKey，PKCS7 填至 32 字节倍数；响应 apiResultData 同样是密文需解密
  - 运费试算 msgType=IUOP_ESTIMATE_FEE：customerCode/customerType/interProductCode/parcelTotalWeight(KG)/senderInfo(country+postCode 必填)/receiverInfo(同)/paymentInfo(不可省略否则网关 NPE 系统异常，空卡+空tax账号即可)/cargoInfo(对象)/addServiceInfo.serviceCodeList(['EXPRESS'])/parcelInfo
  - 校验顺序：token -> 权限(1004) -> 签名(2001) -> 客户(123149 客户信息不存在) -> 字段(127009 税金结算账号不合法)；paymentInfo 缺失或畸形 -> 业务 code=-1 系统异常
  - 沙盒已验证产品码：INT0014（0.5kg CN->US 报 ¥52 CNY，含住宅附加费）、INT0007（¥55，计费重取整 1kg）；INT0263/INT0255 沙盒无数据返回空 feeInfoList
  - 沙盒凭据（appKey be287d...、customerCode ICRME000SRN93）已配置进 db；生产凭据（appKey 39a47...）待「API 授权」审批通过（IUOP预估费用/快递柜查询/宅配延伸服务 2026-09-23 申请待审批），通过后仅改 baseUrl+appKey+appSecret+aesKey+customerCode
  - 适配器 sfinternational.js + sfcrypto.js；fields：appKey/appSecret/aesKey/customerCode/customerType/serviceCode(=msgType)/baseUrl
