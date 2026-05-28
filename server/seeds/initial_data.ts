import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

const ALL_PERMISSIONS = [
  'order.view',
  'order.import',
  'order.edit',
  'order.confirm',
  'tracking.view',
  'tracking.export',
  'freight.view',
  'freight.confirm',
  'freight.reconcile',
  'discrepancy.view',
  'discrepancy.handle',
  'reports.view',
  'settings.manage',
  'import.execute',
];

const OPERATOR_PERMISSIONS = [
  'order.view',
  'order.import',
  'order.edit',
  'order.confirm',
  'tracking.view',
  'tracking.export',
  'freight.view',
  'discrepancy.view',
  'discrepancy.handle',
  'reports.view',
  'import.execute',
];

const WAREHOUSE_PERMISSIONS = [
  'order.view',
  'order.confirm',
  'tracking.view',
  'discrepancy.view',
  'discrepancy.handle',
  'import.execute',
];

const READONLY_PERMISSIONS = [
  'order.view',
  'tracking.view',
  'freight.view',
  'discrepancy.view',
  'reports.view',
];

export async function seed(knex: Knex): Promise<void> {
  const existingUsers = await knex('users').count('* as c').first();
  if (Number(existingUsers?.c) > 0) {
    console.log('[seed] Users already exist, skipping seed');
    return;
  }

  const [adminRoleId, operatorRoleId, warehouseRoleId, readonlyRoleId] = await knex('roles').insert([
    { role_code: 'ADMIN', role_name: '管理员', description: '系统管理员，拥有全部权限' },
    { role_code: 'OPERATOR', role_name: '运营', description: '创建/编辑调拨单，查看在途和报表，导入数据' },
    { role_code: 'WAREHOUSE', role_name: '仓库', description: '确认发货/到货/上架，处理异常' },
    { role_code: 'READONLY', role_name: '只读', description: '查看所有数据，不能编辑/导入' },
  ]).returning('id').then((rows) => rows.map((r) => r.id));

  const rolePermissionData: { role_id: number; permission_code: string }[] = [];

  for (const perm of ALL_PERMISSIONS) {
    rolePermissionData.push({ role_id: adminRoleId, permission_code: perm });
  }
  for (const perm of OPERATOR_PERMISSIONS) {
    rolePermissionData.push({ role_id: operatorRoleId, permission_code: perm });
  }
  for (const perm of WAREHOUSE_PERMISSIONS) {
    rolePermissionData.push({ role_id: warehouseRoleId, permission_code: perm });
  }
  for (const perm of READONLY_PERMISSIONS) {
    rolePermissionData.push({ role_id: readonlyRoleId, permission_code: perm });
  }

  await knex('role_permissions').insert(rolePermissionData);

  const passwordHash = await bcrypt.hash('admin123', 10);
  await knex('users').insert({
    username: 'admin',
    password_hash: passwordHash,
    name: '管理员',
    phone: '',
    email: '',
    team_id: null,
    role_id: adminRoleId,
  });
}
