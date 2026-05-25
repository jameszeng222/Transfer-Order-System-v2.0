import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const users = new Hono();

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  team_id: z.number().optional().nullable(),
  role_id: z.number(),
  is_active: z.boolean().optional(),
});

const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  team_id: z.number().optional().nullable(),
  role_id: z.number().optional(),
  is_active: z.boolean().optional(),
});

users.get('/', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const keyword = c.req.query('keyword') || '';
  const isActive = c.req.query('is_active');

  let query = db('users');

  if (keyword) {
    query = query.where(function () {
      this.where('username', 'like', `%${keyword}%`)
        .orWhere('name', 'like', `%${keyword}%`);
    });
  }
  if (isActive !== undefined && isActive !== '') {
    query = query.where('is_active', isActive === 'true' ? 1 : 0);
  }

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const data = await query
    .clone()
    .select(['id', 'username', 'name', 'phone', 'email', 'team_id', 'role_id', 'is_active', 'last_login_time', 'create_time', 'update_time'])
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .orderBy('id', 'desc');

  return c.json({
    success: true,
    data,
    pagination: { total, page, pageSize },
  });
});

users.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const item = await db('users')
    .select(['id', 'username', 'name', 'phone', 'email', 'team_id', 'role_id', 'is_active', 'last_login_time', 'create_time', 'update_time'])
    .where({ id })
    .first();
  if (!item) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

users.post('/', zValidator('json', createUserSchema), async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const body = c.req.valid('json');
  const { password, ...rest } = body;
  const password_hash = await bcrypt.hash(password, 10);

  const [inserted] = await db('users')
    .insert({ ...rest, password_hash })
    .returning(['id', 'username', 'name', 'phone', 'email', 'team_id', 'role_id', 'is_active', 'create_time', 'update_time']);

  return c.json({ success: true, data: inserted }, 201);
});

users.put('/:id', zValidator('json', updateUserSchema), async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');

  const existing = await db('users').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const { password, ...rest } = body;
  const updateData: Record<string, any> = { ...rest, update_time: new Date().toISOString() };

  if (password) {
    updateData.password_hash = await bcrypt.hash(password, 10);
  }

  await db('users').where({ id }).update(updateData);

  const updated = await db('users')
    .select(['id', 'username', 'name', 'phone', 'email', 'team_id', 'role_id', 'is_active', 'last_login_time', 'create_time', 'update_time'])
    .where({ id })
    .first();

  return c.json({ success: true, data: updated });
});

users.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }
  const id = Number(c.req.param('id'));
  const existing = await db('users').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  await db('users').where({ id }).update({
    is_active: false,
    update_time: new Date().toISOString(),
  });

  return c.json({ success: true, data: { id } });
});

export default users;
