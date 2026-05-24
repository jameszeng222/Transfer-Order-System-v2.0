import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { authMiddleware, generateToken } from '../middleware/auth.js';
import { loginSchema } from '../../../shared/schemas/auth.js';

const auth = new Hono();

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const user = await db('users').where({ username }).first();
  if (!user) {
    return c.json({ success: false, error: 'Invalid username or password' }, 401);
  }

  if (!user.is_active) {
    return c.json({ success: false, error: 'Account is disabled' }, 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return c.json({ success: false, error: 'Invalid username or password' }, 401);
  }

  const role = await db('roles').where({ id: user.role_id }).first();
  const permissions = await db('role_permissions')
    .where({ role_id: user.role_id })
    .pluck('permission_code');

  const token = generateToken({
    userId: user.id,
    username: user.username,
    roleId: user.role_id,
  });

  await db('users').where({ id: user.id }).update({
    last_login_time: new Date().toISOString(),
  });

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        roleId: user.role_id,
        roleCode: role?.role_code,
        roleName: role?.role_name,
        teamId: user.team_id,
        permissions,
      },
    },
  });
});

auth.get('/me', authMiddleware, async (c) => {
  const jwtPayload = c.get('user');

  const user = await db('users').where({ id: jwtPayload.userId }).first();
  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const role = await db('roles').where({ id: user.role_id }).first();
  const permissions = await db('role_permissions')
    .where({ role_id: user.role_id })
    .pluck('permission_code');

  return c.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      email: user.email,
      roleId: user.role_id,
      roleCode: role?.role_code,
      roleName: role?.role_name,
      teamId: user.team_id,
      isActive: user.is_active,
      lastLoginTime: user.last_login_time,
      permissions,
    },
  });
});

export default auth;
