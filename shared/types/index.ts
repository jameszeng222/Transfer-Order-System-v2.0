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
