import { Hono } from 'hono';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';
import { applyTimeRangeFilters } from '../utils/queryHelpers.js';
import XLSX from 'xlsx';

const tracking = new Hono();

interface SlaRule {
  dest_warehouse_id: number;
  transport_type: string;
  sla_days: number;
}

let cachedSlaRules: SlaRule[] | null = null;
let cachedSlaRulesAt = 0;
const SLA_CACHE_TTL = 60_000;

async function getSlaRules(): Promise<SlaRule[]> {
  if (cachedSlaRules && Date.now() - cachedSlaRulesAt < SLA_CACHE_TTL) {
    return cachedSlaRules;
  }
  const rules = await db('sla_rules').select('dest_warehouse_id', 'transport_type', 'sla_days');
  cachedSlaRules = rules;
  cachedSlaRulesAt = Date.now();
  return rules;
}

let cachedWarehouseIdMap: Record<string, number> | null = null;
let cachedWarehouseIdMapAt = 0;

async function getWarehouseIdMap(): Promise<Record<string, number>> {
  if (cachedWarehouseIdMap && Date.now() - cachedWarehouseIdMapAt < SLA_CACHE_TTL) {
    return cachedWarehouseIdMap;
  }
  const warehouses = await db('warehouses').select('id', 'warehouse_code');
  const map: Record<string, number> = Object.fromEntries(warehouses.map((w: any) => [w.warehouse_code, w.id]));
  cachedWarehouseIdMap = map;
  cachedWarehouseIdMapAt = Date.now();
  return map;
}

function computeSlaDays(
  toWarehouse: string,
  transportType: string,
  slaRules: SlaRule[],
  warehouseIdMap: Record<string, number>
): number {
  const warehouseId = warehouseIdMap[toWarehouse];
  if (!warehouseId) return 30;
  const rule = slaRules.find(
    (r) => r.dest_warehouse_id === warehouseId && r.transport_type === transportType
  );
  return rule ? rule.sla_days : 30;
}

