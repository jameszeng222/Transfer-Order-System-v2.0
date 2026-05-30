import { z } from 'zod';
import { userSchema } from './user';
import { Permission } from '../constants/permissions';
export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});
export const loginResponseSchema = z.object({
    token: z.string(),
    user: userSchema.extend({
        permissions: z.array(z.enum(Object.values(Permission))),
    }),
});
//# sourceMappingURL=auth.js.map