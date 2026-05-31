export declare const TransferStatus: {
    readonly PENDING_OUTBOUND: "PENDING_OUTBOUND";
    readonly OUTBOUNDED: "OUTBOUNDED";
    readonly IN_TRANSIT: "IN_TRANSIT";
    readonly RECEIVED: "RECEIVED";
    readonly PARTIAL_SHELVED: "PARTIAL_SHELVED";
    readonly SHELVED: "SHELVED";
    readonly COMPLETED: "COMPLETED";
    readonly CANCELLED: "CANCELLED";
};
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];
export declare const TransferStatusLabel: Record<TransferStatus, string>;
export type BadgeVariant = 'pending' | 'shipped' | 'received' | 'transit' | 'abnormal' | 'shelved' | 'partial_shelved' | 'complete';
export declare const StatusBadgeMap: Record<TransferStatus, BadgeVariant>;
export declare const TransferType: {
    readonly DOMESTIC_TO_OVERSEAS: "DOMESTIC_TO_OVERSEAS";
    readonly OVERSEAS_TO_OVERSEAS: "OVERSEAS_TO_OVERSEAS";
    readonly RETURN_TO_SHELF: "RETURN_TO_SHELF";
    readonly FBA_OUTBOUND: "FBA_OUTBOUND";
};
export type TransferType = (typeof TransferType)[keyof typeof TransferType];
export declare const TransportType: {
    readonly SEA: "SEA";
    readonly AIR: "AIR";
    readonly RAIL: "RAIL";
    readonly TRUCK: "TRUCK";
    readonly EXPRESS: "EXPRESS";
    readonly FAST_SEA: "FAST_SEA";
    readonly SPECIAL: "SPECIAL";
};
export type TransportType = (typeof TransportType)[keyof typeof TransportType];
export declare const TransportTypeLabel: Record<TransportType, string>;
export declare const WarehouseType: {
    readonly DOMESTIC_SELF: "DOMESTIC_SELF";
    readonly DOMESTIC_3RD: "DOMESTIC_3RD";
    readonly OVERSEAS_SELF: "OVERSEAS_SELF";
    readonly OVERSEAS_3RD: "OVERSEAS_3RD";
};
export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];
export declare const WarehouseTypeLabel: Record<WarehouseType, string>;
export declare const WarehouseCategory: {
    readonly SELF: "SELF";
    readonly WANYITONG: "WANYITONG";
    readonly AMAZON_FBA: "AMAZON_FBA";
    readonly FBT: "FBT";
    readonly OTHER: "OTHER";
};
export type WarehouseCategory = (typeof WarehouseCategory)[keyof typeof WarehouseCategory];
export declare const WarehouseCategoryLabel: Record<WarehouseCategory, string>;
export declare const CarrierType: {
    readonly INTERNATIONAL_EXPRESS: "INTERNATIONAL_EXPRESS";
    readonly INTERNATIONAL_SEA: "INTERNATIONAL_SEA";
    readonly INTERNATIONAL_AIR: "INTERNATIONAL_AIR";
    readonly RAIL: "RAIL";
    readonly TRUCK: "TRUCK";
};
export type CarrierType = (typeof CarrierType)[keyof typeof CarrierType];
export declare const CarrierTypeLabel: Record<CarrierType, string>;
export declare const FreightAllocationMethod: {
    readonly BY_QUANTITY: "BY_QUANTITY";
    readonly BY_WEIGHT: "BY_WEIGHT";
    readonly BY_VOLUME: "BY_VOLUME";
};
export type FreightAllocationMethod = (typeof FreightAllocationMethod)[keyof typeof FreightAllocationMethod];
export declare const DiscrepancyCategory: {
    readonly QUANTITY_DIFF: "QUANTITY_DIFF";
    readonly QUALITY_ISSUE: "QUALITY_ISSUE";
    readonly LOGISTICS_ABNORMAL: "LOGISTICS_ABNORMAL";
    readonly SHELF_ABNORMAL: "SHELF_ABNORMAL";
};
export type DiscrepancyCategory = (typeof DiscrepancyCategory)[keyof typeof DiscrepancyCategory];
export declare const DiscrepancyType: {
    readonly SHORT_SHIPMENT: "SHORT_SHIPMENT";
    readonly OVER_SHIPMENT: "OVER_SHIPMENT";
    readonly WRONG_ITEM: "WRONG_ITEM";
    readonly DAMAGED: "DAMAGED";
    readonly DETERIORATED: "DETERIORATED";
    readonly TIMEOUT_PORT: "TIMEOUT_PORT";
    readonly TIMEOUT_CUSTOMS: "TIMEOUT_CUSTOMS";
    readonly TIMEOUT_DELIVERY: "TIMEOUT_DELIVERY";
    readonly LOST: "LOST";
    readonly PARTIAL_SHELF: "PARTIAL_SHELF";
    readonly NOT_SHELVED: "NOT_SHELVED";
    readonly WRONG_SHELF: "WRONG_SHELF";
};
export type DiscrepancyType = (typeof DiscrepancyType)[keyof typeof DiscrepancyType];
export declare const DiscrepancyStatus: {
    readonly PENDING: "PENDING";
    readonly PROCESSING: "PROCESSING";
    readonly CLOSED: "CLOSED";
};
export type DiscrepancyStatus = (typeof DiscrepancyStatus)[keyof typeof DiscrepancyStatus];
export declare const BillStatus: {
    readonly PENDING: "PENDING";
    readonly CONFIRMED: "CONFIRMED";
    readonly RECONCILED: "RECONCILED";
};
export type BillStatus = (typeof BillStatus)[keyof typeof BillStatus];
export declare const JobStatus: {
    readonly PENDING: "PENDING";
    readonly RUNNING: "RUNNING";
    readonly SUCCESS: "SUCCESS";
    readonly FAILED: "FAILED";
};
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
export declare const ChangeSource: {
    readonly API: "API";
    readonly IMPORT: "IMPORT";
    readonly MANUAL: "MANUAL";
};
export type ChangeSource = (typeof ChangeSource)[keyof typeof ChangeSource];
export declare const UserRole: {
    readonly ADMIN: "ADMIN";
    readonly OPERATOR: "OPERATOR";
    readonly WAREHOUSE: "WAREHOUSE";
    readonly READONLY: "READONLY";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
