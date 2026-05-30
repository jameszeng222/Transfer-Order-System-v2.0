export const Permission = {
    ORDER_VIEW: 'order.view',
    ORDER_IMPORT: 'order.import',
    ORDER_EDIT: 'order.edit',
    ORDER_CONFIRM: 'order.confirm',
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
};
export const ALL_PERMISSIONS = Object.values(Permission);
export const RolePermissions = {
    ADMIN: [...ALL_PERMISSIONS],
    OPERATOR: ALL_PERMISSIONS.filter((p) => p !== Permission.SETTINGS_MANAGE),
    WAREHOUSE: [
        Permission.ORDER_VIEW,
        Permission.ORDER_CONFIRM,
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
//# sourceMappingURL=permissions.js.map