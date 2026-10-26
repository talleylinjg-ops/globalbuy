// 更新顺丰国际渠道凭据（appKey/appSecret/aesKey/customerCode/产品码）
// 用法：node update-sfintl-prod.mjs（在 server 目录执行）
import { loadDb } from './src/services/db.js';
import { getCarrierConfigs, upsertCarrier } from './src/services/carrierStore.js';

await loadDb();
upsertCarrier({
  code: 'sfintl',
  name: '顺丰国际',
  mode: 'standard',
  enabled: true,
  markupRate: 0,
  appKey: 'cdd169d87a4698d314754a79f180308a',
  appSecret: '69fb3e868a45d0bdd5b0de0ea1db6ece',
  aesKey: 'oI1YdU1cb1YC70HVjZRa3wXBLUsrIUYr5lDh0gFrMbe',
  customerCode: 'ICRME000SRN93',
  customerType: 2,
  interProductCode: 'INT0014,INT0020,INT0263,INT0131',
  baseUrl: 'http://api-ifsp-sit.sf.global',
});
const after = getCarrierConfigs().find((c) => c.code === 'sfintl');
console.log('顺丰国际已更新:', JSON.stringify({
  customerCode: after.customerCode,
  interProductCode: after.interProductCode,
  baseUrl: after.baseUrl,
  enabled: after.enabled,
}));
