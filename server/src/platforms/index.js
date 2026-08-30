import { config } from '../config.js';
import { TaobaoAdapter } from './taobao.js';
import { JdAdapter } from './jd.js';
import { PddAdapter } from './pdd.js';
import { Ali1688Adapter } from './ali1688.js';

export function createAdapters() {
  return {
    taobao: new TaobaoAdapter(config.platforms.taobao),
    jd: new JdAdapter(config.platforms.jd),
    pdd: new PddAdapter(config.platforms.pdd),
    '1688': new Ali1688Adapter(config.platforms['1688']),
  };
}

export function platformList() {
  const adapters = createAdapters();
  return [
    { id: 'taobao', name: '淘宝', status: adapters.taobao.sourceType },
    { id: 'tmall', name: '天猫', status: adapters.taobao.sourceType },
    { id: 'jd', name: '京东', status: adapters.jd.sourceType },
    { id: 'pdd', name: '拼多多', status: adapters.pdd.sourceType },
    { id: '1688', name: '1688', status: adapters['1688'].sourceType },
  ];
}
