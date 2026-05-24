import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';

const sla = new Hono();

const createSlaSchema = z.object({
  dest_warehouse_id: z.number().int().positive(),
  transport_type: z.enum(['SEA', 'AIR', 'RAIL', 'TRUCK']),
  sla_days: z.number().int().positive(),
  shelf_sla_days: z.number().int().positive().optional(),
});

const updateSlaSchema = createSlaSchema.partial();

sla.get('/', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  let query = db('sla_rules')
    .leftJoin('warehouses', 'sla_rules.dest_warehouse_id', 'warehouses.id')
    .select(
      'sla_rules.*',
      'warehouses.warehouse_name as dest_warehouse_name'
    );

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const data = await query
    .clone()
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .orderBy('sla_rules.id', 'desc');

  return c.json({
    success: true,
    data,
    pagination: { total, page, pageSize },
  });
});

sla.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const item = await db('sla_rules')
    .leftJoin('warehouses', 'sla_rules.dest_warehouse_id', 'warehouses.id')
    .select('sla_rules.*', 'warehouses.warehouse_name as dest_warehouse_name')
    .where('sla_rules.id', id)
    .first();
  if (!item) {
    return c.json({ success: false, error: 'SLA rule not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

sla.post('/', zValidator('json', createSlaSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  const warehouse = await db('warehouses').where({ id: body.dest_warehouse_id }).first();
  if (!warehouse) {
    return c.json({ success: false, error: 'dest_warehouse_id 不存在' }, 400);
  }

  const existing = await db('sla_rules')
    .where({ dest_warehouse_id: body.dest_warehouse_id, transport_type: body.transport_type })
    .first();
  if (existing) {
    return c.json(
      { success: false, error: '该仓库和运输类型的SLA规则已存在' },
      400
    );
  }

  const now = new Date().toISOString();
  const [inserted] = await db('sla_rules')
    .insert({
      ...body,
      create_time: now,
      update_time: now,
    })
    .returning('*');

  await db('change_logs').insert({
    record_type: 'transfer_order',
    record_id: inserted.id,
    transfer_no: null,
    field_name: 'sla_rule_created',
    old_value: null,
    new_value: JSON.stringify(inserted),
    change_source: 'MANUAL',
    operator: user?.username || 'unknown',
    change_time: now,
  });

  return c.json({ success: true, data: inserted }, 201);
});

sla.put('/:id', zValidator('json', updateSlaSchema), async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const user = c.get('user');

  const existing = await db('sla_rules').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'SLA rule not found' }, 404);
  }

  if (body.dest_warehouse_id || body.transport_type) {
    const checkWarehouseId = body.dest_warehouse_id ?? existing.dest_warehouse_id;
    const checkTransportType = body.transport_type ?? existing.transport_type;

    const duplicate = await db('sla_rules')
      .where({ dest_warehouse_id: checkWarehouseId, transport_type: checkTransportType })
      .whereNot({ id })
      .first();
    if (duplicate) {
      return c.json(
        { success: false, error: '该仓库和运输类型的SLA规则已存在' },
        400
      );
    }
  }

  if (body.dest_warehouse_id) {
    const warehouse = await db('warehouses').where({ id: body.dest_warehouse_id }).first();
    if (!warehouse) {
      return c.json({ success: false, error: 'dest_warehouse_id 不存在' }, 400);
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = { ...body, update_time: now };

  const logEntries: any[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    const oldValue = existing[key];
    const newValue = String(value);
    if (String(oldValue) !== newValue) {
      logEntries.push({
        record_type: 'transfer_order',
        record_id: id,
        transfer_no: null,
        field_name: `sla_rule.${key}`,
        old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue,
        change_source: 'MANUAL',
        operator: user?.username || 'unknown',
        change_time: now,
      });
    }
  }

  await db('sla_rules').where({ id }).update(updates);
  if (logEntries.length > 0) {
    await db('change_logs').insert(logEntries);
  }

  const updated = await db('sla_rules')
    .leftJoin('warehouses', 'sla_rules.dest_warehouse_id', 'warehouses.id')
    .select('sla_rules.*', 'warehouses.warehouse_name as dest_warehouse_name')
    .where('sla_rules.id', id)
    .first();

  return c.json({ success: true, data: updated });
});

sla.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');

  const existing = await db('sla_rules').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'SLA rule not found' }, 404);
  }

  const now = new Date().toISOString();
  await db('sla_rules').where({ id }).del();

  await db('change_logs').insert({
    record_type: 'transfer_order',
    record_id: id,
    transfer_no: null,
    field_name: 'sla_rule_deleted',
    old_value: JSON.stringify(existing),
    new_value: null,
    change_source: 'MANUAL',
    operator: user?.username || 'unknown',
    change_time: now,
  });

  return c.json({ success: true, data: { id } });
});

export default sla;
