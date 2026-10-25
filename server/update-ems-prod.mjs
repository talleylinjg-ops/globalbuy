// 更新 EMS 渠道为生产参数（serverNo/authorization/signKey/userCode）
// 用法：node update-ems-prod.mjs（在 server 目录执行）
import { loadDb } from './src/services/db.js';
import { getCarrierConfigs, upsertCarrier } from './src/services/carrierStore.js';

await loadDb();
const ems = getCarrierConfigs().find((c) => c.code === 'ems');
if (!ems) { console.log('未找到 ems 配置'); process.exit(1); }
Object.assign(ems, {
  senderNo: '1100248949682',
  authorization: 'SxhT5sP7H4Q6fEuP',
  userCode: 'MGLYNHDZV',
  signKey: 'Vkd1eHVpaEU0WHJVZURKaQ==',
  baseUrl: 'https://api.ems.com.cn/amp-prod-api/f/amp/api/open',
  enabled: true,
});
upsertCarrier(ems);
const after = getCarrierConfigs().find((c) => c.code === 'ems');
console.log('EMS 已更新:', JSON.stringify({ senderNo: after.senderNo, userCode: after.userCode, signKey: after.signKey, baseUrl: after.baseUrl }));
