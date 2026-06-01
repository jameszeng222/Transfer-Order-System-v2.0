import { UserRole } from './index';

export const Permission = {
  ORDER_VIEW: 'order.view',
  ORDER_IMPORT: 'order.import',
  ORDER_EDIT: 'order.edit',
  ORDER_CONFIRM: 'order.confirm',
  ORDER_DELETE: 'order.delete',
  TRACKING_VIEW: 'tracking.view',
  TRACKING_EXPORT: 'tracking.export',
  FREIGHT_VIEW: 'freight.view',
  FREIGHT_CONFIRM: 'freight.confirm',
  FREIGHT_RECONCILE: 'freight.reconcile',
  DISCREPANCY_VIEW: 'discrepancy.view',
  DISCREPANCY_HANDLE: 'discrepancy.handle',
  REPORTS_VIEW: 'reports.view',
  SETTINGS_MANAGE: 'settings.manage',
  IMPORT_EXECUTE: 'import.execute',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

export const RolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  OPERATOR: ALL_PERMISSIONS.filter((p) => p !== Permission.SETTINGS_MANAGE),
  WAREHOUSE: [
    Permission.ORDER_VIEW,
    Permission.ORDER_CONFIRM,
    Permission.ORDER_DELETE,
    Permission.TRACKING_VIEW,
    Permission.DISCREPANCY_VIEW,
    Permission.DISCREPANCY_HANDLE,
    Permission.IMPORT_EXECUTE,
  ],
  READONLY: [
    Permission.ORDER_VIEW,
    Permission.TRACKING_VIEW,
    Permission.FREIGHT_VIEW,
    Permission.DISCREPANCY_VIEW,
    Permission.REPORTS_VIEW,
  ],
};
