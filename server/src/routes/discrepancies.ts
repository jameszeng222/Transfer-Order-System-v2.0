import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';
import { applyTimeRangeFilters } from '../utils/queryHelpers.js';

const discrepancies = new Hono();

const createDiscrepancySchema = z.object({
  transfer_no: z.string().min(1),
  carton_no: z.string().optional(),
  sku_code: z.string().min(1),
  sku_name: z.string().optional(),
  overseas_sku_code: z.string().optional(),
  inbound_order_no: z.string().optional(),
  discrepancy_category: z.enum(['QUANTITY_DIFF', 'QUALITY_ISSUE', 'LOGISTICS_ABNORMAL', 'SHELF_ABNORMAL']),
  discrepancy_type: z.enum(['SHORT_SHIPMENT', 'OVER_SHIPMENT', 'WRONG_ITEM', 'DAMAGED', 'DETERIORATED', 'TIMEOUT_PORT', 'TIMEOUT_CUSTOMS', 'TIMEOUT_DELIVERY', 'LOST', 'PARTIAL_SHELF', 'NOT_SHELVED', 'WRONG_SHELF']),
  discrepancy_qty: z.number().int().optional(),
  source: z.enum(['MANUAL', 'SHELF_SHORTAGE']).default('MANUAL'),
  resolution_remark: z.string().optional(),
});

const updateDiscrepancySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'CLOSED']).optional(),
  handler: z.string().optional(),
  resolution: z.string().optional(),
  resolution_remark: z.string().optional(),
});

