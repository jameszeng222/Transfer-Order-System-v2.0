import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface JwtPayload {
  userId: number;
  username: string;
  roleId: number;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized: missing token' }, 401);
  }
  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Unauthorized: invalid token' }, 401);
  }
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export async function requirePermission(c: Context, permissionCode: string): Promise<boolean> {
  const user = c.get('user') as JwtPayload;
  if (!user) return false;
  const perm = await db('role_permissions')
    .where('role_id', user.roleId)
    .where('permission_code', permissionCode)
    .first();
  return !!perm;
}
