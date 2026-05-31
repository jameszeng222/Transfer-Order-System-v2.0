import { Hono } from 'hono';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';
import { applyTimeRangeFilters } from '../utils/queryHelpers.js';
import XLSX from 'xlsx';
import { createTask, getTask, updateProgress, completeTask, failTask, cleanOldTasks } from '../services/exportTaskManager.js';

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

function computeLatestEvent(row: any): string {
  const nodes: [string, string][] = [
    ['已签收', row.logistics_sign_time],
    ['尾程提取', row.last_mile_pickup_time],
    ['已清关', row.customs_clearance_time],
    ['已到港', row.arrival_port_time],
    ['已离港', row.departure_time],
    ['已发货', row.pickup_time],
  ];
  for (const [label, time] of nodes) {
    if (time) return label;
  }
  return '--';
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
  const statusFilter = c.req.query('status');
  const keyword = c.req.query('keyword');

  const TRACKING_STATUSES = ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED'];
  let query = db('transfer_orders').whereIn('status', TRACKING_STATUSES);

  if (keyword) {
    const matchingTransferNos = await db('transfer_orders')
      .leftJoin('transfer_order_items', 'transfer_orders.transfer_no', 'transfer_order_items.transfer_no')
      .leftJoin('transfer_carton_items', 'transfer_orders.transfer_no', 'transfer_carton_items.transfer_no')
      .whereIn('transfer_orders.status', TRACKING_STATUSES)
      .where(function () {
        this.where('transfer_orders.inbound_order_no', 'like', `%${keyword}%`)
          .orWhere('transfer_orders.transfer_no', 'like', `%${keyword}%`)
          .orWhere('transfer_order_items.sku_code', 'like', `%${keyword}%`)
          .orWhere('transfer_carton_items.sku_code', 'like', `%${keyword}%`)
          .orWhere('transfer_order_items.overseas_sku_code', 'like', `%${keyword}%`)
          .orWhere('transfer_carton_items.overseas_sku_code', 'like', `%${keyword}%`);
      })
      .pluck('transfer_orders.transfer_no')
      .distinct();

    if (matchingTransferNos.length > 0) {
      query = query.whereIn('transfer_no', matchingTransferNos);
    } else {
      query = query.whereRaw('1 = 0');
    }
  }

  if (statusFilter && TRACKING_STATUSES.includes(statusFilter)) {
    query = query.where('status', statusFilter);
  }

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
      'expected_shelf_date',
      'estimated_unit_price',
      'estimated_freight',
      'freight_currency',
      'is_reconciled',
      'is_paid',
      'create_time',
      'remark',
      'shelf_time',
    ])
    .orderBy('create_time', 'desc')
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
      latest_event: computeLatestEvent(row),
    };
  });

  const transferNos = enriched.map((r: any) => r.transfer_no);
  let cartonItems: any[] = [];
  let orderItems: any[] = [];
  if (transferNos.length > 0) {
    cartonItems = await db('transfer_carton_items as ci')
      .leftJoin('transfer_cartons as ct', function () {
        this.on('ci.carton_no', 'ct.carton_no').andOn('ci.transfer_no', 'ct.transfer_no');
      })
      .whereIn('ci.transfer_no', transferNos)
      .select([
        'ci.transfer_no',
        'ct.carton_no',
        'ci.sku_code as system_sku',
        'ci.overseas_sku_code as overseas_sku',
        'ci.qty',
      ]);

    orderItems = await db('transfer_order_items')
      .whereIn('transfer_no', transferNos)
      .select([
        'transfer_no',
        'sku_code as system_sku',
        'overseas_sku_code as overseas_sku',
        'expected_qty',
        'outbound_qty',
      ]);
  }

  const cartonItemsByOrder: Record<string, any[]> = {};
  for (const ci of cartonItems) {
    if (!cartonItemsByOrder[ci.transfer_no]) cartonItemsByOrder[ci.transfer_no] = [];
    cartonItemsByOrder[ci.transfer_no].push(ci);
  }

  const orderItemsByOrder: Record<string, any[]> = {};
  for (const oi of orderItems) {
    if (!orderItemsByOrder[oi.transfer_no]) orderItemsByOrder[oi.transfer_no] = [];
    orderItemsByOrder[oi.transfer_no].push(oi);
  }

  for (const row of enriched) {
    const ci = cartonItemsByOrder[row.transfer_no] || [];
    const oi = orderItemsByOrder[row.transfer_no] || [];
    if (ci.length > 0) {
      row.carton_items = ci;
      const outboundTotal = oi.reduce((sum: number, i: any) => sum + (Number(i.outbound_qty) || 0), 0);
      const expectedTotal = oi.reduce((sum: number, i: any) => sum + (Number(i.expected_qty) || 0), 0);
      row.carton_outbound_qty = outboundTotal || expectedTotal;
    } else {
      row.carton_items = oi.map((i: any) => ({
        transfer_no: i.transfer_no,
        carton_no: null,
        system_sku: i.system_sku,
        overseas_sku: i.overseas_sku,
        qty: i.expected_qty,
      }));
      const outboundTotal = oi.reduce((sum: number, i: any) => sum + (Number(i.outbound_qty) || 0), 0);
      const expectedTotal = oi.reduce((sum: number, i: any) => sum + (Number(i.expected_qty) || 0), 0);
      row.carton_outbound_qty = outboundTotal || expectedTotal;
    }
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

  const [slaRules, warehouseIdMap, inTransitOrders, inTransitCartonCount, warehouseDistRows, transportDistRows, carrierDistRows, recentReceived] = await Promise.all([
    getSlaRules(),
    getWarehouseIdMap(),
    db('transfer_orders')
      .whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED'])
      .select([
        'id',
        'status',
        'to_warehouse',
        'transport_type',
        'pickup_time',
      ]),
    db('transfer_cartons')
      .leftJoin('transfer_orders', 'transfer_cartons.transfer_no', 'transfer_orders.transfer_no')
      .whereIn('transfer_orders.status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED'])
      .count('* as count')
      .first(),
    db('transfer_orders').whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED']).select('to_warehouse').count('* as count').groupBy('to_warehouse'),
    db('transfer_orders').whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED']).select('transport_type').count('* as count').groupBy('transport_type'),
    db('transfer_orders').whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED']).select('logistics_carrier').count('* as count').groupBy('logistics_carrier'),
    db('transfer_orders').where('status', 'RECEIVED').where('logistics_sign_time', '>=', sevenDaysAgo.toISOString()).select('logistics_sign_time'),
  ]);

  let timeoutCount = 0;
  let approachingCount = 0;

  for (const order of inTransitOrders) {
    if (order.status === 'RECEIVED') continue;
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

  const carrierDist: Record<string, number> = {};
  for (const row of carrierDistRows) {
    const carrier = row.logistics_carrier || '未指定';
    carrierDist[carrier] = Number(row.count);
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
      inTransitCartonCount: Number(inTransitCartonCount?.count || 0),
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
      carrierDistribution: Object.entries(carrierDist).map(([carrier, count]) => ({
        carrier,
        count,
      })),
      recentTrend: trendDays,
    },
  });
});

