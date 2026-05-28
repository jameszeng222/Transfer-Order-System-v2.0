import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const seed = new Hono();

const BATCH_SIZE = 50;

const SKU_POOL = [
  { code: 'SKU-EAR-001', name: '蓝牙耳机 Pro', weight: 0.12, volume: 0.0003 },
  { code: 'SKU-CHG-002', name: '充电宝 20000mAh', weight: 0.45, volume: 0.0006 },
  { code: 'SKU-CAB-003', name: 'USB-C数据线 1m', weight: 0.03, volume: 0.00005 },
  { code: 'SKU-MOU-004', name: '无线鼠标', weight: 0.08, volume: 0.0004 },
  { code: 'SKU-KEY-005', name: '键盘套装', weight: 0.65, volume: 0.002 },
  { code: 'SKU-CAS-006', name: '手机壳 iPhone15', weight: 0.02, volume: 0.00008 },
  { code: 'SKU-FIL-007', name: '钢化膜 iPhone15', weight: 0.01, volume: 0.00002 },
  { code: 'SKU-WAT-008', name: '智能手表', weight: 0.06, volume: 0.0002 },
  { code: 'SKU-BAN-009', name: '运动手环', weight: 0.03, volume: 0.0001 },
  { code: 'SKU-BOX-010', name: '耳机收纳盒', weight: 0.04, volume: 0.00015 },
  { code: 'SKU-ADP-011', name: '充电器 65W', weight: 0.18, volume: 0.0004 },
  { code: 'SKU-SPK-012', name: '便携音箱', weight: 0.35, volume: 0.0008 },
  { code: 'SKU-HUB-013', name: 'USB Hub 7口', weight: 0.10, volume: 0.0003 },
  { code: 'SKU-LAM-014', name: 'LED台灯', weight: 0.55, volume: 0.0015 },
  { code: 'SKU-CAM-015', name: '摄像头 1080P', weight: 0.12, volume: 0.0004 },
];

const TRANSPORT_TYPES = ['SEA', 'AIR', 'RAIL', 'TRUCK'];
const SOURCES = ['API_WANYITONG', 'API_AMAZON', 'MANUAL', 'OTHER'];
const STATUSES = ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED', 'CANCELLED'];
const STATUS_WEIGHTS = [0.12, 0.08, 0.25, 0.15, 0.15, 0.20, 0.05];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pickWeighted(r: number, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (r < sum) return i;
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

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[randomInt(rand, 0, arr.length - 1)];
}

const generateSchema = z.object({
  count: z.number().min(1).max(5000).default(1000),
});

