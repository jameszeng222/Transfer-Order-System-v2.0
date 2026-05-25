import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import XLSX from 'xlsx';

const STATUS_FLOW: Record<string, string[]> = {
  PENDING_OUTBOUND: ['OUTBOUNDED', 'CANCELLED'],
  OUTBOUNDED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['SHELVED', 'CANCELLED'],
  SHELVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const orders = new Hono();

const statusChangeSchema = z.object({
  status: z.enum([
    'PENDING_OUTBOUND',
    'OUTBOUNDED',
    'IN_TRANSIT',
    'RECEIVED',
    'SHELVED',
    'COMPLETED',
    'CANCELLED',
  ]),
  remark: z.string().optional(),
});

const editOrderSchema = z.object({
  logistics_carrier: z.string().optional(),
  logistics_tracking_no: z.string().optional(),
  is_customs_declared: z.boolean().optional(),
  customs_factory: z.string().optional(),
  is_inspected: z.boolean().optional(),
  timeline_requirement_days: z.number().optional(),
  order_remark: z.string().optional(),
  last_mile_type: z.string().optional(),
  last_mile_channel: z.string().optional(),
  delay_explanation: z.string().optional(),
  remark: z.string().optional(),
  logistics_abnormal_remark: z.string().optional(),
  shelf_abnormal_remark: z.string().optional(),
});

orders.get('/', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const keyword = c.req.query('keyword') || '';
  const status = c.req.query('status');
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const source = c.req.query('source');
  const isLogisticsAbnormal = c.req.query('is_logistics_abnormal');
  const isShelfAbnormal = c.req.query('is_shelf_abnormal');
  const abnormal = c.req.query('abnormal');
  const sortBy = c.req.query('sortBy') || 'create_time';
  const sortOrder = c.req.query('sortOrder') || 'desc';

  let query = db('transfer_orders');

  if (keyword) {
    query = query.where(function () {
      this.where('transfer_no', 'like', `%${keyword}%`)
        .orWhere('inbound_order_no', 'like', `%${keyword}%`);
    });
  }
  if (status) {
    query = query.where('status', status);
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
  if (source) {
    query = query.where('source', source);
  }
  if (isLogisticsAbnormal !== undefined && isLogisticsAbnormal !== '') {
    query = query.where('is_logistics_abnormal', isLogisticsAbnormal === 'true' ? 1 : 0);
  }
  if (isShelfAbnormal !== undefined && isShelfAbnormal !== '') {
    query = query.where('is_shelf_abnormal', isShelfAbnormal === 'true' ? 1 : 0);
  }
  if (abnormal) {
    if (abnormal === 'logistics') {
      query = query.where('is_logistics_abnormal', 1);
    } else if (abnormal === 'shelf') {
      query = query.where('is_shelf_abnormal', 1);
    } else if (abnormal === 'any' || abnormal === 'true') {
      query = query.where(function() {
        this.where('is_logistics_abnormal', 1).orWhere('is_shelf_abnormal', 1);
      });
    }
  }

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const allowedSortFields = [
    'create_time',
    'pickup_time',
    'delivery_time',
    'shelve_time',
    'total_qty',
    'total_carton_count',
  ];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'create_time';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  const data = await query
    .clone()
    .select([
      'transfer_no',
      'inbound_order_no',
      'from_warehouse',
      'to_warehouse',
      'status',
      'transport_type',
      'total_sku_count',
      'total_qty',
      'total_carton_count',
      'logistics_carrier',
      'is_logistics_abnormal',
      'is_shelf_abnormal',
      'is_reconciled',
      'create_time',
      'pickup_time',
      'delivery_time',
      'shelve_time',
    ])
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .orderBy(safeSortBy, safeSortOrder);

  return c.json({
    success: true,
    data,
    pagination: { total, page, pageSize },
  });
});

orders.get('/export', async (c) => {
  const keyword = c.req.query('keyword') || '';
  const status = c.req.query('status');
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const source = c.req.query('source');
  const abnormal = c.req.query('abnormal');

  let query = db('transfer_orders');

  if (keyword) {
    query = query.where(function () {
      this.where('transfer_no', 'like', `%${keyword}%`)
        .orWhere('inbound_order_no', 'like', `%${keyword}%`);
    });
  }
  if (status) {
    query = query.where('status', status);
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
  if (source) {
    query = query.where('source', source);
  }
  if (abnormal) {
    if (abnormal === 'logistics') {
      query = query.where('is_logistics_abnormal', 1);
    } else if (abnormal === 'shelf') {
      query = query.where('is_shelf_abnormal', 1);
    } else if (abnormal === 'any' || abnormal === 'true') {
      query = query.where(function() {
        this.where('is_logistics_abnormal', 1).orWhere('is_shelf_abnormal', 1);
      });
    }
  }

  const data = await query
    .select([
      'transfer_no',
      'inbound_order_no',
      'from_warehouse',
      'to_warehouse',
      'transport_type',
      'status',
      'total_sku_count',
      'total_qty',
      'total_carton_count',
      'logistics_carrier',
      'is_logistics_abnormal',
      'is_shelf_abnormal',
      'create_time',
    ])
    .limit(10000)
    .orderBy('create_time', 'desc');

  const rows = data.map((row: any) => ({
    '调拨单号': row.transfer_no,
    '入库单号': row.inbound_order_no,
    '来源仓': row.from_warehouse,
    '目的仓': row.to_warehouse,
    '运输类型': row.transport_type,
    '状态': row.status,
    'SKU数': row.total_sku_count,
    '总数量': row.total_qty,
    '箱数': row.total_carton_count,
    '物流商': row.logistics_carrier,
    '物流异常': row.is_logistics_abnormal ? '是' : '否',
    '上架异常': row.is_shelf_abnormal ? '是' : '否',
    '创建时间': row.create_time,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '调拨单');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=orders_export.xlsx',
    },
  });
});

orders.get('/in-progress', async (c) => {
  const orders = await db('transfer_orders')
    .whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED'])
    .select(['transfer_no', 'inbound_order_no', 'status', 'from_warehouse', 'to_warehouse', 'transport_type', 'logistics_carrier', 'logistics_tracking_no', 'total_carton_count', 'total_freight_amount', 'is_reconciled'])
    .orderBy('create_time', 'desc')
    .limit(50);

  const cartonData = await db('transfer_cartons')
    .whereIn('transfer_no', orders.map(o => o.transfer_no))
    .whereNotNull('carton_weight')
    .select(['transfer_no']);

  const cartonsWithWeight = new Set(cartonData.map((c: any) => c.transfer_no));

  const result = orders.map((o: any) => ({
    ...o,
    has_basic_info: !!(o.from_warehouse && o.to_warehouse && o.transport_type && o.total_carton_count > 0),
    has_logistics_info: !!(o.logistics_carrier && o.logistics_tracking_no),
    has_carton_specs: cartonsWithWeight.has(o.transfer_no),
    has_outbound: o.status !== 'PENDING_OUTBOUND',
    has_freight: !!(o.total_freight_amount > 0 || o.is_reconciled),
  }));

  return c.json({ success: true, data: result });
});

orders.get('/:transferNo', async (c) => {
  const transferNo = c.req.param('transferNo');

  const order = await db('transfer_orders').where({ transfer_no: transferNo }).first();
  if (!order) {
    return c.json({ success: false, error: 'Transfer order not found' }, 404);
  }

  const [items, cartons, trackingEvents, discrepancyRecords, freightBills, changeLogs] =
    await Promise.all([
      db('transfer_order_items').where({ transfer_no: transferNo }),
      db('transfer_cartons').where({ transfer_no: transferNo }),
      db('tracking_events')
        .where({ transfer_no: transferNo })
        .orderBy('event_time', 'desc'),
      db('discrepancy_records').where({ transfer_no: transferNo }),
      db('freight_bills').where({ transfer_no: transferNo }),
      db('change_logs')
        .where({ transfer_no: transferNo })
        .orderBy('change_time', 'desc')
        .limit(20),
    ]);

  const cartonNos = cartons.map((ct: any) => ct.carton_no);
  let cartonItems: any[] = [];
  if (cartonNos.length > 0) {
    cartonItems = await db('transfer_carton_items')
      .where({ transfer_no: transferNo })
      .whereIn('carton_no', cartonNos);
  }

  const cartonItemsMap: Record<string, any[]> = {};
  for (const ci of cartonItems) {
    if (!cartonItemsMap[ci.carton_no]) {
      cartonItemsMap[ci.carton_no] = [];
    }
    cartonItemsMap[ci.carton_no].push(ci);
  }

  const cartonsWithItems = cartons.map((ct: any) => ({
    ...ct,
    carton_items: cartonItemsMap[ct.carton_no] || [],
  }));

  return c.json({
    success: true,
    data: {
      ...order,
      items,
      cartons: cartonsWithItems,
      tracking_events: trackingEvents,
      discrepancy_records: discrepancyRecords,
      freight_bills: freightBills,
      change_logs: changeLogs,
    },
  });
});

orders.put('/:transferNo/status', zValidator('json', statusChangeSchema), async (c) => {
  const transferNo = c.req.param('transferNo');
  const { status: newStatus, remark } = c.req.valid('json');
  const user = c.get('user');

  const order = await db('transfer_orders').where({ transfer_no: transferNo }).first();
  if (!order) {
    return c.json({ success: false, error: 'Transfer order not found' }, 404);
  }

  const allowedNext = STATUS_FLOW[order.status] || [];
  if (!allowedNext.includes(newStatus)) {
    return c.json(
      {
        success: false,
        error: `不允许从 ${order.status} 变更为 ${newStatus}，允许的目标状态: ${allowedNext.join(', ') || '无'}`,
      },
      400
    );
  }

  if (newStatus === 'COMPLETED' && !order.is_reconciled) {
    return c.json(
      { success: false, error: '未完成对账，无法确认完成' },
      400
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = {
    status: newStatus,
    update_time: now,
  };

  if (newStatus === 'OUTBOUNDED') {
    updates.pickup_time = now;
  } else if (newStatus === 'RECEIVED') {
    updates.delivery_time = now;
  } else if (newStatus === 'SHELVED') {
    updates.shelve_time = now;
  }

  await db('transfer_orders').where({ transfer_no: transferNo }).update(updates);

  await db('change_logs').insert({
    record_type: 'transfer_order',
    record_id: order.id,
    transfer_no: transferNo,
    field_name: 'status',
    old_value: order.status,
    new_value: newStatus,
    change_source: 'MANUAL',
    operator: user?.username || 'unknown',
    change_time: now,
    reason: remark || null,
  });

  const updated = await db('transfer_orders').where({ transfer_no: transferNo }).first();
  return c.json({ success: true, data: updated });
});

orders.put('/:transferNo', zValidator('json', editOrderSchema), async (c) => {
  const transferNo = c.req.param('transferNo');
  const body = c.req.valid('json');
  const user = c.get('user');

  const order = await db('transfer_orders').where({ transfer_no: transferNo }).first();
  if (!order) {
    return c.json({ success: false, error: 'Transfer order not found' }, 404);
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = { update_time: now };
  const logEntries: any[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    const oldValue = order[key];
    const newValue = String(value);
    if (String(oldValue) !== newValue) {
      updates[key] = value;
      logEntries.push({
        record_type: 'transfer_order',
        record_id: order.id,
        transfer_no: transferNo,
        field_name: key,
        old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue,
        change_source: 'MANUAL',
        operator: user?.username || 'unknown',
        change_time: now,
      });
    }
  }

  if (Object.keys(updates).length > 1) {
    await db('transfer_orders').where({ transfer_no: transferNo }).update(updates);
    if (logEntries.length > 0) {
      await db('change_logs').insert(logEntries);
    }
  }

  const updated = await db('transfer_orders').where({ transfer_no: transferNo }).first();
  return c.json({ success: true, data: updated });
});

export default orders;
