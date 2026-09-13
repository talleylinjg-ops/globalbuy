// 国际快递适配器注册表
// 后台配置的每个快递商通过 code 找到对应适配器
import { YunTrackAdapter } from './yuntrack.js';
import { FourPXAdapter } from './4px.js';
import { DHLAdapter } from './dhl.js';
import { UPSAdapter } from './ups.js';
import { FedExAdapter } from './fedex.js';
import { EMSAdapter } from './ems.js';
import { PtdsgjAdapter } from './ptdsgj.js';
import { ZjhygjAdapter } from './zjhygj.js';

export const CARRIER_ADAPTERS = {
  yuntrack: { name: '云途物流', adapter: YunTrackAdapter, fields: ['appId', 'appToken'] },
  '4px': { name: '递四方', adapter: FourPXAdapter, fields: ['appKey', 'appSecret'] },
  dhl: { name: 'DHL Express', adapter: DHLAdapter, fields: ['apiKey', 'apiSecret'] },
  ups: { name: 'UPS', adapter: UPSAdapter, fields: ['clientId', 'clientSecret'] },
  fedex: { name: 'FedEx', adapter: FedExAdapter, fields: ['apiKey', 'apiSecret'] },
  ems: { name: 'EMS', adapter: EMSAdapter, fields: ['userId', 'apiKey'] },
  ptdsgj: { name: 'PTD 国际速递', adapter: PtdsgjAdapter, fields: ['token', 'pickupZone'] },
  zjhygj: { name: '华源国际', adapter: ZjhygjAdapter, fields: ['account', 'password', 'branchId'] },
};

// 内置默认快递商（未配置密钥时走估算模式，保证开箱可用）
export function defaultCarriers() {
  return [
    { code: 'yuntrack', name: '云途专线', mode: 'economy', enabled: true, markupRate: 0 },
    { code: '4px', name: '4PX 递四方', mode: 'standard', enabled: true, markupRate: 0 },
    { code: 'dhl', name: 'DHL Express', mode: 'express', enabled: true, markupRate: 0 },
    { code: 'ups', name: 'UPS', mode: 'express', enabled: true, markupRate: 0 },
    { code: 'fedex', name: 'FedEx', mode: 'express', enabled: true, markupRate: 0 },
    { code: 'ems', name: 'EMS', mode: 'standard', enabled: true, markupRate: 0 },
    { code: 'ptdsgj', name: 'PTD 国际速递', mode: 'standard', enabled: true, markupRate: 0 },
    { code: 'zjhygj', name: '华源国际专线', mode: 'economy', enabled: true, markupRate: 0 },
  ];
}

export function createCarrierAdapter(carrierCfg) {
  const meta = CARRIER_ADAPTERS[carrierCfg.code];
  if (!meta) return null;
  const Adapter = meta.adapter;
  return new Adapter(carrierCfg);
}

export function carrierFieldMeta(code) {
  const meta = CARRIER_ADAPTERS[code];
  return meta ? { name: meta.name, fields: meta.fields } : null;
}
