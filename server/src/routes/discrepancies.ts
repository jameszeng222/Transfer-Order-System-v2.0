import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';

const discrepancies = new Hono();

const updateDiscrepancySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'CLOSED']).optional(),
  handler: z.string().optional(),
  resolution: z.string().optional(),
  resolution_remark: z.string().optional(),
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
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const status = c.req.query('status');
  const discrepancyCategory = c.req.query('discrepancy_category');
  const discrepancyType = c.req.query('discrepancy_type');
  const transferNo = c.req.query('transfer_no');

  let query = db('discrepancy_records')
    .leftJoin('transfer_orders', 'discrepancy_records.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'discrepancy_records.*',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse',
      'transfer_orders.inbound_order_no'
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
  const id = Number(c.req.param('id'));
  const item = await db('discrepancy_records')
    .leftJoin('transfer_orders', 'discrepancy_records.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'discrepancy_records.*',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse',
      'transfer_orders.inbound_order_no'
    )
    .where('discrepancy_records.id', id)
    .first();
  if (!item) {
    return c.json({ success: false, error: 'Discrepancy record not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

discrepancies.put('/:id', zValidator('json', updateDiscrepancySchema), async (c) => {
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
        record_type: 'transfer_order',
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
      'discrepancy_records.*',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse',
      'transfer_orders.inbound_order_no'
    )
    .where('discrepancy_records.id', id)
    .first();

  return c.json({ success: true, data: updated });
});

export default discrepancies;
