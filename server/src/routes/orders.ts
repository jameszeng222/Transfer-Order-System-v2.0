import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { applyTimeRangeFilters } from '../utils/queryHelpers.js';
import { requirePermission } from '../middleware/auth.js';
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
  pickup_time: z.string().nullable().optional(),
  depart_time: z.string().nullable().optional(),
  arrive_port_time: z.string().nullable().optional(),
  clearance_time: z.string().nullable().optional(),
  last_mile_pickup_time: z.string().nullable().optional(),
  delivery_time: z.string().nullable().optional(),
  unload_time: z.string().nullable().optional(),
  shelve_time: z.string().nullable().optional(),
});

orders.get('/', async (c) => {
  if (!await requirePermission(c, 'order.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const page = Number(c.req.query('page')) || 1;
  const MAX_PAGE_SIZE = 200;
const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, MAX_PAGE_SIZE);
  const keyword = c.req.query('keyword') || '';
  const status = c.req.query('status');
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const source = c.req.query('source');
  const isLogisticsAbnormal = c.req.query('is_logistics_abnormal');
  const isShelfAbnormal = c.req.query('is_shelf_abnormal');
  const abnormal = c.req.query('abnormal');
  const logisticsCarrier = c.req.query('logistics_carrier');
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
  if (logisticsCarrier) query = query.where('logistics_carrier', logisticsCarrier);

  query = applyTimeRangeFilters(query, c);

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
  if (!await requirePermission(c, 'order.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const keyword = c.req.query('keyword') || '';
  const status = c.req.query('status');
  const fromWarehouse = c.req.query('from_warehouse');
  const toWarehouse = c.req.query('to_warehouse');
  const transportType = c.req.query('transport_type');
  const source = c.req.query('source');
  const isLogisticsAbnormal = c.req.query('is_logistics_abnormal');
  const isShelfAbnormal = c.req.query('is_shelf_abnormal');
  const isReconciled = c.req.query('is_reconciled');
  const abnormal = c.req.query('abnormal');
  const logisticsCarrier = c.req.query('logistics_carrier');

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
  if (isReconciled !== undefined && isReconciled !== '') {
    query = query.where('is_reconciled', isReconciled === 'true' ? 1 : 0);
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
  if (logisticsCarrier) query = query.where('logistics_carrier', logisticsCarrier);
  query = applyTimeRangeFilters(query, c);

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
  if (!await requirePermission(c, 'order.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Math.min(Number(c.req.query('pageSize')) || 10, 50);

  const allOrders = await db('transfer_orders')
    .whereIn('status', ['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED'])
    .select(['transfer_no', 'inbound_order_no', 'status', 'from_warehouse', 'to_warehouse', 'transport_type', 'logistics_carrier', 'logistics_tracking_no', 'total_carton_count', 'total_freight_amount', 'is_reconciled'])
    .orderBy('create_time', 'desc');

  const cartonData = await db('transfer_cartons')
    .whereIn('transfer_no', allOrders.map(o => o.transfer_no))
    .whereNotNull('carton_weight')
    .select(['transfer_no']);

  const cartonsWithWeight = new Set(cartonData.map((c: any) => c.transfer_no));

  const enriched = allOrders.map((o: any) => ({
    ...o,
    has_basic_info: !!(o.from_warehouse && o.to_warehouse && o.transport_type && o.total_carton_count > 0),
    has_logistics_info: !!(o.logistics_carrier && o.logistics_tracking_no),
    has_carton_specs: cartonsWithWeight.has(o.transfer_no),
    has_outbound: o.status !== 'PENDING_OUTBOUND',
    has_freight: !!(o.total_freight_amount > 0 || o.is_reconciled),
  }));

  const incomplete = enriched.filter((o: any) => !o.has_basic_info || !o.has_logistics_info || !o.has_carton_specs || !o.has_outbound || !o.has_freight);
  const total = incomplete.length;
  const paginated = incomplete.slice((page - 1) * pageSize, page * pageSize);

  return c.json({ success: true, data: paginated, pagination: { total, page, pageSize } });
});

const statusChangeWithTransferSchema = statusChangeSchema.extend({ transferNo: z.string().min(1) });

orders.put('/status', zValidator('json', statusChangeWithTransferSchema), async (c) => {
  if (!await requirePermission(c, 'order.confirm')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const { transferNo, status: newStatus, remark } = c.req.valid('json');
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

  if (newStatus === 'OUTBOUNDED' && !order.depart_time) updates.depart_time = now;
  if (newStatus === 'IN_TRANSIT' && !order.pickup_time) updates.pickup_time = now;
  if (newStatus === 'RECEIVED' && !order.delivery_time) updates.delivery_time = now;
  if (newStatus === 'SHELVED' && !order.shelve_time) updates.shelve_time = now;

  await db('transfer_orders').where({ transfer_no: transferNo }).update(updates);

  const pickupTime = updates.pickup_time || order.pickup_time;
  const timelineDays = order.timeline_requirement_days;
  if (pickupTime && timelineDays && !order.expected_arrival_date) {
    const pickupDate = new Date(pickupTime);
    const arrivalDate = new Date(pickupDate.getTime() + Number(timelineDays) * 86400000);
    await db('transfer_orders').where({ transfer_no: transferNo }).update({
      expected_arrival_date: arrivalDate.toISOString().slice(0, 10),
      expected_shelf_date: new Date(arrivalDate.getTime() + 3 * 86400000).toISOString().slice(0, 10),
    });
  }

  if (updates.delivery_time || updates.shelve_time || updates.unload_time) {
    const cartons = await db('transfer_cartons').where({ transfer_no: transferNo });
    for (const ctn of cartons) {
      const ctnUpdates: Record<string, any> = {};
      const depart = ctn.departure_time;
      const sign = updates.delivery_time || ctn.logistics_sign_time;
      const unload = updates.unload_time || ctn.unload_time;
      const shelf = updates.shelve_time || ctn.shelf_time;

      for (const [orderField, cartonField] of Object.entries({
        depart_time: 'departure_time', arrive_port_time: 'arrival_port_time',
        clearance_time: 'customs_clearance_time', last_mile_pickup_time: 'last_mile_pickup_time',
        delivery_time: 'logistics_sign_time', unload_time: 'unload_time', shelve_time: 'shelf_time',
      })) {
        if ((updates as any)[orderField]) ctnUpdates[cartonField] = (updates as any)[orderField];
      }
      if (depart && sign) {
        ctnUpdates.checkout_to_sign_days = Math.round((new Date(sign).getTime() - new Date(depart).getTime()) / 86400000 * 100) / 100;
        ctnUpdates.is_carton_within_11days = ctnUpdates.checkout_to_sign_days <= 11;
        ctnUpdates.is_carton_within_7days = ctnUpdates.checkout_to_sign_days <= 7;
        ctnUpdates.is_carton_within_4days = ctnUpdates.checkout_to_sign_days <= 4;
      }
      if (sign && shelf) {
        ctnUpdates.sign_to_shelf_days = Math.round((new Date(shelf).getTime() - new Date(sign).getTime()) / 86400000 * 100) / 100;
        ctnUpdates.is_shelf_within_3days = ctnUpdates.sign_to_shelf_days <= 3;
      }
      if (unload && shelf) {
        ctnUpdates.unload_to_shelf_days = Math.round((new Date(shelf).getTime() - new Date(unload).getTime()) / 86400000 * 100) / 100;
      }
      if (Object.keys(ctnUpdates).length > 0) {
        await db('transfer_cartons').where({ id: ctn.id }).update(ctnUpdates);
      }
    }
  }

  await db('change_logs').insert({
    record_type: 'TRANSFER_ORDER',
    record_id: order.id,
    transfer_no: transferNo,
    field_name: 'status',
    old_value: order.status,
    new_value: newStatus,
    change_source: 'MANUAL',
    operator: user?.username || 'system',
    change_time: now,
    reason: remark || null,
  });

  const updated = await db('transfer_orders').where({ transfer_no: transferNo }).first();
  return c.json({ success: true, data: updated });
});

orders.put('/batch-status', zValidator('json', z.object({
  transferNos: z.array(z.string().min(1)).min(1),
  status: z.enum(['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED', 'CANCELLED']),
  remark: z.string().optional(),
})), async (c) => {
  if (!await requirePermission(c, 'order.confirm')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const { transferNos, status: newStatus, remark } = c.req.valid('json');
  const user = c.get('user');

  const orders = await db('transfer_orders').whereIn('transfer_no', transferNos);
  const orderMap = new Map(orders.map((o: any) => [o.transfer_no, o]));

  const validUpdates: any[] = [];
  const changeLogEntries: any[] = [];
  const results: { transferNo: string; success: boolean; error?: string }[] = [];
  const now = new Date().toISOString();

  for (const transferNo of transferNos) {
    const order = orderMap.get(transferNo);
    if (!order) {
      results.push({ transferNo, success: false, error: '不存在' });
      continue;
    }
    const allowedNext = STATUS_FLOW[order.status] || [];
    if (!allowedNext.includes(newStatus)) {
      results.push({ transferNo, success: false, error: `不允许从 ${order.status} 变更为 ${newStatus}` });
      continue;
    }
    if (newStatus === 'COMPLETED' && !order.is_reconciled) {
      results.push({ transferNo, success: false, error: '未完成对账' });
      continue;
    }

    const updates: Record<string, any> = { status: newStatus, update_time: now };
    if (newStatus === 'OUTBOUNDED' && !order.depart_time) updates.depart_time = now;
    if (newStatus === 'IN_TRANSIT' && !order.pickup_time) updates.pickup_time = now;
    if (newStatus === 'RECEIVED' && !order.delivery_time) updates.delivery_time = now;
    if (newStatus === 'SHELVED' && !order.shelve_time) updates.shelve_time = now;

    validUpdates.push({ transferNo, updates, order });
    changeLogEntries.push({
      record_type: 'TRANSFER_ORDER',
      record_id: order.id,
      transfer_no: transferNo,
      field_name: 'status',
      old_value: order.status,
      new_value: newStatus,
      change_source: 'MANUAL',
      operator: user?.username || 'system',
      change_time: now,
      reason: remark || `批量状态变更: ${order.status} → ${newStatus}`,
    });
    results.push({ transferNo, success: true });
  }

  if (validUpdates.length > 0) {
    const updateGroups = new Map<string, string[]>();
    for (const { transferNo, updates } of validUpdates) {
      const key = JSON.stringify(updates);
      if (!updateGroups.has(key)) updateGroups.set(key, []);
      updateGroups.get(key)!.push(transferNo);
    }
    for (const [updatesJson, nos] of updateGroups) {
      const updates = JSON.parse(updatesJson);
      await db('transfer_orders').whereIn('transfer_no', nos).update(updates);
    }
    if (changeLogEntries.length > 0) {
      await db('change_logs').insert(changeLogEntries);
    }

    for (const { transferNo, updates, order } of validUpdates) {
      const pickupTime = updates.pickup_time || order.pickup_time;
      const timelineDays = order.timeline_requirement_days;
      if (pickupTime && timelineDays && !order.expected_arrival_date) {
        const pickupDate = new Date(pickupTime);
        const arrivalDate = new Date(pickupDate.getTime() + Number(timelineDays) * 86400000);
        await db('transfer_orders').where({ transfer_no: transferNo }).update({
          expected_arrival_date: arrivalDate.toISOString().slice(0, 10),
          expected_shelf_date: new Date(arrivalDate.getTime() + 3 * 86400000).toISOString().slice(0, 10),
        });
      }

      if (updates.delivery_time || updates.shelve_time || updates.unload_time) {
        const cartons = await db('transfer_cartons').where({ transfer_no: transferNo });
        for (const ctn of cartons) {
          const ctnUpdates: Record<string, any> = {};
          const depart = ctn.departure_time;
          const sign = updates.delivery_time || ctn.logistics_sign_time;
          const unload = updates.unload_time || ctn.unload_time;
          const shelf = updates.shelve_time || ctn.shelf_time;
          for (const [of, cf] of Object.entries({
            depart_time: 'departure_time', arrive_port_time: 'arrival_port_time',
            clearance_time: 'customs_clearance_time', last_mile_pickup_time: 'last_mile_pickup_time',
            delivery_time: 'logistics_sign_time', unload_time: 'unload_time', shelve_time: 'shelf_time',
          })) { if ((updates as any)[of]) ctnUpdates[cf] = (updates as any)[of]; }
          if (depart && sign) {
            ctnUpdates.checkout_to_sign_days = Math.round((new Date(sign).getTime() - new Date(depart).getTime()) / 86400000 * 100) / 100;
            ctnUpdates.is_carton_within_11days = ctnUpdates.checkout_to_sign_days <= 11;
            ctnUpdates.is_carton_within_7days = ctnUpdates.checkout_to_sign_days <= 7;
            ctnUpdates.is_carton_within_4days = ctnUpdates.checkout_to_sign_days <= 4;
          }
          if (sign && shelf) {
            ctnUpdates.sign_to_shelf_days = Math.round((new Date(shelf).getTime() - new Date(sign).getTime()) / 86400000 * 100) / 100;
            ctnUpdates.is_shelf_within_3days = ctnUpdates.sign_to_shelf_days <= 3;
          }
          if (unload && shelf) {
            ctnUpdates.unload_to_shelf_days = Math.round((new Date(shelf).getTime() - new Date(unload).getTime()) / 86400000 * 100) / 100;
          }
          if (Object.keys(ctnUpdates).length > 0) {
            await db('transfer_cartons').where({ id: ctn.id }).update(ctnUpdates);
          }
        }
      }
    }
  }

  return c.json({ success: true, data: results });
});

const editOrderWithTransferSchema = editOrderSchema.extend({ transferNo: z.string().min(1) });

orders.put('/edit', zValidator('json', editOrderWithTransferSchema), async (c) => {
  if (!await requirePermission(c, 'order.edit')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const { transferNo, ...body } = c.req.valid('json');
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
