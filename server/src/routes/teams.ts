import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const boolish = z.union([z.boolean(), z.number(), z.string()]).optional().transform(v => {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return false;
});

const teams = new Hono();

const createTeamSchema = z.object({
  team_code: z.string().min(1),
  team_name: z.string().min(1),
  leader: z.string().optional(),
  is_active: boolish,
  remark: z.string().optional(),
});

const updateTeamSchema = createTeamSchema.partial();

teams.get('/', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const keyword = c.req.query('keyword') || '';
  const isActive = c.req.query('is_active');

  let query = db('teams');

  if (keyword) {
    query = query.where(function () {
      this.where('team_code', 'like', `%${keyword}%`)
        .orWhere('team_name', 'like', `%${keyword}%`);
    });
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

teams.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const item = await db('teams').where({ id }).first();
  if (!item) {
    return c.json({ success: false, error: 'Team not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

teams.post('/', zValidator('json', createTeamSchema), async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const body = c.req.valid('json');
  const [inserted] = await db('teams').insert(body).returning('*');
  return c.json({ success: true, data: inserted }, 201);
});

teams.put('/:id', zValidator('json', updateTeamSchema), async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');

  const existing = await db('teams').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Team not found' }, 404);
  }

  await db('teams').where({ id }).update({
    ...body,
    update_time: new Date().toISOString(),
  });

  const updated = await db('teams').where({ id }).first();
  return c.json({ success: true, data: updated });
});

teams.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const existing = await db('teams').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Team not found' }, 404);
  }

  await db('teams').where({ id }).update({
    is_active: false,
    update_time: new Date().toISOString(),
  });

  return c.json({ success: true, data: { id } });
});

export default teams;
