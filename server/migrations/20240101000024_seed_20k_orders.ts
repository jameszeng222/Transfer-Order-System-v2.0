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
  const existingCount = await knex('transfer_orders').count('* as c').first();
  if (Number(existingCount?.c) > 1000) {
    console.log(`[seed-20k] Already have ${existingCount?.c} orders, skipping`);
    return;
  }

  console.log('[seed-20k] Generating 20,000 transfer orders with related data...');
  const startMs = Date.now();

  const rand = seededRandom(42);

  const TOTAL_ORDERS = 20000;
  const orders: any[] = [];
  const allItems: any[] = [];
  const allCartons: any[] = [];
  const allCartonItems: any[] = [];
  const allTrackingEvents: any[] = [];
  const allFreightBills: any[] = [];
  const allDiscrepancyRecords: any[] = [];

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const seq = String(i + 1).padStart(6, '0');
    const transferNo = `DB-26${seq}`;
    const inboundNo = `IB-26${seq}`;
    const statusIdx = pickWeighted(rand(), STATUS_WEIGHTS);
    const status = STATUSES[statusIdx];
    const fromWh = WAREHOUSES_FROM[Math.floor(rand() * WAREHOUSES_FROM.length)];
    const toWh = WAREHOUSES_TO[Math.floor(rand() * WAREHOUSES_TO.length)];
    const transport = TRANSPORT_TYPES[Math.floor(rand() * TRANSPORT_TYPES.length)];
    const team = TEAMS[Math.floor(rand() * TEAMS.length)];
    const source = SOURCES[Math.floor(rand() * SOURCES.length)];
    const createTime = randomDate(rand, 180, 0);
    const skuCount = randomInt(rand, 2, 6);
    const selectedSkus = [];
    const usedIndices = new Set<number>();
    for (let s = 0; s < skuCount && s < SKU_POOL.length; s++) {
      let idx: number;
      do { idx = Math.floor(rand() * SKU_POOL.length); } while (usedIndices.has(idx));
      usedIndices.add(idx);
      selectedSkus.push(SKU_POOL[idx]);
    }

    const statusProgress = ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED'].indexOf(status);
    const isCancelled = status === 'CANCELLED';

    let departTime: string | null = null;
    let pickupTime: string | null = null;
    let arrivePortTime: string | null = null;
    let clearanceTime: string | null = null;
    let lastMilePickupTime: string | null = null;
    let deliveryTime: string | null = null;
    let unloadTime: string | null = null;
    let shelveTime: string | null = null;

    if (statusProgress >= 1 && !isCancelled) departTime = randomDate(rand, 175, 2);
    if (statusProgress >= 2 && !isCancelled) pickupTime = departTime ? randomDate(rand, 170, 3) : null;
    if (statusProgress >= 2 && !isCancelled) arrivePortTime = randomDate(rand, 160, 10);
    if (statusProgress >= 2 && !isCancelled) clearanceTime = randomDate(rand, 155, 12);
    if (statusProgress >= 3 && !isCancelled) { deliveryTime = randomDate(rand, 150, 15); lastMilePickupTime = randomDate(rand, 148, 14); }
    if (statusProgress >= 3 && !isCancelled) unloadTime = randomDate(rand, 145, 16);
    if (statusProgress >= 4 && !isCancelled) shelveTime = randomDate(rand, 140, 20);

    const isLogisticsAbnormal = !isCancelled && statusProgress >= 2 && rand() < 0.08;
    const isShelfAbnormal = !isCancelled && statusProgress >= 4 && rand() < 0.12;
    const isReconciled = status === 'COMPLETED' ? true : (!isCancelled && rand() < 0.3);
    const isPaid = isReconciled && rand() < 0.7;

    const totalQty = selectedSkus.reduce((sum) => sum + randomInt(rand, 50, 300), 0);
    const cartonCount = Math.max(1, Math.ceil(totalQty / randomInt(rand, 40, 80)));

    const carrier = CARRIERS[Math.floor(rand() * CARRIERS.length)];
    const estimatedFreight = transport === 'AIR' ? cartonCount * rand() * 800 + 500 : cartonCount * rand() * 200 + 200;
    const totalFreight = isReconciled ? estimatedFreight * (0.85 + rand() * 0.3) : null;

    orders.push({
      transfer_no: transferNo,
      erp_order_no: `ERP-${seq}`,
      outbound_order_no: `OB-${seq}`,
      inbound_order_no: inboundNo,
      from_warehouse: fromWh,
      to_warehouse: toWh,
      team,
      source,
      transfer_type: 'DOMESTIC_TO_OVERSEAS',
      status,
      transport_type: transport,
      total_sku_count: skuCount,
      total_qty: totalQty,
      total_carton_count: cartonCount,
      logistics_status: statusProgress >= 2 ? 'IN_TRANSIT' : null,
      expected_arrival_date: pickupTime ? new Date(new Date(pickupTime).getTime() + randomInt(rand, 15, 45) * 86400000).toISOString().slice(0, 10) : null,
      logistics_carrier: statusProgress >= 1 ? carrier : null,
      logistics_tracking_no: statusProgress >= 1 ? `TN-${seq}-${Math.floor(rand() * 9000 + 1000)}` : null,
      is_customs_declared: statusProgress >= 2 ? (rand() < 0.9 ? 1 : 0) : 0,
      customs_factory: statusProgress >= 2 && rand() < 0.6 ? '深圳报关行' : null,
      is_inspected: statusProgress >= 2 && rand() < 0.15 ? 1 : 0,
      timeline_requirement_days: transport === 'AIR' ? randomInt(rand, 7, 15) : randomInt(rand, 25, 60),
      is_logistics_abnormal: isLogisticsAbnormal ? 1 : 0,
      logistics_abnormal_type: isLogisticsAbnormal ? 'TIMEOUT_DELIVERY' : null,
      is_shelf_abnormal: isShelfAbnormal ? 1 : 0,
      estimated_freight: Math.round(estimatedFreight * 100) / 100,
      total_freight_amount: totalFreight ? Math.round(totalFreight * 100) / 100 : null,
      freight_currency: 'USD',
      is_reconciled: isReconciled ? 1 : 0,
      is_paid: isPaid ? 1 : 0,
      create_time: createTime,
      departure_time: departTime,
      pickup_time: pickupTime,
      arrival_port_time: arrivePortTime,
      customs_clearance_time: clearanceTime,
      last_mile_pickup_time: lastMilePickupTime,
      logistics_sign_time: deliveryTime,
      unload_time: unloadTime,
      shelf_time: shelveTime,
      update_time: shelveTime || unloadTime || deliveryTime || departTime || createTime,
    });

    let itemTotalQty = 0;
    for (const sku of selectedSkus) {
      const expectedQty = randomInt(rand, 50, 300);
      itemTotalQty += expectedQty;
      const outboundQty = statusProgress >= 1 && !isCancelled ? expectedQty : 0;
      const inboundQty = statusProgress >= 3 && !isCancelled ? expectedQty - (rand() < 0.1 ? randomInt(rand, 1, 5) : 0) : 0;
      const shelfQty = statusProgress >= 4 && !isCancelled ? inboundQty - (isShelfAbnormal ? randomInt(rand, 2, 15) : 0) : 0;
      const freightPerUnit = isReconciled && totalFreight && totalQty > 0
        ? Math.round(totalFreight / totalQty * 100) / 100
        : null;

      allItems.push({
        transfer_no: transferNo,
        inbound_order_no: inboundNo,
        sku_code: sku.code,
        sku_name: sku.name,
        expected_qty: expectedQty,
        outbound_qty: outboundQty,
        inbound_qty: inboundQty,
        shelf_qty: shelfQty,
        total_diff: shelfQty > 0 && inboundQty > 0 ? shelfQty - expectedQty : null,
        unit_weight: sku.weight,
        unit_volume: sku.volume,
        freight_cost_total: freightPerUnit ? Math.round(freightPerUnit * expectedQty * 100) / 100 : null,
        freight_cost_per_unit: freightPerUnit,
      });
    }

    const ctnCount = Math.max(1, Math.ceil(itemTotalQty / randomInt(rand, 40, 80)));
    for (let c = 0; c < ctnCount; c++) {
      const ctnNo = `CTN-${seq}-${String(c + 1).padStart(3, '0')}`;
      const ctnWeight = Math.round((rand() * 12 + 3) * 100) / 100;
      const ctnL = randomInt(rand, 30, 65);
      const ctnW = randomInt(rand, 20, 50);
      const ctnH = randomInt(rand, 15, 45);

      allCartons.push({
        transfer_no: transferNo,
        inbound_order_no: inboundNo,
        carton_no: ctnNo,
        carton_weight: ctnWeight,
        carton_length: ctnL,
        carton_width: ctnW,
        carton_height: ctnH,
        logistics_sign_time: deliveryTime,
        shelf_time: shelveTime,
        is_shelf_abnormal: isShelfAbnormal && c === 0 ? 1 : 0,
      });

      const itemsPerCarton = Math.min(selectedSkus.length, randomInt(rand, 1, 3));
      for (let ci = 0; ci < itemsPerCarton; ci++) {
        const sku = selectedSkus[ci % selectedSkus.length];
        const qty = randomInt(rand, 10, 60);
        allCartonItems.push({
          transfer_no: transferNo,
          carton_no: ctnNo,
          sku_code: sku.code,
          sku_name: sku.name,
          overseas_sku_code: sku.overseas,
          product_name: sku.name,
          qty,
          shelf_qty: shelveTime ? qty - (isShelfAbnormal && c === 0 && ci === 0 ? randomInt(rand, 1, 3) : 0) : 0,
        });
      }
    }

    if (statusProgress >= 2 && !isCancelled) {
      const eventTypes = ['SHIPPED', 'ARRIVED_PORT', 'CLEARED', 'PICKED_UP', 'SIGNED'];
      const eventDescs = ['已出库', '已到港', '已清关', '尾程提取', '已签收'];
      const eventCount = Math.min(statusProgress + 1, 5);
      for (let e = 0; e < eventCount; e++) {
        const eventTime = randomDate(rand, 175 - e * 15, 5 + e * 5);
        allTrackingEvents.push({
          transfer_no: transferNo,
          event_type: eventTypes[e],
          event_time: eventTime,
          event_desc: eventDescs[e],
          location: e === 0 ? fromWh : e < 3 ? '中转港' : toWh,
          operator: carrier,
        });
      }
    }

    if (isReconciled && totalFreight) {
      allFreightBills.push({
        bill_no: `FB-${seq}`,
        transfer_no: transferNo,
        logistics_carrier: carrier,
        freight_fee: Math.round(totalFreight * 0.85 * 100) / 100,
        customs_fee: Math.round(totalFreight * 0.08 * 100) / 100,
        other_fee: Math.round(totalFreight * 0.07 * 100) / 100,
        total_amount: Math.round(totalFreight * 100) / 100,
        currency: 'USD',
        exchange_rate: 7.25,
        total_amount_cny: Math.round(totalFreight * 7.25 * 100) / 100,
        bill_date: (shelveTime || deliveryTime || createTime).slice(0, 10),
        bill_status: isPaid ? 'RECONCILED' : 'CONFIRMED',
        confirm_time: isPaid ? (shelveTime || createTime) : null,
        confirmer: isPaid ? 'admin' : null,
      });
    }

    if (isShelfAbnormal) {
      const sku = selectedSkus[0];
      allDiscrepancyRecords.push({
        transfer_no: transferNo,
        carton_no: `CTN-${seq}-001`,
        sku_code: sku.code,
        sku_name: sku.name,
        overseas_sku_code: sku.overseas,
        inbound_order_no: inboundNo,
        discrepancy_category: 'SHELF_ABNORMAL',
        discrepancy_type: 'PARTIAL_SHELF',
        discrepancy_qty: randomInt(rand, 2, 15),
        status: rand() < 0.4 ? 'CLOSED' : rand() < 0.7 ? 'PROCESSING' : 'PENDING',
        source: 'SHELF_SHORTAGE',
        handler: rand() < 0.5 ? 'admin' : null,
        resolution: rand() < 0.4 ? '补发' : null,
        resolution_remark: rand() < 0.3 ? '已联系供应商补发' : null,
      });
    }

    if (isLogisticsAbnormal && rand() < 0.5) {
      const sku = selectedSkus[Math.floor(rand() * selectedSkus.length)];
      allDiscrepancyRecords.push({
        transfer_no: transferNo,
        sku_code: sku.code,
        sku_name: sku.name,
        overseas_sku_code: sku.overseas,
        inbound_order_no: inboundNo,
        discrepancy_category: 'LOGISTICS_ABNORMAL',
        discrepancy_type: 'TIMEOUT_DELIVERY',
        discrepancy_qty: 0,
        status: 'PENDING',
        source: 'MANUAL',
      });
    }
  }

  console.log(`[seed-20k] Generated: ${orders.length} orders, ${allItems.length} items, ${allCartons.length} cartons, ${allCartonItems.length} carton_items, ${allTrackingEvents.length} events, ${allFreightBills.length} bills, ${allDiscrepancyRecords.length} discrepancies`);

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    await knex('transfer_orders').insert(orders.slice(i, i + BATCH_SIZE));
  }
  console.log(`[seed-20k] Orders inserted`);

  for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
    await knex('transfer_order_items').insert(allItems.slice(i, i + BATCH_SIZE));
  }
  console.log(`[seed-20k] Items inserted`);

  for (let i = 0; i < allCartons.length; i += BATCH_SIZE) {
    await knex('transfer_cartons').insert(allCartons.slice(i, i + BATCH_SIZE));
  }
  console.log(`[seed-20k] Cartons inserted`);

  for (let i = 0; i < allCartonItems.length; i += BATCH_SIZE) {
    await knex('transfer_carton_items').insert(allCartonItems.slice(i, i + BATCH_SIZE));
  }
  console.log(`[seed-20k] Carton items inserted`);

  for (let i = 0; i < allTrackingEvents.length; i += BATCH_SIZE) {
    await knex('tracking_events').insert(allTrackingEvents.slice(i, i + BATCH_SIZE));
  }
  console.log(`[seed-20k] Tracking events inserted`);

  for (let i = 0; i < allFreightBills.length; i += BATCH_SIZE) {
    await knex('freight_bills').insert(allFreightBills.slice(i, i + BATCH_SIZE));
  }
  console.log(`[seed-20k] Freight bills inserted`);

  for (let i = 0; i < allDiscrepancyRecords.length; i += BATCH_SIZE) {
    await knex('discrepancy_records').insert(allDiscrepancyRecords.slice(i, i + BATCH_SIZE));
  }
  console.log(`[seed-20k] Discrepancy records inserted`);

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`[seed-20k] Done in ${elapsed}s`);
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
