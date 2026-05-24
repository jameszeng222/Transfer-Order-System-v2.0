import { z } from 'zod';
import { WarehouseType, WarehouseCategory } from '../constants/index';

export const warehouseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  type: z.enum(Object.values(WarehouseType) as [string, ...string[]]),
  category: z.enum(Object.values(WarehouseCategory) as [string, ...string[]]),
  country: z.string(),
  province: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  is_active: z.boolean().default(true),
  remark: z.string().optional(),
  create_time: z.string(),
  update_time: z.string(),
  last_sync_time: z.string().optional(),
});

export const createWarehouseSchema = warehouseSchema.omit({
  id: true,
  create_time: true,
  update_time: true,
  last_sync_time: true,
});

export const updateWarehouseSchema = createWarehouseSchema.partial();