seed.post('/generate', zValidator('json', generateSchema), async (c) => {
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }

  const { count } = c.req.valid('json');

  const warehouses = await db('warehouses').where({ is_active: 1 }).select('warehouse_name', 'warehouse_type');
  const carriers = await db('carriers').where({ is_active: 1 }).select('carrier_name');
  const teams = await db('teams').where({ is_active: 1 }).select('team_name');

  if (warehouses.length === 0) {
    return c.json({ success: false, error: '请先添加仓库数据' }, 400);
  }
  if (carriers.length === 0) {
    return c.json({ success: false, error: '请先添加物流商数据' }, 400);
  }

  const domesticWh = warehouses.filter(w => w.warehouse_type === 'DOMESTIC_SELF' || w.warehouse_type === 'DOMESTIC_3RD').map(w => w.warehouse_name);
  const overseasWh = warehouses.filter(w => w.warehouse_type === 'OVERSEAS_SELF' || w.warehouse_type === 'OVERSEAS_3RD').map(w => w.warehouse_name);
  const carrierNames = carriers.map(c => c.carrier_name);
  const teamNames = teams.length > 0 ? teams.map(t => t.team_name) : ['默认团队'];

  if (domesticWh.length === 0 || overseasWh.length === 0) {
    return c.json({ success: false, error: '请确保同时添加了国内仓和海外仓' }, 400);
  }

  const maxExisting = await db('transfer_orders').max('id as maxId').first();
  const startId = Number(maxExisting?.maxId || 0) + 1;
  const rand = seededRandom(42 + startId);

  let generated = 0;

  for (let batch = 0; batch < Math.ceil(count / BATCH_SIZE); batch++) {
    const batchSize = Math.min(BATCH_SIZE, count - generated);
    const orders: any[] = [];
    const cartons: any[] = [];
    const items: any[] = [];

    for (let i = 0; i < batchSize; i++) {
      const idx = generated + i;
      const statusIdx = pickWeighted(rand(), STATUS_WEIGHTS);
      const status = STATUSES[statusIdx];
      const transportType = pick(rand, TRANSPORT_TYPES);
      const fromWarehouse = pick(rand, domesticWh);
      const toWarehouse = pick(rand, overseasWh);
      const carrier = pick(rand, carrierNames);
      const team = pick(rand, teamNames);
      const source = pick(rand, SOURCES);

      const transferNo = `TO-${String(startId + idx).padStart(6, '0')}`;
      const inboundNo = `IB-${String(startId + idx).padStart(6, '0')}`;
      const skuCount = randomInt(rand, 1, 8);
      const cartonCount = randomInt(rand, 1, 15);
      const totalQty = randomInt(rand, 50, 2000);

      const createTime = randomDate(rand, 90, 1);
      const isAbnormal = rand() < 0.1;

      const order: any = {
        transfer_no: transferNo,
        inbound_order_no: inboundNo,
        from_warehouse: fromWarehouse,
        to_warehouse: toWarehouse,
        team,
        source,
        transfer_type: 'DOMESTIC_TO_OVERSEAS',
        status,
        total_sku_count: skuCount,
        total_qty: totalQty,
        total_carton_count: cartonCount,
        transport_type: transportType,
        logistics_carrier: carrier,
        logistics_tracking_no: rand() < 0.8 ? `TRACK-${String(randomInt(rand, 100000, 999999))}` : null,
        is_customs_declared: status !== 'PENDING_OUTBOUND' && status !== 'OUTBOUNDED' ? 1 : 0,
        is_inspected: rand() < 0.5 ? 1 : 0,
        is_logistics_abnormal: isAbnormal && (status === 'IN_TRANSIT' || status === 'RECEIVED' || status === 'SHELVED') ? 1 : 0,
        logistics_abnormal_type: isAbnormal && (status === 'IN_TRANSIT' || status === 'RECEIVED') ? 'TIMEOUT_DELIVERY' : null,
        is_shelf_abnormal: isAbnormal && (status === 'SHELVED' || status === 'COMPLETED') ? 1 : 0,
        shelf_abnormal_type: isAbnormal && status === 'SHELVED' ? 'PARTIAL_SHELF' : null,
        estimated_freight: (rand() * 5000 + 500).toFixed(2),
        total_freight_amount: (rand() * 8000 + 1000).toFixed(2),
        freight_currency: 'CNY',
        is_reconciled: status === 'COMPLETED' ? 1 : 0,
        create_time: createTime,
        update_time: createTime,
      };

      const statusProgress = ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED'].indexOf(status);
      if (statusProgress >= 1) order.departure_time = randomDate(rand, 80, 5);
      if (statusProgress >= 2) order.pickup_time = randomDate(rand, 75, 10);
      if (statusProgress >= 2) order.arrival_port_time = randomDate(rand, 60, 12);
      if (statusProgress >= 3) order.customs_clearance_time = randomDate(rand, 50, 14);
      if (statusProgress >= 3) order.last_mile_pickup_time = randomDate(rand, 45, 15);
      if (statusProgress >= 4) order.logistics_sign_time = randomDate(rand, 35, 5);
      if (statusProgress >= 4) order.unload_time = randomDate(rand, 30, 3);
      if (statusProgress >= 5) order.shelf_time = randomDate(rand, 25, 1);

      if (order.pickup_time) {
        const pickupDate = new Date(order.pickup_time);
        const slaDays = transportType === 'SEA' ? 35 : transportType === 'AIR' ? 7 : transportType === 'RAIL' ? 20 : 10;
        order.expected_arrival_date = new Date(pickupDate.getTime() + slaDays * 86400000).toISOString().slice(0, 10);
        order.expected_shelf_date = new Date(pickupDate.getTime() + (slaDays + 3) * 86400000).toISOString().slice(0, 10);
        order.timeline_requirement_days = slaDays;
      }

      orders.push(order);

      for (let ci = 0; ci < cartonCount; ci++) {
        const cartonNo = `${transferNo}-C${String(ci + 1).padStart(3, '0')}`;
        const ctn: any = {
          transfer_no: transferNo,
          inbound_order_no: inboundNo,
          carton_no: cartonNo,
          logistics_tracking_no: rand() < 0.7 ? `CTN-${String(randomInt(rand, 100000, 999999))}` : null,
          carton_length: (rand() * 50 + 20).toFixed(1),
          carton_width: (rand() * 40 + 15).toFixed(1),
          carton_height: (rand() * 35 + 10).toFixed(1),
          carton_weight: (rand() * 15 + 2).toFixed(2),
          create_time: createTime,
          update_time: createTime,
        };

        if (statusProgress >= 1) ctn.departure_time = order.departure_time;
        if (statusProgress >= 2) ctn.arrival_port_time = order.arrival_port_time;
        if (statusProgress >= 3) ctn.customs_clearance_time = order.customs_clearance_time;
        if (statusProgress >= 3) ctn.last_mile_pickup_time = order.last_mile_pickup_time;
        if (statusProgress >= 4) ctn.logistics_sign_time = order.logistics_sign_time;
        if (statusProgress >= 4) ctn.unload_time = order.unload_time;
        if (statusProgress >= 5) ctn.shelf_time = order.shelf_time;

        if (ctn.departure_time && ctn.logistics_sign_time) {
          ctn.checkout_to_sign_days = Math.round((new Date(ctn.logistics_sign_time).getTime() - new Date(ctn.departure_time).getTime()) / 86400000 * 100) / 100;
          ctn.is_carton_within_11days = ctn.checkout_to_sign_days <= 11 ? 1 : 0;
          ctn.is_carton_within_7days = ctn.checkout_to_sign_days <= 7 ? 1 : 0;
          ctn.is_carton_within_4days = ctn.checkout_to_sign_days <= 4 ? 1 : 0;
        }
        if (ctn.logistics_sign_time && ctn.shelf_time) {
          ctn.sign_to_shelf_days = Math.round((new Date(ctn.shelf_time).getTime() - new Date(ctn.logistics_sign_time).getTime()) / 86400000 * 100) / 100;
          ctn.is_shelf_within_3days = ctn.sign_to_shelf_days <= 3 ? 1 : 0;
        }

        cartons.push(ctn);
      }

      const pickedSkus: number[] = [];
      for (let s = 0; s < skuCount; s++) {
        const skuIdx = randomInt(rand, 0, SKU_POOL.length - 1);
        if (!pickedSkus.includes(skuIdx)) pickedSkus.push(skuIdx);
      }

      for (const skuIdx of pickedSkus) {
        const sku = SKU_POOL[skuIdx];
        const expectedQty = randomInt(rand, 20, 500);
        const outboundQty = statusProgress >= 1 ? expectedQty - randomInt(rand, 0, 5) : 0;
        const inboundQty = statusProgress >= 4 ? outboundQty - randomInt(rand, 0, 3) : 0;
        const shelfQty = statusProgress >= 5 ? inboundQty - randomInt(rand, 0, 2) : 0;
        const freightPerUnit = totalQty > 0 ? (Number(order.total_freight_amount) / totalQty * (sku.weight / 0.15)).toFixed(4) : '0';

        items.push({
          transfer_no: transferNo,
          inbound_order_no: inboundNo,
          sku_code: sku.code,
          sku_name: sku.name,
          expected_qty: expectedQty,
          outbound_qty: outboundQty,
          inbound_qty: inboundQty,
          shelf_qty: shelfQty,
          outbound_diff: outboundQty - expectedQty,
          inbound_diff: inboundQty - outboundQty,
          total_diff: shelfQty - expectedQty,
          unit_weight: sku.weight,
          unit_volume: sku.volume,
          freight_cost_total: (Number(freightPerUnit) * expectedQty).toFixed(2),
          freight_cost_per_unit: freightPerUnit,
        });
      }
    }

    await db.transaction(async (trx) => {
      await trx('transfer_orders').insert(orders);
      await trx('transfer_cartons').insert(cartons);
      if (items.length > 0) {
        await trx('transfer_order_items').insert(items);
      }
    });

    generated += batchSize;
  }

  return c.json({
    success: true,
    data: {
      orders: generated,
      cartons: await db('transfer_cartons').count('* as c').first().then(r => Number(r?.c || 0)),
      items: await db('transfer_order_items').count('* as c').first().then(r => Number(r?.c || 0)),
    },
  });
});

seed.delete('/clear', async (c) => {
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }

  await db('discrepancy_records').del();
  await db('freight_bills').del();
  await db('tracking_events').del();
  await db('transfer_carton_items').del();
  await db('transfer_cartons').del();
  await db('transfer_order_items').del();
  await db('transfer_orders').del();

  return c.json({ success: true, data: { message: '测试数据已清除' } });
});

export default seed;
