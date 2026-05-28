import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const boolish = z.union([z.boolean(), z.number(), z.string()]).optional().transform(v => {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return false;
});

const warehouses = new Hono();

const createWarehouseSchema = z.object({
  warehouse_code: z.string().min(1),
  warehouse_name: z.string().min(1),
  region: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  warehouse_type: z.enum(['DOMESTIC', 'OVERSEAS', 'FBA', 'THIRD_PARTY']),
  warehouse_category: z.enum(['SELF', 'WANYITONG', 'AMAZON_FBA', 'SICHUANG', 'ONNAT', 'OTHER']).optional(),
  api_enabled: boolish,
  api_provider: z.enum(['WANYITONG', 'AMAZON', 'NONE']).optional(),
  api_config: z.any().optional(),
  api_sync_frequency: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  is_active: boolish,
  remark: z.string().optional(),
});

const updateWarehouseSchema = createWarehouseSchema.partial();

warehouses.get('/', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const keyword = c.req.query('keyword') || '';
  const warehouseType = c.req.query('warehouse_type');
  const isActive = c.req.query('is_active');

  let query = db('warehouses');

  if (keyword) {
    query = query.where(function () {
      this.where('warehouse_code', 'like', `%${keyword}%`)
        .orWhere('warehouse_name', 'like', `%${keyword}%`);
    });
  }
  if (warehouseType) {
    query = query.where('warehouse_type', warehouseType);
  }
  if (isActive !== undefined && isActive !== '') {
    query = query.where('is_active', isActive === 'true' ? 1 : 0);
  }

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const data = await query
    .clone()
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .orderBy('id', 'desc');

  return c.json({
    success: true,
    data,
    pagination: { total, page, pageSize },
  });
});

warehouses.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const item = await db('warehouses').where({ id }).first();
  if (!item) {
    return c.json({ success: false, error: 'Warehouse not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

warehouses.post('/', zValidator('json', createWarehouseSchema), async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const body = c.req.valid('json');
  const [inserted] = await db('warehouses').insert(body).returning('*');
  return c.json({ success: true, data: inserted }, 201);
});

warehouses.put('/:id', zValidator('json', updateWarehouseSchema), async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');

  const existing = await db('warehouses').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Warehouse not found' }, 404);
  }

  await db('warehouses').where({ id }).update({
    ...body,
    update_time: new Date().toISOString(),
  });

  const updated = await db('warehouses').where({ id }).first();
  return c.json({ success: true, data: updated });
});

warehouses.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const existing = await db('warehouses').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Warehouse not found' }, 404);
  }

  await db('warehouses').where({ id }).update({
    is_active: false,
    update_time: new Date().toISOString(),
  });

  return c.json({ success: true, data: { id } });
});

export default warehouses;
