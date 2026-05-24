import { z } from 'zod';
import { UserRole } from '../constants/index';

export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  display_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(Object.values(UserRole) as [string, ...string[]]),
  team_id: z.number().optional(),
  is_active: z.boolean().default(true),
  create_time: z.string(),
  update_time: z.string(),
});

export const createUserSchema = userSchema
  .omit({
    id: true,
    create_time: true,
    update_time: true,
  })
  .extend({
    password: z.string().min(6),
  });

export const updateUserSchema = userSchema
  .omit({
    id: true,
    create_time: true,
    update_time: true,
  })
  .partial()
  .extend({
    password: z.string().min(6).optional(),
  });