function computeRemainingDays(pickupTime: string | null, slaDays: number): number | null {
  if (!pickupTime) return null;
  const pickup = new Date(pickupTime);
  const expectedArrival = new Date(pickup.getTime() + slaDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = expectedArrival.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

tracking.get('/intransit', async (c) => {
  if (!await requirePermission(c, 'tracking.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const page = Number(c.req.query('page')) || 1;
  const MAX_PAGE_SIZE = 200;
const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, MAX_PAGE_SIZE);
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const isTimeout = c.req.query('is_timeout');
  const logisticsCarrier = c.req.query('logistics_carrier');
  const team = c.req.query('team');
  const abnormal = c.req.query('abnormal');

  let query = db('transfer_orders').where('status', 'IN_TRANSIT');

  if (fromWarehouse) {
    query = query.where('from_warehouse', fromWarehouse);
  }
  if (toWarehouse) {
    query = query.where('to_warehouse', toWarehouse);
  }
  if (transportType) {
    query = query.where('transport_type', transportType);
  }
  if (logisticsCarrier) {
    query = query.where('logistics_carrier', logisticsCarrier);
  }
  if (team) {
    query = query.where('team', team);
  }
  if (abnormal) {
    if (abnormal === 'logistics') {
      query = query.where('is_logistics_abnormal', 1);
    } else if (abnormal === 'timeout') {
      query = query.whereNotNull('expected_arrival_date')
        .where('expected_arrival_date', '<', new Date().toISOString().slice(0, 10))
        .whereNull('logistics_sign_time');
    }
  }

  query = applyTimeRangeFilters(query, c);

  const [slaRules, warehouseIdMap] = await Promise.all([getSlaRules(), getWarehouseIdMap()]);

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const data = await query
    .clone()
    .select([
      'id',
      'transfer_no',
      'inbound_order_no',
      'from_warehouse',
      'to_warehouse',
      'status',
      'transport_type',
      'logistics_carrier',
      'logistics_tracking_no',
      'team',
      'total_sku_count',
      'total_qty',
      'total_carton_count',
      'pickup_time',
      'departure_time',
      'arrival_port_time',
      'customs_clearance_time',
      'last_mile_pickup_time',
      'logistics_sign_time',
      'is_customs_declared',
      'is_inspected',
      'is_logistics_abnormal',
      'logistics_abnormal_type',
      'logistics_abnormal_remark',
      'is_shelf_abnormal',
      'shelf_abnormal_type',
      'timeline_requirement_days',
      'expected_arrival_date',
      'estimated_unit_price',
      'estimated_freight',
      'freight_currency',
      'is_reconciled',
      'is_paid',
      'create_time',
      'remark',
    ])
    .orderBy('pickup_time', 'asc')
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  const enriched = data.map((row: any) => {
    const slaDays = row.timeline_requirement_days || computeSlaDays(row.to_warehouse, row.transport_type, slaRules, warehouseIdMap);
    const remainingDays = computeRemainingDays(row.pickup_time, slaDays);
    const expectedArrival = row.pickup_time
      ? new Date(new Date(row.pickup_time).getTime() + slaDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const timeout = remainingDays !== null && remainingDays <= 0;
    return {
      ...row,
      sla_days: slaDays,
      expected_arrival: expectedArrival,
      remaining_days: remainingDays,
      is_timeout: timeout,
    };
  });

  const orderIds = enriched.map((r: any) => r.id);
  let cartonItems: any[] = [];
  if (orderIds.length > 0) {
    cartonItems = await db('transfer_carton_items as ci')
      .leftJoin('transfer_cartons as ct', 'ci.carton_id', 'ct.id')
      .leftJoin('transfer_order_items as oi', function () {
        this.on('oi.transfer_no', 'ct.transfer_no').andOn('oi.sku_code', 'ci.sku_code');
      })
      .whereIn('ct.order_id', orderIds)
      .select([
        'ct.order_id',
        'ct.carton_no',
        'ci.sku_code as system_sku',
        'ci.overseas_sku_code as overseas_sku',
        'ci.qty',
        'oi.outbound_qty',
      ]);
  }

  const itemsByOrder: Record<number, any[]> = {};
  for (const ci of cartonItems) {
    if (!itemsByOrder[ci.order_id]) itemsByOrder[ci.order_id] = [];
    itemsByOrder[ci.order_id].push(ci);
  }

  for (const row of enriched) {
    row.carton_items = itemsByOrder[row.id] || [];
  }

  const filtered = isTimeout !== undefined && isTimeout !== ''
    ? enriched.filter((row: any) => {
        if (isTimeout === 'true') return row.is_timeout;
        return !row.is_timeout && row.remaining_days !== null;
      })
    : enriched;

  const filteredTotal = isTimeout !== undefined && isTimeout !== '' ? filtered.length : total;

  return c.json({
    success: true,
    data: filtered,
    pagination: { total: filteredTotal, page, pageSize },
  });
});

tracking.get('/dashboard', async (c) => {
  if (!await requirePermission(c, 'tracking.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [slaRules, warehouseIdMap, inTransitOrders, warehouseDistRows, transportDistRows, recentReceived] = await Promise.all([
    getSlaRules(),
    getWarehouseIdMap(),
    db('transfer_orders')
      .where('status', 'IN_TRANSIT')
      .select([
        'id',
        'to_warehouse',
        'transport_type',
        'pickup_time',
      ]),
    db('transfer_orders').where('status', 'IN_TRANSIT').select('to_warehouse').count('* as count').groupBy('to_warehouse'),
    db('transfer_orders').where('status', 'IN_TRANSIT').select('transport_type').count('* as count').groupBy('transport_type'),
    db('transfer_orders').where('status', 'RECEIVED').where('logistics_sign_time', '>=', sevenDaysAgo.toISOString()).select('logistics_sign_time'),
  ]);

  let timeoutCount = 0;
  let approachingCount = 0;

  for (const order of inTransitOrders) {
    const slaDays = computeSlaDays(order.to_warehouse, order.transport_type, slaRules, warehouseIdMap);
    const remaining = computeRemainingDays(order.pickup_time, slaDays);

    if (remaining !== null && remaining <= 0) {
      timeoutCount++;
    } else if (remaining !== null && remaining > 0 && remaining <= 3) {
      approachingCount++;
    }
  }

  const warehouseDist: Record<string, number> = {};
  for (const row of warehouseDistRows) {
    warehouseDist[row.to_warehouse] = Number(row.count);
  }

  const transportDist: Record<string, number> = {};
  for (const row of transportDistRows) {
    transportDist[row.transport_type] = Number(row.count);
  }

  const dailyTrend: Record<string, number> = {};
  for (const r of recentReceived) {
    if (r.logistics_sign_time) {
      const day = new Date(r.logistics_sign_time).toISOString().slice(0, 10);
      dailyTrend[day] = (dailyTrend[day] || 0) + 1;
    }
  }

  const trendDays: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trendDays.push({ date: key, count: dailyTrend[key] || 0 });
  }

  return c.json({
    success: true,
    data: {
      inTransitTotal: inTransitOrders.length,
      timeoutCount,
      approachingCount,
      warehouseDistribution: Object.entries(warehouseDist).map(([warehouse, count]) => ({
        warehouse,
        count,
      })),
      transportDistribution: Object.entries(transportDist).map(([transport_type, count]) => ({
        transport_type,
        count,
      })),
      recentTrend: trendDays,
    },
  });
});

tracking.get('/export', async (c) => {
  if (!await requirePermission(c, 'tracking.export')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const isTimeout = c.req.query('is_timeout');
  const logisticsCarrier = c.req.query('logistics_carrier');
  const team = c.req.query('team');
  const abnormal = c.req.query('abnormal');

  let query = db('transfer_orders').whereIn('status', ['IN_TRANSIT', 'RECEIVED']);

  if (fromWarehouse) query = query.where('from_warehouse', fromWarehouse);
  if (toWarehouse) query = query.where('to_warehouse', toWarehouse);
  if (transportType) query = query.where('transport_type', transportType);
  if (logisticsCarrier) query = query.where('logistics_carrier', logisticsCarrier);
  if (team) query = query.where('team', team);
  if (abnormal) {
    if (abnormal === 'logistics') {
      query = query.where('is_logistics_abnormal', 1);
    } else if (abnormal === 'timeout') {
      query = query.whereNotNull('expected_arrival_date')
        .where('expected_arrival_date', '<', new Date().toISOString().slice(0, 10))
        .whereNull('logistics_sign_time');
    }
  }

  const transferNosParam = c.req.query('transfer_nos');
  if (transferNosParam) {
    const transferNos = transferNosParam.split(',').filter(Boolean);
    query = query.whereIn('transfer_no', transferNos);
  }

  const [slaRules, warehouseIdMap] = await Promise.all([getSlaRules(), getWarehouseIdMap()]);

  const orders = await query.clone().select([
    'transfer_orders.id',
    'transfer_orders.transfer_no',
    'transfer_orders.inbound_order_no',
    'transfer_orders.from_warehouse',
    'transfer_orders.to_warehouse',
    'transfer_orders.status',
    'transfer_orders.transport_type',
    'transfer_orders.logistics_carrier',
    'transfer_orders.logistics_tracking_no',
    'transfer_orders.team',
    'transfer_orders.total_sku_count',
    'transfer_orders.total_qty',
    'transfer_orders.total_carton_count',
    'transfer_orders.pickup_time',
    'transfer_orders.departure_time',
    'transfer_orders.arrival_port_time',
    'transfer_orders.customs_clearance_time',
    'transfer_orders.last_mile_pickup_time',
    'transfer_orders.logistics_sign_time',
    'transfer_orders.unload_time',
    'transfer_orders.shelf_time',
    'transfer_orders.is_customs_declared',
    'transfer_orders.is_inspected',
    'transfer_orders.timeline_requirement_days',
    'transfer_orders.expected_arrival_date',
    'transfer_orders.expected_shelf_date',
    'transfer_orders.is_logistics_abnormal',
    'transfer_orders.logistics_abnormal_type',
    'transfer_orders.logistics_abnormal_remark',
    'transfer_orders.is_shelf_abnormal',
    'transfer_orders.shelf_abnormal_type',
    'transfer_orders.delay_explanation',
    'transfer_orders.last_mile_type',
    'transfer_orders.last_mile_channel',
    'transfer_orders.remark',
  ]);

  const orderTimeoutMap: Record<string, boolean> = {};
  for (const o of orders) {
    const slaDays = computeSlaDays(o.to_warehouse, o.transport_type, slaRules, warehouseIdMap);
    const remainingDays = computeRemainingDays(o.pickup_time, slaDays);
    orderTimeoutMap[o.transfer_no] = remainingDays !== null && remainingDays <= 0;
  }

  const filteredTransferNos = isTimeout !== undefined && isTimeout !== ''
    ? orders.filter((o: any) => {
        const timeout = orderTimeoutMap[o.transfer_no];
        if (isTimeout === 'true') return timeout;
        return !timeout;
      }).map((o: any) => o.transfer_no)
    : orders.map((o: any) => o.transfer_no);

  const filteredOrders = isTimeout !== undefined && isTimeout !== ''
    ? orders.filter((o: any) => filteredTransferNos.includes(o.transfer_no))
    : orders;

  const orderMap = new Map(filteredOrders.map((o: any) => [o.transfer_no, o]));

  const cartons = filteredTransferNos.length > 0
    ? await db('transfer_cartons')
        .whereIn('transfer_no', filteredTransferNos)
        .select([
          'id',
          'transfer_no',
          'carton_no',
          'departure_time',
          'arrival_port_time',
          'customs_clearance_time',
          'last_mile_pickup_time',
          'logistics_sign_time',
          'unload_time',
          'shelf_time',
          'checkout_to_sign_days',
          'sign_to_shelf_days',
          'unload_to_shelf_days',
          'is_carton_within_11days',
          'is_carton_within_7days',
          'is_carton_within_4days',
          'is_shelf_within_3days',
        ])
    : [];

  const cartonItems = filteredTransferNos.length > 0
    ? await db('transfer_carton_items')
        .whereIn('transfer_no', filteredTransferNos)
        .select([
          'id',
          'transfer_no',
          'carton_no',
          'sku_code',
          'sku_name',
          'overseas_sku_code',
          'qty',
        ])
    : [];

  const cartonItemsByCarton: Record<string, any[]> = {};
  for (const ci of cartonItems) {
    if (!cartonItemsByCarton[ci.carton_no]) {
      cartonItemsByCarton[ci.carton_no] = [];
    }
    cartonItemsByCarton[ci.carton_no].push(ci);
  }

  const headers = [
    '第三方入库单号',
    '调拨单号',
    '入库单+箱号',
    '箱号',
    '系统SKU',
    '海外仓SKU',
    '计划数量',
    '实际发货数量',
    '状态',
    '发货仓',
    '目的仓',
    '团队',
    '运输类型',
    '运输时效要求(天)',
    '运单号',
    '收件日期(北京)',
    '离港时间',
    '到港时间',
    '清关时间',
    '尾程提取时间',
    '签收日期',
    '卸货时间',
    '上架时间',
    '签出-签收时效(天)',
    '签收-上架时效(天)',
    '卸货-上架时效(天)',
    '预计签收时间',
    '预计上架时间',
    '上架数量差异',
    '是否物流异常',
    '物流异常备注',
    '延迟说明',
    '是否查验',
    '是否3天内上架',
    '单箱是否11天内',
    '单箱是否7天内',
    '单箱是否4天内',
    '尾程',
    '尾程渠道分类',
  ];

  const sheetData: any[][] = [];

  for (const ctn of cartons) {
    const order = orderMap.get(ctn.transfer_no);
    if (!order) continue;

    const items = cartonItemsByCarton[ctn.carton_no] || [{}];

    for (const item of items) {
      const inboundCartonKey = `${order.inbound_order_no}+${ctn.carton_no}`;

      let checkoutToSignDays: number | null = null;
      if (ctn.departure_time && ctn.logistics_sign_time) {
        checkoutToSignDays = Math.round((new Date(ctn.logistics_sign_time).getTime() - new Date(ctn.departure_time).getTime()) / 86400000 * 100) / 100;
      }

      let signToShelfDays: number | null = null;
      if (ctn.logistics_sign_time && ctn.shelf_time) {
        signToShelfDays = Math.round((new Date(ctn.shelf_time).getTime() - new Date(ctn.logistics_sign_time).getTime()) / 86400000 * 100) / 100;
      }

      let unloadToShelfDays: number | null = null;
      if (ctn.unload_time && ctn.shelf_time) {
        unloadToShelfDays = Math.round((new Date(ctn.shelf_time).getTime() - new Date(ctn.unload_time).getTime()) / 86400000 * 100) / 100;
      }

      sheetData.push([
        order.inbound_order_no,
        order.transfer_no,
        inboundCartonKey,
        ctn.carton_no,
        item.sku_code || '',
        item.overseas_sku_code || '',
        item.qty || 0,
        item.qty || 0,
        order.status,
        order.from_warehouse,
        order.to_warehouse,
        order.team,
        order.transport_type,
        order.timeline_requirement_days,
        order.logistics_tracking_no,
        ctn.logistics_sign_time || order.logistics_sign_time,
        ctn.departure_time || order.departure_time,
        ctn.arrival_port_time || order.arrival_port_time,
        ctn.customs_clearance_time || order.customs_clearance_time,
        ctn.last_mile_pickup_time || order.last_mile_pickup_time,
        ctn.logistics_sign_time || order.logistics_sign_time,
        ctn.unload_time || order.unload_time,
        ctn.shelf_time || order.shelf_time,
        checkoutToSignDays ?? ctn.checkout_to_sign_days ?? '',
        signToShelfDays ?? ctn.sign_to_shelf_days ?? '',
        unloadToShelfDays ?? ctn.unload_to_shelf_days ?? '',
        order.expected_arrival_date || '',
        order.expected_shelf_date || '',
        '',
        order.is_logistics_abnormal ? '是' : '否',
        order.logistics_abnormal_remark || '',
        order.delay_explanation || '',
        order.is_inspected ? '是' : '否',
        ctn.is_shelf_within_3days ? '是' : (signToShelfDays !== null ? (signToShelfDays <= 3 ? '是' : '否') : ''),
        ctn.is_carton_within_11days ? '是' : (checkoutToSignDays !== null ? (checkoutToSignDays <= 11 ? '是' : '否') : ''),
        ctn.is_carton_within_7days ? '是' : (checkoutToSignDays !== null ? (checkoutToSignDays <= 7 ? '是' : '否') : ''),
        ctn.is_carton_within_4days ? '是' : (checkoutToSignDays !== null ? (checkoutToSignDays <= 4 ? '是' : '否') : ''),
        order.last_mile_type || '',
        order.last_mile_channel || '',
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
  XLSX.utils.book_append_sheet(wb, ws, '在途明细');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=intransit_export.xlsx',
    },
  });
});

tracking.post('/sla-check', async (c) => {
  if (!await requirePermission(c, 'tracking.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const [slaRules, warehouseIdMap] = await Promise.all([getSlaRules(), getWarehouseIdMap()]);

  const inTransitOrders = await db('transfer_orders')
    .where('status', 'IN_TRANSIT')
    .select([
      'id',
      'transfer_no',
      'to_warehouse',
      'transport_type',
      'pickup_time',
      'is_logistics_abnormal',
      'logistics_abnormal_type',
    ]);

  const now = new Date().toISOString();
  const timeoutIds: number[] = [];
  const typeUpdateIds: number[] = [];

  for (const order of inTransitOrders) {
    const slaDays = computeSlaDays(order.to_warehouse, order.transport_type, slaRules, warehouseIdMap);
    const remaining = computeRemainingDays(order.pickup_time, slaDays);

    if (remaining !== null && remaining <= 0) {
      if (!order.is_logistics_abnormal) {
        timeoutIds.push(order.id);
      } else if (order.logistics_abnormal_type !== 'TIMEOUT_DELIVERY') {
        typeUpdateIds.push(order.id);
      }
    }
  }

  if (timeoutIds.length > 0) {
    await db('transfer_orders').whereIn('id', timeoutIds).update({
      is_logistics_abnormal: true,
      logistics_abnormal_type: 'TIMEOUT_DELIVERY',
      update_time: now,
    });
  }
  if (typeUpdateIds.length > 0) {
    await db('transfer_orders').whereIn('id', typeUpdateIds).update({
      logistics_abnormal_type: 'TIMEOUT_DELIVERY',
      update_time: now,
    });
  }

  return c.json({
    success: true,
    data: {
      checkedCount: inTransitOrders.length,
      newTimeoutCount: timeoutIds.length + typeUpdateIds.length,
    },
  });
});

export default tracking;
