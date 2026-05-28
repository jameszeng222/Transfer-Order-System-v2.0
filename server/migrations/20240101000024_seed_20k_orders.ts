import type { Knex } from 'knex';

const BATCH_SIZE = 500;

const WAREHOUSES_FROM = ['深圳仓', '广州仓', '上海仓'];
const WAREHOUSES_TO = ['洛杉矶仓', '东京仓', '伦敦仓', '悉尼仓', '法兰克福仓'];
const TRANSPORT_TYPES: ('SEA' | 'AIR' | 'RAIL' | 'TRUCK')[] = ['SEA', 'AIR', 'RAIL', 'TRUCK'];
const TEAMS = ['华南一组', '华南二组', '华东一组', '华东二组'];
const SOURCES = ['API_WANYITONG', 'API_AMAZON', 'MANUAL', 'OTHER'];
const STATUSES: ('PENDING_OUTBOUND' | 'OUTBOUNDED' | 'IN_TRANSIT' | 'RECEIVED' | 'SHELVED' | 'COMPLETED' | 'CANCELLED')[] = [
  'PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED', 'CANCELLED',
];
const STATUS_WEIGHTS = [0.15, 0.10, 0.25, 0.15, 0.15, 0.18, 0.02];

const SKU_POOL = [
  { code: 'SKU-EAR-001', name: '蓝牙耳机 Pro', overseas: 'OS-EAR-001', weight: 0.12, volume: 0.0003 },
  { code: 'SKU-CHG-002', name: '充电宝 20000mAh', overseas: 'OS-CHG-002', weight: 0.45, volume: 0.0006 },
  { code: 'SKU-CAB-003', name: 'USB-C数据线 1m', overseas: 'OS-CAB-003', weight: 0.03, volume: 0.00005 },
  { code: 'SKU-MOU-004', name: '无线鼠标', overseas: 'OS-MOU-004', weight: 0.08, volume: 0.0004 },
  { code: 'SKU-KEY-005', name: '键盘套装', overseas: 'OS-KEY-005', weight: 0.65, volume: 0.002 },
  { code: 'SKU-CAS-006', name: '手机壳 iPhone15', overseas: 'OS-CAS-006', weight: 0.02, volume: 0.00008 },
  { code: 'SKU-FIL-007', name: '钢化膜 iPhone15', overseas: 'OS-FIL-007', weight: 0.01, volume: 0.00002 },
  { code: 'SKU-WAT-008', name: '智能手表', overseas: 'OS-WAT-008', weight: 0.06, volume: 0.0002 },
  { code: 'SKU-BAN-009', name: '运动手环', overseas: 'OS-BAN-009', weight: 0.03, volume: 0.0001 },
  { code: 'SKU-BOX-010', name: '耳机收纳盒', overseas: 'OS-BOX-010', weight: 0.04, volume: 0.00015 },
  { code: 'SKU-ADP-011', name: '充电器 65W', overseas: 'OS-ADP-011', weight: 0.18, volume: 0.0004 },
  { code: 'SKU-SPK-012', name: '便携音箱', overseas: 'OS-SPK-012', weight: 0.35, volume: 0.0008 },
  { code: 'SKU-HUB-013', name: 'USB Hub 7口', overseas: 'OS-HUB-013', weight: 0.10, volume: 0.0003 },
  { code: 'SKU-LAM-014', name: 'LED台灯', overseas: 'OS-LAM-014', weight: 0.55, volume: 0.0015 },
  { code: 'SKU-CAM-015', name: '摄像头 1080P', overseas: 'OS-CAM-015', weight: 0.12, volume: 0.0004 },
];

const CARRIERS = ['马士基', '中远海运', '递四方', '顺丰国际', '万邑通', 'DHL', 'FedEx', 'UPS'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pickWeighted(rand: number, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (rand < sum) return i;
  }
  return weights.length - 1;
}

function randomDate(rand: () => number, startDaysAgo: number, endDaysAgo: number): string {
  const start = Date.now() - startDaysAgo * 86400000;
  const end = Date.now() - endDaysAgo * 86400000;
  const t = start + rand() * (end - start);
  return new Date(t).toISOString().replace('T', ' ').slice(0, 19);
}

function randomInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export async function up(knex: Knex): Promise<void> {
  console.log('[seed-20k] Skipped - test data removed');
}

export async function down(knex: Knex): Promise<void> {
  await knex('discrepancy_records').del();
  await knex('freight_bills').del();
  await knex('tracking_events').del();
  await knex('transfer_carton_items').del();
  await knex('transfer_cartons').del();
  await knex('transfer_order_items').del();
  await knex('transfer_orders').del();
}
