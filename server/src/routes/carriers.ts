import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const boolish = z.union([z.boolean(), z.number(), z.string()]).optional().transform(v => {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return false;
});

const carriers = new Hono();

const createCarrierSchema = z.object({
  carrier_code: z.string().min(1),
  carrier_name: z.string().min(1),
  carrier_type: z.string().optional(),
  supported_transport_types: z.string().optional(),
  supported_routes: z.string().optional(),
  default_currency: z.string().optional(),
  settlement_cycle: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  is_active: boolish,
  remark: z.string().optional(),
});

const updateCarrierSchema = createCarrierSchema.partial();

carriers.get('/', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const keyword = c.req.query('keyword') || '';
  const carrierType = c.req.query('carrier_type');
  const isActive = c.req.query('is_active');

  let query = db('carriers');

  if (keyword) {
    query = query.where(function () {
      this.where('carrier_code', 'like', `%${keyword}%`)
        .orWhere('carrier_name', 'like', `%${keyword}%`);
    });
  }
  if (carrierType) {
    query = query.where('carrier_type', carrierType);
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

carriers.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const item = await db('carriers').where({ id }).first();
  if (!item) {
    return c.json({ success: false, error: 'Carrier not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

carriers.post('/', zValidator('json', createCarrierSchema), async (c) => {
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const body = c.req.valid('json');
  try {
    const [inserted] = await db('carriers').insert(body).returning('*');
    return c.json({ success: true, data: inserted }, 201);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      return c.json({ success: false, error: '物流商编码已存在' }, 400);
    }
    return c.json({ success: false, error: err?.message || '创建失败' }, 400);
  }
});

carriers.put('/:id', zValidator('json', updateCarrierSchema), async (c) => {
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');

  const existing = await db('carriers').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Carrier not found' }, 404);
  }

  try {
    await db('carriers').where({ id }).update({
      ...body,
      update_time: new Date().toISOString(),
    });

    const updated = await db('carriers').where({ id }).first();
    return c.json({ success: true, data: updated });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      return c.json({ success: false, error: '物流商编码已存在' }, 400);
    }
    return c.json({ success: false, error: err?.message || '更新失败' }, 400);
  }
});

carriers.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const existing = await db('carriers').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Carrier not found' }, 404);
  }

  await db('carriers').where({ id }).update({
    is_active: false,
    update_time: new Date().toISOString(),
  });

  return c.json({ success: true, data: { id } });
});

export default carriers;
