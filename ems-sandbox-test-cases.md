# EMS 沙箱测试报文清单（按序执行，每个接口跑 2 次 → 申请上线）

组合：协议客户号 `1100248949682` + 测试授权码 `Ux0tq2GA7Fb49Wb6`

## 第一批：无依赖，直接测（9 个）

### 010003 四级分拣码
```json
{"waybillNo":"141234123","postCode":"201100","prov":"浙江省","city":"杭州市","county":"余杭区","address":"狮山路11号","type":"B"}
```

### 010004 面单查询
```json
{"waybillNo":"1295839088299","type":"129"}
```

### 030005 揽收范围判断
```json
{"address":"盐务管理局","bizProductNo":"1","city":"合肥市","conty":"巢湖市","prov":"安徽省","type":"1"}
```

### 050001 运费查询
```json
{"waybillNo":"1244520311098"}
```

### 050002 对账单查询
```json
{"startDate":"2025-10-01","endDate":"2025-10-31"}
```

### 050006 对账单明细查询
```json
{"custBillNo":"ACMDZ567117682506880","orgNo":"23000119"}
```

### 050005 预估邮费（报价核心）
```json
{"productCode":"112104300000991","weight":"10","senderInfo":"江苏省江阴市经济开发区新胜路1号","receiveInfo":"陕西省渭南市富平县曹村镇红河村七组村卫生室","duty":"2","insuranceMoney":"2"}
```

### 060001 地址解析
```json
[{"wholeAddress":"安徽省合肥市巢湖市盐务管理局"},{"wholeAddress":"北京市北京市西城区永安路173号"}]
```

### 060002 订单收寄管控
```json
{"baseProductNo":"1","contentsAttribute":"1","bizProductId":"","receiverProv":"广东省","receiverCity":"东莞市","receiverCounty":"道滘镇","receiverAddress":"广东省东莞市道滘镇南阁西路21号邮政仓库","senderProv":"河北省","senderCity":"邯郸市","senderCounty":"邯山区","senderAddress":"和平路10号","weight":"500"}
```

## 第二批：下单流程链（按顺序 6 个）

### 010001 订购服务申请
```json
{"sellerId":"2172552925","bizProductNo":"1","sellerNick":"老Baby","contactPhone":"15868124093","senderNo":"90000001885440","customerCode":"28020380","subscriptionId":"200000200014","county":"余杭区","branchAddressId":"1","city":"杭州市","address":"和平路174号","prov":"浙江省","postmanId":"12345"}
```

### 020002 批量取号
```json
{"bizProductNo":"1","count":"1"}
```
返回 mailList 里的运单号，后续接口可替换使用。

### 020003 订单接入（weight 必须整数，勿加小数）
```json
[{"ecommerceUserId":"12313165","deliveryPasswordFlag":"1","deliveryPassword":"","logisticsOrderNo":"12384565600","batchNo":"","waybillNo":"","oneBillFlag":"","submailNo":"","oneBillNum":"","oneBillFeeType":"","contentsAttribute":"1","bizProductNo":"1","bizProductId":"","teanIncrementFlag":"","weight":0,"volume":0,"length":0,"width":0,"height":0,"postageTotal":12,"remarks":"","insuranceFlag":"","insuranceAmount":"0","deliverType":"1","deliverPreDate":"","paymentMode":"","codFlag":"","codAmount":"0","valuableFlag":"1","receiverAgentIdType":"1","receiverIdNo":"","projectId":"","reservationReturnFlag":"1","reservationReturnTime":"1","returnRelationNo":"","receiptFlag":"","receiptWaybillNo":"","localCollectionFee":"1","sender":{"name":"张三","postCode":"","phone":"","mobile":"15232805086","prov":"北京市","city":"北京市","county":"西城区","address":"永安路174号"},"receiver":{"name":"张三","postCode":"","phone":"","mobile":"15232805086","prov":"北京市","city":"北京市","county":"西城区","address":"永安路174号"}}]
```

### 020004 订单更新
```json
{"waybillNo":"1295838760599","weight":"3","length":"33","width":"33","height":"33","volume":"33,33,33","remarks":"备注","logisticsOrderNo":"O202203281508328002352578560"}
```

### 020005 白名单订阅
```json
{"waybillNo":"1105593057526","oneBillFlag":"0","submailNo":"","logisticsOrderNo":"111测试"}
```

### 020006 订单取消
```json
{"waybillNo":"1295838760599","cancelReason":"取消原因","logisticsOrderNo":"O202203281508328002352578560"}
```

### 020007 改址撤单
```json
{"identification":"1","waybillNo":"1287525537797","receiverProvinceName":"安徽省","receiverCityName":"合肥市","receiverCountyName":"巢湖市","receiverAddr":"盐务管理局"}
```

## 第三批：派揽链（按顺序 5 个）

### 030001 上门取件
```json
{"delivery":{"address":"盐务管理局","city":"合肥市","county":"巢湖市","prov":"安徽省"},"receiver":{"address":"永安路173号","city":"北京市","county":"西城区","mobile":"18537735862","name":"测试人员","prov":"北京市"},"sender":{"address":"盐务管理局","city":"合肥市","county":"巢湖市","mobile":"12345678901","name":"招行测试","prov":"安徽省"},"bizProductNo":"1","pushMethod":"1","logisticsOrderNo":"ceshi2022102001"}
```

### 030004 上门取件取消
```json
{"cancelCode":"16","logisticsOrderNo":"ceshi2022102001"}
```

### 030006 催单
```json
{"logisticsOrderNo":"PL1518114542229254146"}
```

### 030007 修改预约时间
```json
{"logisticsOrderNo":"PL1518114542229254146","pickupPreBeginTime":"2022-10-19 10:00:00","pickupPreEndTime":"2022-10-19 11:00:00"}
```

### 030008 揽收结果查询
```json
{"logisticsOrderNo":"ceshi2022102501"}
```

## 第四批：推送类（4 个，视页面要求处理）

010002（服务审核通知）、030002（派揽状态返回）、030003（派揽结果返回）、040002（轨迹推送）方向是「邮政 → 客户系统」。沙箱页面若要求填客户回调地址，填平台允许的任意可达地址（如 `https://httpbin.org/post`）后触发模拟推送；若页面只提供报文框，直接点测试即可。

参考推送报文（010002）：
```json
{"sellerId":123456789,"auditor":"张三","auditStatus":"1","senderNo":"90000001885440","bizProductNo":"1","failureReason":"","subscriptionId":"200000200014"}
```

参考推送报文（040002 轨迹推送，仅需一条轨迹）：
```json
{"responseItems":[{"waybillNo":"1297636305804","opTime":"2022-10-17 17:12:10","opOrgProvName":"湖北省","opOrgCity":"武汉市","opOrgCode":"43000173","opOrgName":"湖北省寄递事业部政务客户营销中心","opCode":"203","opName":"收寄计费信息","opDesc":"已收寄","productName":"特快专递"}]}
```
