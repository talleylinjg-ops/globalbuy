# -*- coding: utf-8 -*-
"""Generate locale JSON files for all supported languages."""
import json, os, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'src', 'locales')

# en.json serves as template
with open(os.path.join(OUT, 'en.json'), encoding='utf-8') as f:
    TEMPLATE = json.load(f)

# Translations keyed by lang -> dotted.path -> value
# If a path is missing, English value is used (fallback in i18n.js)
T = {}

def add(lang, path, value):
    T.setdefault(lang, {})[path] = value

# ============ 中文 (zh) ============
zh = {
 'app.tagline': '中国电商跨境比价代购系统',
 'app.subtagline': '一站式搜索淘宝、天猫、京东、拼多多与 1688，含国际运费与关税增值税的真实到手总价对比',
 'nav.home': '首页', 'nav.admin': '管理后台',
 'search.placeholder': '试试：无线蓝牙耳机、瑜伽垫、手机壳…',
 'search.button': '搜索', 'search.buttonSearching': '搜索中…',
 'search.keywordTranslated': '正在使用中文关键词搜索',
 'search.suggestions': '热门：', 'search.tabKeyword': '关键词', 'search.tabLink': '商品链接',
 'search.placeholderLink': '粘贴淘宝 / 京东 / 拼多多 / 1688 商品链接…',
 'settings.deliveryCountry': '收货国家', 'settings.currency': '货币', 'settings.platforms': '平台',
 'settings.profitRate': '服务利润', 'settings.profitHelp': '在商品基础上叠加的佣金/利润',
 'settings.tipRate': '小费', 'settings.tipHelp': '对代购服务的自愿打赏',
 'result.total': '条报价', 'result.fromPlatforms': '来自', 'result.sortedBy': '按到手总成本与可信度排序',
 'result.topPick': '首选推荐', 'result.recommended': '推荐', 'result.price': '价格', 'result.landedTotal': '到手总价',
 'result.originalPrice': '原价', 'result.shipping': '国际运费', 'result.duty': '关税', 'result.vat': '增值税',
 'result.serviceFee': '服务费', 'result.paymentFee': '支付手续费', 'result.profit': '利润', 'result.tip': '小费',
 'result.sales': '销量', 'result.reviews': '评价', 'result.rating': '评分', 'result.shop': '店铺',
 'result.platform': '平台', 'result.deliveryTime': '预计时效', 'result.days': '天', 'result.weight': '重量',
 'result.commission': '佣金', 'result.inStock': '现货', 'result.breakdown': '成本明细',
 'result.viewBreakdown': '查看成本明细', 'result.hideBreakdown': '收起成本明细',
 'result.noResults': '未找到相关商品，请更换关键词。', 'result.score': '综合分',
 'result.source': '数据来源', 'result.taxNote': '税费说明', 'result.deMinimis': '免税门槛',
 'result.orderCta': '通过代购下单', 'result.totalLabel': '共 {total} 条报价，来自 {platforms} 个平台',
 'result.linkMatched': '链接识别成功：',
 'sort.recommended': '推荐排序', 'sort.priceAsc': '价格从低到高', 'sort.priceDesc': '价格从高到低',
 'sort.rating': '评分', 'sort.sales': '销量', 'sort.speed': '时效最快',
 'footer.note': '价格为估算值，已含国际运费、关税与增值税，实际清关可能略有差异，多退少补。',
 'footer.disclaimer': '演示系统 — 生产环境请通过 server/.env 配置各平台联盟 API 密钥',
 'error.search': '搜索失败，请重试。',
 'admin.title': '管理后台', 'admin.login': '管理员登录', 'admin.password': '密码', 'admin.loginBtn': '登录',
 'admin.logout': '退出登录', 'admin.dashboard': '仪表盘', 'admin.customers': '客户管理',
 'admin.orders': '订单管理', 'admin.addresses': '地址管理', 'admin.settings': '系统设置',
 'admin.search': '搜索', 'admin.add': '添加', 'admin.edit': '编辑', 'admin.delete': '删除',
 'admin.save': '保存', 'admin.cancel': '取消', 'admin.confirmDelete': '确定删除该记录？此操作不可撤销。',
 'admin.name': '姓名', 'admin.email': '邮箱', 'admin.phone': '电话', 'admin.country': '国家',
 'admin.status': '状态', 'admin.notes': '备注', 'admin.orderNo': '订单号', 'admin.items': '商品',
 'admin.total': '总额', 'admin.createdAt': '创建时间', 'admin.actions': '操作', 'admin.tracking': '物流单号',
 'admin.back': '返回', 'admin.currency': '货币', 'admin.registered': '注册时间', 'admin.view': '查看',
 'admin.newOrder': '新建订单', 'admin.newCustomer': '新增客户', 'admin.newAddress': '新增地址',
 'admin.ordersCount': '订单数', 'admin.customersCount': '客户数', 'admin.addressesCount': '地址数',
 'admin.revenue': '营收 (CNY)', 'admin.pendingOrders': '待处理订单',
 'admin.minServiceFee': '最低服务费率', 'admin.tipOptions': '小费选项 (%)',
 'admin.saveSettings': '保存设置', 'admin.loginError': '密码错误',
 'admin.customerInfo': '客户信息', 'admin.shippingAddress': '收货地址',
}
for k, v in zh.items():
    add('zh', k, v)

# Write helper
def write_files():
    langs = [d for d in T]
    os.makedirs(OUT, exist_ok=True)
    for lang in langs:
        # Build nested dict from template
        def apply(node, prefix=''):
            out = {}
            for k, v in node.items():
                path = f'{prefix}.{k}' if prefix else k
                if isinstance(v, dict):
                    out[k] = apply(v, path)
                else:
                    out[k] = T[lang].get(path, v)
            return out
        result = apply(TEMPLATE)
        with open(os.path.join(OUT, f'{lang}.json'), 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f'written {lang}.json')

if __name__ == '__main__':
    # Import remaining language dicts from sibling modules
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from langs_eu import populate_eu
    from langs_asia import populate_asia
    from langs_me_africa import populate_me_africa
    populate_eu(add)
    populate_asia(add)
    populate_me_africa(add)
    write_files()
    print('ALL DONE, total langs:', len(T))
