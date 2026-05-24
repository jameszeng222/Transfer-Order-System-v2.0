import { z } from 'zod';

export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  leader: z.string().optional(),
  member_count: z.number().default(0),
  is_active: z.boolean().default(true),
  remark: z.string().optional(),
  create_time: z.string(),
  update_time: z.string(),
});

export const createTeamSchema = teamSchema.omit({
  id: true,
  create_time: true,
  update_time: true,
});

export const updateTeamSchema = createTeamSchema.partial();
