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

[云途 YunTrack OpenAPI 对接规范（已上线）]
- Date: 2026-10-15（/v1/price-trial/get 报价全链路打通）
- Context: 云途适配器按官方规范重写并上线真实报价
- Category: Build Methods
- Instructions:
  - 网关 https://openapi.yunexpress.cn；token POST /openapi/oauth2/token body {grantType:'client_credentials', appId, appSecret}（不带 sourceKey），返回 accessToken（7200s）；响应字段名是 accessToken（曾误写 access_token 拿到 undefined）
  - 签名 HMAC-SHA256(appSecret, 原文)→Base64；POST 原文="body=<紧凑json>&date=<ms>&method=POST&uri=<path>"；GET 原文="date=<ms>&method=GET&uri=<path?query>"（无 body= 键；uri 含 query string）
  - 请求头 token/date/sign/Accept-Language:zh-CN/Content-Type:application/json;charset=utf-8
  - 运费试算 GET /v1/price-trial/get（参数 snake_case）：country_code/weight(KG,3位小数)/weight_unit=KG/package_type(E带电,C普货,F特货)/postal_code/product_group_code/pieces/length/width/height/origin；POST 不存在（0200404001）
  - 响应 result[] 是费用项列表（fee_name E1/E2 等分项），同 product_code+price_name 聚合 convert_amount 求和=产品总价；币种 RMB 经 cnyToCurrency 转 USD；interval_day "3-8" 格式
  - USB2B- 开头是 B2B 大货渠道（香港联邦 1500+ RMB），轻小件场景已过滤；电商常用产品：THZXR 特惠带电/WMTHZXR 74.5 RMB 8-12天/BKZXR 标快 127 RMB 3-8 天（0.5kg 美国）
  - 路由语义（实测）：不存在路径无 token 返回 401 0200401001（网关统一过滤器）、带 token /v1/* 报 0200404001、/openapi/* 报 403 0200403101——均=路径不存在，云途无 IP 白名单；0200401002 令牌无效=签名错或 token 字段没取对
  - 文档站 open.yunexpress.cn 是 SPA 且门户 API 被 nginx 挡（全 fallback HTML）；归档文档 GitHub yihao97/yunexpress-api-docs 可直接拉 raw md（含全部接口参数表）；业务参数错误码 0206000x 目的入参校验
  - yuntrack.js 已上线（f3f9a52）：quote 返回 10 产品数组，过滤 B2B；carrierName.yuntrack 词条与 12 条产品英文映射已补 en/es.json + carrier.js

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
  - 2026-10-13 交叉验证：SIT 与生产凭据严格隔离（互打 1005 App is not exist）；生产凭据 token 通、dispatch 1004 没权限=「IUOP预估费用」生产授权仍未批（与 9/23 申请待审批吻合）；SIT 凭据服务已授权（参数校验链全部正常应答），但 10/13 起任何真实产品码（INT0014/INT0262/INT0001）查价即业务 code=-1 系统异常（9/26 曾正常报价）——SIT 计费配置退化，需顺丰侧修复；崩溃点定位法：空biz→逐字段累加，customerCode→senderInfo→receiverInfo 依次报「客户编码必填/寄件方国家必填/到件方邮编必填」，postCode 过后即崩=查价环节
  - 顺丰凭据 10/13 曾因 10/9 存储事故丢失（carriers 里仅剩空壳），已从历史记录恢复写回 MySQL settings（appKey 39a47.../customerCode 21012844/baseUrl api-ifsp.sf.global）；顺丰生产网关是 https://api-ifsp.sf.global（历史上曾误记 api.ifsp.sf.global）
  - 2026-10-14 顺丰技术答复：直接生产联调（沙箱配置与生产不一致）；电商业务用 msgType=IPE_ESTIMATE_FEE（预估总运费，菜单 218）；文档站 openapi-portal.sf.global 内容 API=/openapi/console/noLogin/online/doc/{menuId}/zh-CN（返回签名 GCS URL 再下载正文）、菜单树=/doc/menu/list；接口清单：IPE_ESTIMATE_FEE(218 电商预估总运费)/IECS_QUERY_WEIGHT_FREIGHT(110 重量及运费查询-电商预付)/IOMS_QUERY_CHARGE(133 计费重和费用项查询-月结)/IUOP_ESTIMATE_FEE(85 国际快递预估运费)；1004 的解法=登录 http://openapi.sf.global/ →应用列表→详情→关联 API（181 关联API指引），需门户账号登录自助操作，已请用户关联 IPE_ESTIMATE_FEE；IPE_ESTIMATE_FEE 参数与 IUOP 版本基本一致，addServiceInfo.serviceCodeList 必填、paymentInfo/cargoInfo 非必填，电商产品码示例 INT0263
  - 适配器 sfinternational.js + sfcrypto.js；fields：appKey/appSecret/aesKey/customerCode/customerType/serviceCode(=msgType)/baseUrl

[前端静态快照降级层（前台浏览零依赖后端）]
- Date: 2026-09-28
- Context: 借鉴 liangdu-asia 镜像站架构（HTML快照/静态镜像/仅动态回源），为 CrossBuy 实现「后端不可达时线上站 100% 可浏览」
- Category: Operations & Deployment
- Instructions:
  - 构建期抓取后端响应生成快照：bash web/scripts/gen-demo-snapshots.sh [后端地址]，输出 web/public/demo/{meta,search-wireless-earbuds,search-phone-case}.json；后端有数据变化时重新执行即可刷新
  - 降级逻辑在 web/src/api.js：GET 类请求 8s 超时失败自动读本地快照并标记 demo:true；搜索词按关键词匹配快照（含 case/壳 → phone-case，其余 → earbuds）；POST /api/combine 失败降级为 {demo:true}（CombineBar 显示演示提示）
  - 演示模式 UI：App.jsx isDemoMode = results.demo || meta.demo，顶部显示 banner.demoMode 横幅（三语）
  - 新增公开演示数据接口时，记得同步更新 gen-demo-snapshots.sh 并重跑，否则线上降级数据过期

[预渲染 SEO 落地页构建链]
- Date: 2026-10-04
- Context: 静态落地页 /p/<slug>/ 与原站 en 结果页整页复刻（用户要求「静态站点与原站完全一致」）
- Category: Build Methods
- Instructions:
  - 构建链：npm run build = vite build && node scripts/prerender-seo-pages.mjs（脚本在 vite 之后运行，从 dist/index.html 提取 CSS 哈希文件名，并把 public/p 拷入 dist/p）
  - 数据源 web/public/demo/search-*.json（快照）；关键词取 inputKeyword（英文），勿用 translatedKeyword（中文）
  - 快照图片路径必须加 /demo 前缀（api.js rewriteDemoImages 同规则），否则落地页图片 404；改页面模板后只需重跑 npm run build
  - 页面结构复刻原站：header(lang-switcher/logo/tagline)/SearchPanel/demo-banner/SettingsPanel(静态只读)/CarrierPicker(details 折叠)/results-head/sort-bar/商品卡(ship-tiers 三档+score-bar+breakdown 折叠)/FAQ/footer；词条同步自 src/locales/en.json（脚本内 T 对象）
  - pickShippingTiers 抽在 web/src/utils/shipping.js，App 与预渲染脚本共用，改算法只改一处
  - 渠道中文名→英文映射在 web/src/utils/carrier.js（4PX 递四方/顺丰国际/华源 别名匹配 + t('carrierName.*')）
  - 目的国全球清单在 server/src/data/tax.js（CONTINENT_GROUPS/GLOBAL_COUNTRIES/GLOBAL_CURRENCIES：重点 32 国置顶+亚洲/欧洲/北美/南美/大洋洲/非洲分组，207 国 145 币）；meta 接口输出全量；未配税则国家 getTaxRule 兜底美国税则
  - SettingsPanel 国家名本地化：i18n country.* 词条优先，其余走 Intl.DisplayNames；lang 由 App 传 prop（useI18n 是组件独立 state，多实例不同步）

[搜索接口 3 秒假象排查法与后端提速要点]
- Date: 2026-10-06
- Context: 优化「访客尽快拿到价格和快递选项」时排查 warm 搜索固定 3s
- Category: Troubleshooting & Debugging
- Instructions:
  - 后端 node --watch 的热重载有假象：touch 后日志可能仍打旧进程输出，确认方式是看进程 PID 是否变化或直接 kill+重启（后台终端 npm run dev:server）
  - curl 计时定位慢源分段：`-w 'connect:%{time_connect} start:%{time_starttransfer} total:%{time_total}'`；localhost connect 慢 3s 属 curl/DNS 层假象，换 127.0.0.1 复测
  - er-api.com 汇率接口 node fetch 直连 ~300ms 可达；curl 直测 5s 是 curl 层差异，勿据 curl 结论判定外呼慢
  - 后端搜索提速已落地：searchService 询价与平台搜索并行；carrierService per-channel 3s 硬超时；currency.js fx 失败 10 分钟冷却（否则外呼失败 updatedAt 不更新导致每次搜索重试）；warm 搜索应 <20ms，首搜冷启动含 fx+4PX 询价约 1-3s
  - 前端 api.js 降级层提速：GET 超时 2.5s 快速失败 → 全局 backendDown 标记（后续 0ms 走快照）→ 60s 一次 probeBackend 探活恢复；模块加载即预热 meta+默认快照

[渠道真实凭据缺失现状与快照降级链]
- Date: 2026-10-07
- Context: 重抓快照时发现渠道报价全空，逐层排查定位凭据缺失
- Category: Environment Configuration
- Instructions:
  - 渠道凭据存储优先级：admin_db.json 的 carriers 配置 > .env 静态配置（CARRIER_* 变量）> 内置默认；排查用 python 检查 .env 值长度（勿打印真实值）与 admin_db.json 的 keys
  - 当前现状（2026-10-08）：.env 全部 CARRIER_* 为空、admin_db.json carriers 无凭据键（仅顺丰 sfintl 有生产凭据）；yuntrack/4px/dhl/ups/fedex 全部未配置
  - EMS 已对接《中小电商企业接口规范 V2.7》（4cf0c0d）：适配器按公共信封（apiCode/senderNo/authorization/timeStamp/logitcsInterface）封装，报价走 050005 预估邮费（返回人民币经 cnyToCurrency 转 USD）；凭据键 CARRIER_EMS_SENDER_NO/CARRIER_EMS_AUTHORIZATION/CARRIER_EMS_BASE_URL 等 7 个已在 .env 占位；**网关地址 V2.7 文档不含，需向邮政接入函索取**；050005 产品代码表均为国内产品（默认电商标快 115104300000691），跨境段资费待邮政国际产品接入
  - EMS 网关实测要点（2026-10-09）：地址 https://api.ems.com.cn/amp-prod-api/f/amp/api/open、POST x-www-form-urlencoded（logitcsInterface 传 JSON 字符串）；senderNo 必须用客户代码 C1100296646500（用协议客户号 1100248949682 会报「客户未关联API接口」）；白名单层之前未强制 sign 签名（signKey 已存 .env 备用）；当前阻塞：logitcsInterface 需加密（网关报「参数据加密错误」），已排除 AES-128/192 ECB/CBC、3DES、DES、SM4 多变体，沙箱密文可解密进入业务校验层，待用户提供「参数转报文」密文样本锁定算法；沙箱测试已通到 weight 格式校验（retCode B0001）
  - VPS 部署包已就绪（904d064）：deploy/vps/（pm2 + nginx 模板 + deploy-vps.sh + VPS_DEPLOY.md）；Express 生产伺服 web/dist 单端口方案（/api 优先）；SEO 收尾含 Product AggregateRating/LCP preload/llms 12 页清单
  - 沙箱出口对 github.com/api.cloudflare.com 的 HTTPS 可能间歇故障（国内站点正常）——push 失败时先 curl github.com 判断网络，恢复后 git push origin master 重试即可，本地提交在 904d064
  - 无真实报价时搜索链路 fallback 到 data/shipping.js 静态费率表（carrier 字段=「云途专线」，estimate 模式产品名带「经济专线/标准快递/特快专递」后缀）——快照与演示数据因此带这两个中文名，英文界面靠 carrier.js/预渲染脚本映射为 YunExpress Line/Economy Line
  - 渠道 API 失败时 fetchQuotes 返回空不写缓存（每 30min 内会重试真实 API）；顺丰凭据在但服务未授权（1004），quote 超时 3s 由 per-channel 硬超时兜住
  - 若渠道 API 凭据重新可用：直接重跑 web/scripts/gen-demo-snapshots.sh 即可让快照带上真实多渠道报价

[4PX 凭据存储与配置生效机制]
- Date: 2026-10-12
- Context: 4PX 凭据丢失事故排查（9/23 后台配置的三件套被 10/9 存储初始化覆盖）
- Category: Environment Configuration
- Instructions:
  - carriers 真实存储在 MySQL settings 表 k='carriers'（JSON 数组）；server/data/admin_db.json 是 9/8 迁移前的遗留文件，其 carriers 段已废弃，勿作为排查依据
  - .env 的 CARRIER_* 键修改后 node --watch 不会自动重启（不监听 .env），必须 touch server/src/services/carrierService.js 或 carrierStore.js 触发重启才生效
  - ensureSeeded 补齐逻辑「不覆盖非空值」，但首次从 seedFromEnv 初始化会用空 env 值覆盖整库（已发生一次凭据丢失事故）；改 carrierStore 结构前先确认 settings.carriers 现有值
  - 4PX 真实报价耗时约 6 秒，carrierService per-job 超时已从 3s 放宽到 12s；报价缓存 TTL 30 分钟，全失败空结果也会被缓存，调试时需 touch 清缓存
  - MySQL log_bin=OFF，binlog 未开启，数据误覆盖无法从 binlog 恢复
