import { z } from 'zod';
import { CarrierType } from '../constants/index';

export const carrierSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  type: z.enum(Object.values(CarrierType) as [string, ...string[]]),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  is_active: z.boolean().default(true),
  remark: z.string().optional(),
  create_time: z.string(),
  update_time: z.string(),
});

export const createCarrierSchema = carrierSchema.omit({
  id: true,
  create_time: true,
  update_time: true,
});

export const updateCarrierSchema = createCarrierSchema.partial();
