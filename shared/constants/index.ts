export const TransferStatus = {
  PENDING_OUTBOUND: 'PENDING_OUTBOUND',
  OUTBOUNDED: 'OUTBOUNDED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  SHELVED: 'SHELVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const TransferStatusLabel: Record<TransferStatus, string> = {
  PENDING_OUTBOUND: '待出库',
  OUTBOUNDED: '已出库',
  IN_TRANSIT: '在途',
  RECEIVED: '已签收',
  SHELVED: '已上架',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export type BadgeVariant = 'pending' | 'shipped' | 'received' | 'transit' | 'abnormal' | 'shelved' | 'complete';

export const StatusBadgeMap: Record<TransferStatus, BadgeVariant> = {
  PENDING_OUTBOUND: 'pending',
  OUTBOUNDED: 'shipped',
  IN_TRANSIT: 'transit',
  RECEIVED: 'received',
  SHELVED: 'shelved',
  COMPLETED: 'complete',
  CANCELLED: 'abnormal',
};

export const TransferSource = {
  API_WANYITONG: 'API_WANYITONG',
  API_AMAZON: 'API_AMAZON',
  MANUAL: 'MANUAL',
  OTHER: 'OTHER',
} as const;

export type TransferSource = (typeof TransferSource)[keyof typeof TransferSource];

export const TransferType = {
  DOMESTIC_TO_OVERSEAS: 'DOMESTIC_TO_OVERSEAS',
  OVERSEAS_TO_OVERSEAS: 'OVERSEAS_TO_OVERSEAS',
  RETURN_TO_SHELF: 'RETURN_TO_SHELF',
  FBA_OUTBOUND: 'FBA_OUTBOUND',
} as const;

export type TransferType = (typeof TransferType)[keyof typeof TransferType];

export const TransportType = {
  SEA: 'SEA',
  AIR: 'AIR',
  RAIL: 'RAIL',
  TRUCK: 'TRUCK',
  EXPRESS: 'EXPRESS',
  FAST_SEA: 'FAST_SEA',
  SPECIAL: 'SPECIAL',
} as const;

export type TransportType = (typeof TransportType)[keyof typeof TransportType];

export const TransportTypeLabel: Record<TransportType, string> = {
  SEA: '海运',
  AIR: '空运',
  RAIL: '铁路',
  TRUCK: '卡车',
  EXPRESS: '快递',
  FAST_SEA: '快船',
  SPECIAL: '专线',
};

export const WarehouseType = {
  DOMESTIC_SELF: 'DOMESTIC_SELF',
  DOMESTIC_3RD: 'DOMESTIC_3RD',
  OVERSEAS_SELF: 'OVERSEAS_SELF',
  OVERSEAS_3RD: 'OVERSEAS_3RD',
} as const;

export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];

export const WarehouseTypeLabel: Record<WarehouseType, string> = {
  DOMESTIC_SELF: '国内自营',
  DOMESTIC_3RD: '国内三方',
  OVERSEAS_SELF: '海外自营',
  OVERSEAS_3RD: '海外三方',
};

export const WarehouseCategory = {
  SELF: 'SELF',
  WANYITONG: 'WANYITONG',
  AMAZON_FBA: 'AMAZON_FBA',
  FBT: 'FBT',
  OTHER: 'OTHER',
} as const;

export type WarehouseCategory = (typeof WarehouseCategory)[keyof typeof WarehouseCategory];

export const WarehouseCategoryLabel: Record<WarehouseCategory, string> = {
  SELF: '自营',
  WANYITONG: '万邑通',
  AMAZON_FBA: '亚马逊FBA',
  FBT: 'FBT',
  OTHER: '其他',
};

export const CarrierType = {
  INTERNATIONAL_EXPRESS: 'INTERNATIONAL_EXPRESS',
  INTERNATIONAL_SEA: 'INTERNATIONAL_SEA',
  INTERNATIONAL_AIR: 'INTERNATIONAL_AIR',
  RAIL: 'RAIL',
  TRUCK: 'TRUCK',
} as const;

export type CarrierType = (typeof CarrierType)[keyof typeof CarrierType];

export const CarrierTypeLabel: Record<CarrierType, string> = {
  INTERNATIONAL_EXPRESS: '国际快递',
  INTERNATIONAL_SEA: '国际海运',
  INTERNATIONAL_AIR: '国际空运',
  RAIL: '铁路',
  TRUCK: '卡车',
};

export const FreightAllocationMethod = {
  BY_QUANTITY: 'BY_QUANTITY',
  BY_WEIGHT: 'BY_WEIGHT',
  BY_VOLUME: 'BY_VOLUME',
} as const;

export type FreightAllocationMethod = (typeof FreightAllocationMethod)[keyof typeof FreightAllocationMethod];

export const DiscrepancyCategory = {
  QUANTITY_DIFF: 'QUANTITY_DIFF',
  QUALITY_ISSUE: 'QUALITY_ISSUE',
  LOGISTICS_ABNORMAL: 'LOGISTICS_ABNORMAL',
  SHELF_ABNORMAL: 'SHELF_ABNORMAL',
} as const;

export type DiscrepancyCategory = (typeof DiscrepancyCategory)[keyof typeof DiscrepancyCategory];

export const DiscrepancyType = {
  SHORT_SHIPMENT: 'SHORT_SHIPMENT',
  OVER_SHIPMENT: 'OVER_SHIPMENT',
  WRONG_ITEM: 'WRONG_ITEM',
  DAMAGED: 'DAMAGED',
  DETERIORATED: 'DETERIORATED',
  TIMEOUT_PORT: 'TIMEOUT_PORT',
  TIMEOUT_CUSTOMS: 'TIMEOUT_CUSTOMS',
  TIMEOUT_DELIVERY: 'TIMEOUT_DELIVERY',
  LOST: 'LOST',
  PARTIAL_SHELF: 'PARTIAL_SHELF',
  NOT_SHELVED: 'NOT_SHELVED',
  WRONG_SHELF: 'WRONG_SHELF',
} as const;

export type DiscrepancyType = (typeof DiscrepancyType)[keyof typeof DiscrepancyType];

export const DiscrepancyStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  CLOSED: 'CLOSED',
} as const;

export type DiscrepancyStatus = (typeof DiscrepancyStatus)[keyof typeof DiscrepancyStatus];

export const BillStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  RECONCILED: 'RECONCILED',
} as const;

export type BillStatus = (typeof BillStatus)[keyof typeof BillStatus];

export const JobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const ChangeSource = {
  API: 'API',
  IMPORT: 'IMPORT',
  MANUAL: 'MANUAL',
} as const;

export type ChangeSource = (typeof ChangeSource)[keyof typeof ChangeSource];

export const UserRole = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  WAREHOUSE: 'WAREHOUSE',
  READONLY: 'READONLY',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