tracking.post('/export', async (c) => {
  if (!await requirePermission(c, 'tracking.export')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }

  const params = new URL(c.req.url).searchParams;
  const fromWarehouse = params.get('from_warehouse');
  const toWarehouse = params.get('to_warehouse');
  const transportType = params.get('transport_type');
  const isTimeout = params.get('is_timeout');
  const logisticsCarrier = params.get('logistics_carrier');
  const team = params.get('team');
  const abnormal = params.get('abnormal');
  const transferNosParam = params.get('transfer_nos');

  const task = createTask('tracking', '在途明细.xlsx');
  cleanOldTasks();

  (async () => {
    try {
      updateProgress(task.id, 10, 100);

      let query = db('transfer_orders').whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED']);
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
      if (transferNosParam) {
        const transferNos = transferNosParam.split(',').filter(Boolean);
        query = query.whereIn('transfer_no', transferNos);
      }

      updateProgress(task.id, 20);

      const [slaRules, warehouseIdMap] = await Promise.all([getSlaRules(), getWarehouseIdMap()]);

      const orders = await query.clone().select([
        'transfer_orders.id', 'transfer_orders.transfer_no', 'transfer_orders.inbound_order_no',
        'transfer_orders.from_warehouse', 'transfer_orders.to_warehouse', 'transfer_orders.status',
        'transfer_orders.transport_type', 'transfer_orders.logistics_carrier', 'transfer_orders.logistics_tracking_no',
        'transfer_orders.team', 'transfer_orders.total_sku_count', 'transfer_orders.total_qty',
        'transfer_orders.total_carton_count', 'transfer_orders.pickup_time', 'transfer_orders.departure_time',
        'transfer_orders.arrival_port_time', 'transfer_orders.customs_clearance_time',
        'transfer_orders.last_mile_pickup_time', 'transfer_orders.logistics_sign_time',
        'transfer_orders.unload_time', 'transfer_orders.shelf_time', 'transfer_orders.is_customs_declared',
        'transfer_orders.is_inspected', 'transfer_orders.timeline_requirement_days',
        'transfer_orders.expected_arrival_date', 'transfer_orders.expected_shelf_date',
        'transfer_orders.is_logistics_abnormal', 'transfer_orders.logistics_abnormal_type',
        'transfer_orders.logistics_abnormal_remark', 'transfer_orders.is_shelf_abnormal',
        'transfer_orders.shelf_abnormal_type', 'transfer_orders.delay_explanation',
        'transfer_orders.last_mile_channel', 'transfer_orders.remark',
      ]);

      updateProgress(task.id, 40);

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

      const cartons = filteredTransferNos.length > 0
        ? await db('transfer_cartons').whereIn('transfer_no', filteredTransferNos).select([
            'id', 'transfer_no', 'carton_no', 'departure_time', 'arrival_port_time',
            'customs_clearance_time', 'last_mile_pickup_time', 'logistics_sign_time',
            'unload_time', 'shelf_time', 'unload_to_shelf_days',
          ])
        : [];

      const cartonItems = filteredTransferNos.length > 0
        ? await db('transfer_carton_items').whereIn('transfer_no', filteredTransferNos).select([
            'id', 'transfer_no', 'carton_no', 'sku_code', 'sku_name', 'overseas_sku_code', 'qty',
          ])
        : [];

      const orderItems = filteredTransferNos.length > 0
        ? await db('transfer_order_items').whereIn('transfer_no', filteredTransferNos).select([
            'id', 'transfer_no', 'sku_code', 'sku_name', 'overseas_sku_code',
            'expected_qty', 'outbound_qty', 'shelf_qty',
          ])
        : [];

      updateProgress(task.id, 60);

      const cartonItemsByCarton: Record<string, any[]> = {};
      for (const ci of cartonItems) {
        if (!cartonItemsByCarton[ci.carton_no]) cartonItemsByCarton[ci.carton_no] = [];
        cartonItemsByCarton[ci.carton_no].push(ci);
      }
      const cartonsByOrder: Record<string, any[]> = {};
      for (const ctn of cartons) {
        if (!cartonsByOrder[ctn.transfer_no]) cartonsByOrder[ctn.transfer_no] = [];
        cartonsByOrder[ctn.transfer_no].push(ctn);
      }
      const orderItemsByOrder: Record<string, any[]> = {};
      for (const oi of orderItems) {
        if (!orderItemsByOrder[oi.transfer_no]) orderItemsByOrder[oi.transfer_no] = [];
        orderItemsByOrder[oi.transfer_no].push(oi);
      }

      const headers = [
        '第三方入库单号', '调拨单号', '入库单+箱号', '箱号', '系统SKU', '海外仓SKU',
        '计划数量', '实际发货数量', '上架数量', '状态', '上架情况', '发货仓', '目的仓',
        '团队', '运输类型', '运输时效要求(天)', '时效是否达标', '运单号', '发货日期',
        '离港时间', '到港时间', '清关时间', '尾程提取时间', '到仓日期', '卸货时间',
        '上架时间', '出库-到仓时效(天)', '出库-上架时效(天)', '卸货-上架时效(天)',
        '预计上架时间', '上架数量差异', '是否物流异常', '物流异常备注', '延迟说明',
        '是否查验', '尾程渠道分类', '发货日期年份', '发货日期月份',
      ];

      updateProgress(task.id, 70);

      const sheetData: any[][] = [];
      for (const order of filteredOrders) {
        const orderCartons = cartonsByOrder[order.transfer_no] || [];
        const oItems = orderItemsByOrder[order.transfer_no] || [];
        const orderItemBySku: Record<string, any> = {};
        for (const oi of oItems) orderItemBySku[oi.sku_code] = oi;

        const allShelved = oItems.length > 0 && oItems.every((i: any) => (i.shelf_qty || 0) >= (i.outbound_qty || i.expected_qty || 0));
        const noneShelved = oItems.length > 0 && oItems.every((i: any) => (i.shelf_qty || 0) === 0);
        let shelfStatus = '未上架';
        if (allShelved) shelfStatus = '已上架';
        else if (!noneShelved) shelfStatus = '部分上架';

        const slaDays = order.timeline_requirement_days || computeSlaDays(order.to_warehouse, order.transport_type, slaRules, warehouseIdMap);
        let isSlaMet = '';
        if (order.departure_time && order.logistics_sign_time) {
          const outboundToArrivalDays = Math.round((new Date(order.logistics_sign_time).getTime() - new Date(order.departure_time).getTime()) / 86400000 * 100) / 100;
          isSlaMet = outboundToArrivalDays <= slaDays ? '是' : '否';
        }
        const pickupDate = order.pickup_time;
        const pickupYear = pickupDate ? new Date(pickupDate).getFullYear() : '';
        const pickupMonth = pickupDate ? (new Date(pickupDate).getMonth() + 1) : '';

        const buildRow = (skuCode: string, overseasSku: string, cartonNo: string, expectedQty: number, outboundQty: number) => {
          const oi = orderItemBySku[skuCode];
          const shelfQty = oi ? (oi.shelf_qty || 0) : 0;
          const actualOutbound = outboundQty || (oi ? (oi.outbound_qty || 0) : 0);
          const actualExpected = expectedQty || (oi ? (oi.expected_qty || 0) : 0);
          const shelfDiff = shelfQty - actualOutbound;
          const inboundCartonKey = cartonNo ? `${order.inbound_order_no}+${cartonNo}` : order.inbound_order_no;
          const departTime = order.departure_time;
          const signTime = order.logistics_sign_time;
          const unloadTime = order.unload_time;
          const shelfTime = order.shelf_time;
          let outboundToArrivalDays: number | string = '';
          if (departTime && signTime) outboundToArrivalDays = Math.round((new Date(signTime).getTime() - new Date(departTime).getTime()) / 86400000 * 100) / 100;
          let outboundToShelfDays: number | string = '';
          if (departTime && shelfTime) outboundToShelfDays = Math.round((new Date(shelfTime).getTime() - new Date(departTime).getTime()) / 86400000 * 100) / 100;
          let unloadToShelfDays: number | string = '';
          if (unloadTime && shelfTime) unloadToShelfDays = Math.round((new Date(shelfTime).getTime() - new Date(unloadTime).getTime()) / 86400000 * 100) / 100;
          return [
            order.inbound_order_no, order.transfer_no, inboundCartonKey, cartonNo || '',
            skuCode || '', overseasSku || '', actualExpected, actualOutbound, shelfQty,
            order.status, shelfStatus, order.from_warehouse, order.to_warehouse, order.team,
            order.transport_type, order.timeline_requirement_days || '', isSlaMet,
            order.logistics_tracking_no || '', order.pickup_time || '', departTime || '',
            order.arrival_port_time || '', order.customs_clearance_time || '',
            order.last_mile_pickup_time || '', signTime || '', unloadTime || '',
            shelfTime || '', outboundToArrivalDays, outboundToShelfDays, unloadToShelfDays,
            order.expected_shelf_date || '', shelfDiff, order.is_logistics_abnormal ? '是' : '否',
            order.logistics_abnormal_remark || '', order.delay_explanation || '',
            order.is_inspected ? '是' : '否', order.last_mile_channel || '',
            pickupYear, pickupMonth,
          ];
        };

        if (orderCartons.length > 0) {
          for (const ctn of orderCartons) {
            const items = cartonItemsByCarton[ctn.carton_no] || [{}];
            for (const item of items) {
              sheetData.push(buildRow(item.sku_code || '', item.overseas_sku_code || '', ctn.carton_no, item.qty || 0, item.qty || 0));
            }
          }
        } else if (oItems.length > 0) {
          for (const oi of oItems) {
            sheetData.push(buildRow(oi.sku_code || '', oi.overseas_sku_code || '', '', oi.expected_qty || 0, oi.outbound_qty || 0));
          }
        } else {
          sheetData.push(buildRow('', '', '', 0, 0));
        }
      }

      updateProgress(task.id, 85);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
      XLSX.utils.book_append_sheet(wb, ws, '在途明细');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      updateProgress(task.id, 95);
      completeTask(task.id, buf);
    } catch (err: any) {
      failTask(task.id, err.message || '导出失败');
    }
  })();

  return c.json({ success: true, data: { taskId: task.id } });
});

tracking.get('/export/:taskId/status', async (c) => {
  const taskId = c.req.param('taskId');
  const task = getTask(taskId);
  if (!task) return c.json({ success: false, error: '任务不存在' }, 404);
  return c.json({
    success: true,
    data: {
      taskId: task.id,
      type: task.type,
      fileName: task.fileName,
      status: task.status,
      progress: task.progress,
      total: task.total,
      error: task.error,
    },
  });
});

tracking.get('/export/:taskId/download', async (c) => {
  const taskId = c.req.param('taskId');
  const task = getTask(taskId);
  if (!task) return c.json({ success: false, error: '任务不存在' }, 404);
  if (task.status !== 'completed' || !task.buffer) return c.json({ success: false, error: '文件未就绪' }, 400);
  return new Response(task.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${encodeURIComponent(task.fileName)}`,
    },
  });
});

tracking.post('/sla-check', async (c) => {
  if (!await requirePermission(c, 'tracking.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const [slaRules, warehouseIdMap] = await Promise.all([getSlaRules(), getWarehouseIdMap()]);

  const inTransitOrders = await db('transfer_orders')
    .whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED'])
    .select([
      'id',
      'status',
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