discrepancies.post('/', zValidator('json', createDiscrepancySchema), async (c) => {
  if (!await requirePermission(c, 'discrepancy.handle')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const data = c.req.valid('json');
  const user = c.get('user');

  const order = await db('transfer_orders').where({ transfer_no: data.transfer_no }).first();
  if (!order) {
    return c.json({ success: false, error: '调拨单不存在' }, 404);
  }

  const [record] = await db('discrepancy_records').insert({
    ...data,
    status: 'PENDING',
    handler: user?.username || 'system',
  }).returning('*');

  return c.json({ success: true, data: record }, 201);
});

discrepancies.get('/stats', async (c) => {
  const [pendingResult, processingResult, closedResult, byCategory, byType] = await Promise.all([
    db('discrepancy_records').where({ status: 'PENDING' }).count('* as count').first(),
    db('discrepancy_records').where({ status: 'PROCESSING' }).count('* as count').first(),
    db('discrepancy_records').where({ status: 'CLOSED' }).count('* as count').first(),
    db('discrepancy_records')
      .select('discrepancy_category')
      .count('* as count')
      .groupBy('discrepancy_category'),
    db('discrepancy_records')
      .select('discrepancy_type')
      .count('* as count')
      .groupBy('discrepancy_type'),
  ]);

  return c.json({
    success: true,
    data: {
      pending_count: Number(pendingResult?.count || 0),
      processing_count: Number(processingResult?.count || 0),
      closed_count: Number(closedResult?.count || 0),
      by_category: byCategory.map((r: any) => ({
        category: r.discrepancy_category,
        count: Number(r.count),
      })),
      by_type: byType.map((r: any) => ({
        type: r.discrepancy_type,
        count: Number(r.count),
      })),
    },
  });
});

discrepancies.get('/', async (c) => {
  if (!await requirePermission(c, 'discrepancy.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const page = Number(c.req.query('page')) || 1;
  const MAX_PAGE_SIZE = 200;
const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, MAX_PAGE_SIZE);
  const status = c.req.query('status');
  const discrepancyCategory = c.req.query('discrepancy_category');
  const discrepancyType = c.req.query('discrepancy_type');
  const transferNo = c.req.query('transfer_no');

  let query = db('discrepancy_records')
    .leftJoin('transfer_orders', 'discrepancy_records.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'discrepancy_records.id',
      'discrepancy_records.transfer_no',
      'discrepancy_records.carton_no',
      'discrepancy_records.sku_code',
      'discrepancy_records.sku_name',
      'discrepancy_records.overseas_sku_code',
      'discrepancy_records.inbound_order_no as discrepancy_inbound_order_no',
      'discrepancy_records.discrepancy_category',
      'discrepancy_records.discrepancy_type',
      'discrepancy_records.discrepancy_qty',
      'discrepancy_records.status',
      'discrepancy_records.handler',
      'discrepancy_records.resolution',
      'discrepancy_records.resolution_remark',
      'discrepancy_records.source',
      'discrepancy_records.create_time',
      'discrepancy_records.update_time',
      'discrepancy_records.close_time',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse',
      'transfer_orders.inbound_order_no as order_inbound_order_no'
    );

  if (status) {
    query = query.where('discrepancy_records.status', status);
  }
  if (discrepancyCategory) {
    query = query.where('discrepancy_records.discrepancy_category', discrepancyCategory);
  }
  if (discrepancyType) {
    query = query.where('discrepancy_records.discrepancy_type', discrepancyType);
  }
  if (transferNo) {
    query = query.where('discrepancy_records.transfer_no', 'like', `%${transferNo}%`);
  }

  query = applyTimeRangeFilters(query, c, 'transfer_orders');

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const data = await query
    .clone()
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .orderBy('discrepancy_records.id', 'desc');

  return c.json({
    success: true,
    data,
    pagination: { total, page, pageSize },
  });
});

discrepancies.get('/:id', async (c) => {
  if (!await requirePermission(c, 'discrepancy.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const id = Number(c.req.param('id'));
  const item = await db('discrepancy_records')
    .leftJoin('transfer_orders', 'discrepancy_records.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'discrepancy_records.id',
      'discrepancy_records.transfer_no',
      'discrepancy_records.carton_no',
      'discrepancy_records.sku_code',
      'discrepancy_records.sku_name',
      'discrepancy_records.overseas_sku_code',
      'discrepancy_records.inbound_order_no as discrepancy_inbound_order_no',
      'discrepancy_records.discrepancy_category',
      'discrepancy_records.discrepancy_type',
      'discrepancy_records.discrepancy_qty',
      'discrepancy_records.status',
      'discrepancy_records.handler',
      'discrepancy_records.resolution',
      'discrepancy_records.resolution_remark',
      'discrepancy_records.source',
      'discrepancy_records.create_time',
      'discrepancy_records.update_time',
      'discrepancy_records.close_time',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse',
      'transfer_orders.inbound_order_no as order_inbound_order_no'
    )
    .where('discrepancy_records.id', id)
    .first();
  if (!item) {
    return c.json({ success: false, error: 'Discrepancy record not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

discrepancies.put('/:id', zValidator('json', updateDiscrepancySchema), async (c) => {
  if (!await requirePermission(c, 'discrepancy.handle')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const user = c.get('user');

  const existing = await db('discrepancy_records').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Discrepancy record not found' }, 404);
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = { update_time: now };
  const logEntries: any[] = [];

  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === 'CLOSED' && existing.status !== 'CLOSED') {
      updates.close_time = now;
    }
  }
  if (body.handler !== undefined) {
    updates.handler = body.handler;
  }
  if (body.resolution !== undefined) {
    updates.resolution = body.resolution;
  }
  if (body.resolution_remark !== undefined) {
    updates.resolution_remark = body.resolution_remark;
  }

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'update_time') continue;
    const oldValue = existing[key] != null ? String(existing[key]) : null;
    const newValue = value != null ? String(value) : null;
    if (oldValue !== newValue) {
      logEntries.push({
        record_type: 'discrepancy',
        record_id: id,
        transfer_no: existing.transfer_no,
        field_name: `discrepancy.${key}`,
        old_value: oldValue,
        new_value: newValue,
        change_source: 'MANUAL',
        operator: user?.username || 'unknown',
        change_time: now,
      });
    }
  }

  await db('discrepancy_records').where({ id }).update(updates);
  if (logEntries.length > 0) {
    await db('change_logs').insert(logEntries);
  }

  const updated = await db('discrepancy_records')
    .leftJoin('transfer_orders', 'discrepancy_records.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'discrepancy_records.id',
      'discrepancy_records.transfer_no',
      'discrepancy_records.carton_no',
      'discrepancy_records.sku_code',
      'discrepancy_records.sku_name',
      'discrepancy_records.overseas_sku_code',
      'discrepancy_records.inbound_order_no as discrepancy_inbound_order_no',
      'discrepancy_records.discrepancy_category',
      'discrepancy_records.discrepancy_type',
      'discrepancy_records.discrepancy_qty',
      'discrepancy_records.status',
      'discrepancy_records.handler',
      'discrepancy_records.resolution',
      'discrepancy_records.resolution_remark',
      'discrepancy_records.source',
      'discrepancy_records.create_time',
      'discrepancy_records.update_time',
      'discrepancy_records.close_time',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse',
      'transfer_orders.inbound_order_no as order_inbound_order_no'
    )
    .where('discrepancy_records.id', id)
    .first();

  return c.json({ success: true, data: updated });
});

export default discrepancies;
