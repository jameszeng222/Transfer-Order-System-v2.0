export type {
  TransferStatus,
  TransferSource,
  TransferType,
  TransportType,
  WarehouseType,
  WarehouseCategory,
  CarrierType,
  FreightAllocationMethod,
  DiscrepancyCategory,
  DiscrepancyType,
  DiscrepancyStatus,
  BillStatus,
  JobStatus,
  ChangeSource,
  UserRole,
} from '../constants/index';

export type { Permission } from '../constants/permissions';

export type {
  Pagination,
  Sort,
} from '../schemas/common';

export type {
  Warehouse,
  CreateWarehouse,
  UpdateWarehouse,
} from '../schemas/warehouse';

export type {
  Carrier,
  CreateCarrier,
  UpdateCarrier,
} from '../schemas/carrier';

export type {
  Team,
  CreateTeam,
  UpdateTeam,
} from '../schemas/team';

export type {
  User,
  CreateUser,
  UpdateUser,
} from '../schemas/user';

export type {
  Login,
  LoginResponse,
} from '../schemas/auth';

import { z } from 'zod';
import { paginationSchema, sortSchema, paginatedResponseSchema, apiResponseSchema } from '../schemas/common';
import { warehouseSchema, createWarehouseSchema, updateWarehouseSchema } from '../schemas/warehouse';
import { carrierSchema, createCarrierSchema, updateCarrierSchema } from '../schemas/carrier';
import { teamSchema, createTeamSchema, updateTeamSchema } from '../schemas/team';
import { userSchema, createUserSchema, updateUserSchema } from '../schemas/user';
import { loginSchema, loginResponseSchema } from '../schemas/auth';

type Pagination = z.infer<typeof paginationSchema>;
type Sort = z.infer<typeof sortSchema>;

type Warehouse = z.infer<typeof warehouseSchema>;
type CreateWarehouse = z.infer<typeof createWarehouseSchema>;
type UpdateWarehouse = z.infer<typeof updateWarehouseSchema>;

type Carrier = z.infer<typeof carrierSchema>;
type CreateCarrier = z.infer<typeof createCarrierSchema>;
type UpdateCarrier = z.infer<typeof updateCarrierSchema>;

type Team = z.infer<typeof teamSchema>;
type CreateTeam = z.infer<typeof createTeamSchema>;
type UpdateTeam = z.infer<typeof updateTeamSchema>;

type User = z.infer<typeof userSchema>;
type CreateUser = z.infer<typeof createUserSchema>;
type UpdateUser = z.infer<typeof updateUserSchema>;

type Login = z.infer<typeof loginSchema>;
type LoginResponse = z.infer<typeof loginResponseSchema>;

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export {
  paginationSchema,
  sortSchema,
  paginatedResponseSchema,
  apiResponseSchema,
  warehouseSchema,
  createWarehouseSchema,
  updateWarehouseSchema,
  carrierSchema,
  createCarrierSchema,
  updateCarrierSchema,
  teamSchema,
  createTeamSchema,
  updateTeamSchema,
  userSchema,
  createUserSchema,
  updateUserSchema,
  loginSchema,
  loginResponseSchema,
};
