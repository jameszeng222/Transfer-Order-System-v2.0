import { Hono } from 'hono';
import { db } from '../db/index.js';
import XLSX from 'xlsx';

const tracking = new Hono();

interface SlaRule {
  dest_warehouse_id: number;
  transport_type: string;
  sla_days: number;
}

async function getSlaRules(): Promise<SlaRule[]> {
  return db('sla_rules').select('dest_warehouse_id', 'transport_type', 'sla_days');
}

async function getWarehouseIdMap(): Promise<Record<string, number>> {
  const warehouses = await db('warehouses').select('id', 'warehouse_code');
  const map: Record<string, number> = {};
  for (const w of warehouses) {
    map[w.warehouse_code] = w.id;
  }
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
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const isTimeout = c.req.query('is_timeout');

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
      'depart_time',
      'arrive_port_time',
      'clearance_time',
      'last_mile_pickup_time',
      'delivery_time',
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
    const slaDays = computeSlaDays(row.to_warehouse, row.transport_type, slaRules, warehouseIdMap);
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
  const [slaRules, warehouseIdMap] = await Promise.all([getSlaRules(), getWarehouseIdMap()]);

  const inTransitOrders = await db('transfer_orders')
    .where('status', 'IN_TRANSIT')
    .select([
      'id',
      'to_warehouse',
      'transport_type',
      'pickup_time',
    ]);

  let timeoutCount = 0;
  let approachingCount = 0;

  const warehouseDist: Record<string, number> = {};
  const transportDist: Record<string, number> = {};

  for (const order of inTransitOrders) {
    const slaDays = computeSlaDays(order.to_warehouse, order.transport_type, slaRules, warehouseIdMap);
    const remaining = computeRemainingDays(order.pickup_time, slaDays);

    if (remaining !== null && remaining <= 0) {
      timeoutCount++;
    } else if (remaining !== null && remaining > 0 && remaining <= 3) {
      approachingCount++;
    }

    warehouseDist[order.to_warehouse] = (warehouseDist[order.to_warehouse] || 0) + 1;
    transportDist[order.transport_type] = (transportDist[order.transport_type] || 0) + 1;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentReceived = await db('transfer_orders')
    .where('status', 'RECEIVED')
    .where('delivery_time', '>=', sevenDaysAgo.toISOString())
    .select('delivery_time');

  const dailyTrend: Record<string, number> = {};
  for (const r of recentReceived) {
    if (r.delivery_time) {
      const day = new Date(r.delivery_time).toISOString().slice(0, 10);
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
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const isTimeout = c.req.query('is_timeout');

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

  const [slaRules, warehouseIdMap] = await Promise.all([getSlaRules(), getWarehouseIdMap()]);

  const data = await query.clone().select([
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
    'depart_time',
    'arrive_port_time',
    'clearance_time',
    'last_mile_pickup_time',
    'delivery_time',
    'is_customs_declared',
    'is_inspected',
    'timeline_requirement_days',
    'expected_arrival_date',
    'is_logistics_abnormal',
    'logistics_abnormal_type',
    'logistics_abnormal_remark',
    'is_shelf_abnormal',
    'shelf_abnormal_type',
    'estimated_unit_price',
    'estimated_freight',
    'freight_currency',
    'is_reconciled',
    'is_paid',
    'create_time',
    'remark',
  ]);

  const rows = data.map((row: any) => {
    const slaDays = computeSlaDays(row.to_warehouse, row.transport_type, slaRules, warehouseIdMap);
    const remainingDays = computeRemainingDays(row.pickup_time, slaDays);
    const timeout = remainingDays !== null && remainingDays <= 0;
    return { ...row, is_timeout: timeout };
  });

  const filtered = isTimeout !== undefined && isTimeout !== ''
    ? rows.filter((r: any) => {
        if (isTimeout === 'true') return r.is_timeout;
        return !r.is_timeout;
      })
    : rows;

  const headers = [
    '调拨单号',
    '入库单号',
    '来源仓',
    '目的仓',
    '状态',
    '运输类型',
    '物流商',
    '物流单号',
    '团队',
    'SKU数量',
    '总数量',
    '总箱数',
    '提货时间',
    '发车时间',
    '到港时间',
    '清关时间',
    '尾程提货时间',
    '签收时间',
    '是否报关',
    '是否查验',
    '时效要求天数',
    '预计到达日期',
    '是否物流异常',
    '物流异常类型',
    '物流异常备注',
    '是否上架异常',
    '上架异常类型',
    '预估单价',
    '预估运费',
    '运费币种',
    '是否对账',
    '是否付款',
    '创建时间',
    '备注',
  ];

  const sheetData = filtered.map((row: any) => [
    row.transfer_no,
    row.inbound_order_no,
    row.from_warehouse,
    row.to_warehouse,
    row.status,
    row.transport_type,
    row.logistics_carrier,
    row.logistics_tracking_no,
    row.team,
    row.total_sku_count,
    row.total_qty,
    row.total_carton_count,
    row.pickup_time,
    row.depart_time,
    row.arrive_port_time,
    row.clearance_time,
    row.last_mile_pickup_time,
    row.delivery_time,
    row.is_customs_declared ? '是' : '否',
    row.is_inspected ? '是' : '否',
    row.timeline_requirement_days,
    row.expected_arrival_date,
    row.is_logistics_abnormal ? '是' : '否',
    row.logistics_abnormal_type,
    row.logistics_abnormal_remark,
    row.is_shelf_abnormal ? '是' : '否',
    row.shelf_abnormal_type,
    row.estimated_unit_price,
    row.estimated_freight,
    row.freight_currency,
    row.is_reconciled ? '是' : '否',
    row.is_paid ? '是' : '否',
    row.create_time,
    row.remark,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
  XLSX.utils.book_append_sheet(wb, ws, '在途明细');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', 'attachment; filename=intransit_export.xlsx');

  return c.body(buf);
});

tracking.get('/sla-check', async (c) => {
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

  let checkedCount = inTransitOrders.length;
  let newTimeoutCount = 0;
  const now = new Date().toISOString();

  for (const order of inTransitOrders) {
    const slaDays = computeSlaDays(order.to_warehouse, order.transport_type, slaRules, warehouseIdMap);
    const remaining = computeRemainingDays(order.pickup_time, slaDays);

    if (remaining !== null && remaining <= 0) {
      if (!order.is_logistics_abnormal) {
        await db('transfer_orders').where({ id: order.id }).update({
          is_logistics_abnormal: true,
          logistics_abnormal_type: 'TIMEOUT_DELIVERY',
          update_time: now,
        });
        newTimeoutCount++;
      } else if (order.logistics_abnormal_type !== 'TIMEOUT_DELIVERY') {
        await db('transfer_orders').where({ id: order.id }).update({
          logistics_abnormal_type: 'TIMEOUT_DELIVERY',
          update_time: now,
        });
        newTimeoutCount++;
      }
    }
  }

  return c.json({
    success: true,
    data: {
      checkedCount,
      newTimeoutCount,
    },
  });
});

export default tracking;
