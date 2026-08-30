# CrossBuy Compare — 中国电商跨境比价代购系统

通过官方联盟/开放平台 API 搜索淘宝、天猫、京东、拼多多、1688 的商品，归一化商品数据，计算含国际快递运费与关税增值税的**真实到手总成本**，再按价格、评分、销量、时效、平台信誉加权排序推荐给海外买家。

## 核心能力

| 能力 | 说明 |
|------|------|
| 多平台聚合搜索 | 并行调用淘宝联盟、京东联盟、多多客、1688 分销客（未配置密钥时自动降级为演示数据源） |
| 多语言关键词 | 英文/西班牙语等关键词自动翻译为中文后搜索，商品标题反向翻译回英文展示 |
| 商品链接解析 | 粘贴淘宝/京东/拼多多/1688 商品链接，解析出商品并跨平台比价同款 |
| 商品归一化 | 标题清洗、品牌/规格提取、单位归一化（500毫升→500ml）、类目推断、重量估算 |
| 到手总价计算 | 货值 + 国际运费 + 关税 + VAT + 服务费 + 支付手续费 + 利润，支持 32 个国家税则与 160+ 币种汇率 |
| 推荐排序 | 0.4 价格 + 0.25 信誉 + 0.15 销量 + 0.1 时效 + 0.1 平台权重的综合得分，支持客户端二次排序 |
| 多语言界面 | 英文 / 西班牙语 / 中文，多币种切换 |

## 技术栈

- **后端**：Node.js + Express（ESM）
- **前端**：Vite + React（无 UI 框架依赖，纯 CSS）
- **数据**：内置税则表、运费表、汇率（可在线刷新）、演示商品数据

## 快速开始

```bash
# 安装依赖
npm install

# 启动前后端（Vite 代理 /api 到后端 3001）
npm run dev
```

- 后端 API：http://localhost:3001
- 前端：http://localhost:5173

## 配置真实平台 API

复制 `server/.env.example` 为 `server/.env`，填入各平台联盟密钥：

```bash
# 淘宝/天猫联盟（阿里妈妈，需要推广者资质）
TAOBAO_APP_KEY=
TAOBAO_APP_SECRET=
TAOBAO_ADZONE_ID=

# 京东联盟
JD_APP_KEY=
JD_APP_SECRET=
JD_UNION_ID=

# 拼多多多多客
PDD_CLIENT_ID=
PDD_CLIENT_SECRET=
PDD_PID=

# 1688 分销客
ALI1688_APP_KEY=
ALI1688_APP_SECRET=
```

> 适配器已实现搜索接口骨架（`server/src/platforms/`），配置密钥后需按各平台最新签名规范补全签名逻辑。未配置密钥时自动使用 `server/src/data/mockProducts.js` 演示数据，完整跑通比价流程。

## API

| 接口 | 说明 |
|------|------|
| `GET /api/search?q=wireless earbuds&country=DE&currency=EUR` | 主搜索 + 归一化 + 总成本计算 + 推荐排序 |
| `GET /api/link/parse-link?url=https://item.taobao.com/item.htm?id=1001` | 解析电商商品链接 |
| `GET /api/meta` | 平台状态、目的国、币种、汇率 |
| `GET /api/tax/US` | 指定国家税则 + 运费 |
| `GET /api/categories` | 演示分类 |

### 搜索请求参数

| 参数 | 说明 |
|------|------|
| `q` | 关键词（中英文均可，英文自动翻译为中文） |
| `country` | 目的国 ISO alpha-2（默认 US） |
| `currency` | 目标货币 ISO 4217（默认 USD） |
| `platforms` | 逗号分隔平台（taobao,jd,pdd,1688） |
| `profitRate` | 利润加成比例（如 0.08） |

## 到手总价模型

```
到手总价 = 货值(CNY→目标币种)
         + 国际运费（按重量×品类表估算，云途/专线报价基准）
         + 关税（货值 - deMinimis 免征额）× 品类税率
         + VAT（货值 - VAT起征点 + 关税）× 增值税率
         + 服务费(5%) + 支付手续费(3%) + 利润
```

## 目录结构

```
server/
  src/
    config.js             # 环境配置
    index.js              # Express 入口
    routes/               # /api 路由
    platforms/            # 平台适配器（taobao/jd/pdd/1688 + 签名骨架）
    services/
      translate.js        # 关键词中英互译
      normalize.js        # 商品归一化/去重分组
      pricing.js          # 到手总价计算
      rank.js             # 加权推荐排序
      currency.js         # 汇率
      searchService.js    # 搜索编排
    data/                 # 税则表 / 运费表 / 重量表 / 演示商品
web/
  src/
    App.jsx
    components/           # 搜索面板 / 设置 / 商品卡片 / 加载
    i18n.js               # 多语言 hook
    locales/              # en / es / zh
```

## 合规说明

- 数据来源：官方联盟/开放平台 API（淘宝联盟、京东联盟、多多客、1688 分销客），禁止爬取
- 商品图片、描述需按平台规则使用；品牌名保持原文不翻译
- 跨境税费为估算值，实际以海关清关为准
- 该演示系统建议作为 MVP 验证，生产环境需补充支付、订单、转运仓对接、消费者保护条款
