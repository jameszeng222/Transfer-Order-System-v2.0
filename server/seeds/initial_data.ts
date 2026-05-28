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
  if (Number(existingUsers?.c) === 0) {
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
    console.log('[seed] Inserted roles, permissions, admin user');
  }

  const existingWh = await knex('warehouses').count('* as c').first();
  if (Number(existingWh?.c) === 0) {
    await knex('warehouses').insert([
      { warehouse_code: 'WH-SZ-01', warehouse_name: '深圳龙华仓', region: '华南', country: '中国', address: '深圳市龙华区民治街道', postal_code: '518131', warehouse_type: 'DOMESTIC_SELF', warehouse_category: 'SELF', is_active: 1 },
      { warehouse_code: 'WH-GZ-01', warehouse_name: '广州白云仓', region: '华南', country: '中国', address: '广州市白云区太和镇', postal_code: '510540', warehouse_type: 'DOMESTIC_SELF', warehouse_category: 'SELF', is_active: 1 },
      { warehouse_code: 'WH-YW-01', warehouse_name: '义乌仓储中心', region: '华东', country: '中国', address: '义乌市北苑街道', postal_code: '322000', warehouse_type: 'DOMESTIC_3RD', warehouse_category: 'WANYITONG', is_active: 1 },
      { warehouse_code: 'WH-SYD-01', warehouse_name: '悉尼仓', region: '大洋洲', country: '澳大利亚', address: "75 O'Riordan St, Alexandria NSW", postal_code: '2015', warehouse_type: 'OVERSEAS_SELF', warehouse_category: 'SELF', is_active: 1 },
      { warehouse_code: 'WH-MEL-01', warehouse_name: '墨尔本仓', region: '大洋洲', country: '澳大利亚', address: '20 Business Park Dr, Dandenong VIC', postal_code: '3175', warehouse_type: 'OVERSEAS_SELF', warehouse_category: 'SELF', is_active: 1 },
      { warehouse_code: 'WH-BNE-01', warehouse_name: '布里斯班仓', region: '大洋洲', country: '澳大利亚', address: '10 Logistics Ave, Brendale QLD', postal_code: '4500', warehouse_type: 'OVERSEAS_3RD', warehouse_category: 'FBT', is_active: 1 },
    ]);
    console.log('[seed] Inserted 6 warehouses');
  }

  const existingCr = await knex('carriers').count('* as c').first();
  if (Number(existingCr?.c) === 0) {
    await knex('carriers').insert([
      { carrier_code: 'CR-SF', carrier_name: '顺丰国际', carrier_type: 'INTERNATIONAL_EXPRESS', supported_transport_types: 'AIR,TRUCK', default_currency: 'CNY', is_active: 1 },
      { carrier_code: 'CR-YTO', carrier_name: '圆通国际', carrier_type: 'INTERNATIONAL_EXPRESS', supported_transport_types: 'AIR', default_currency: 'CNY', is_active: 1 },
      { carrier_code: 'CR-COSCO', carrier_name: '中远海运', carrier_type: 'INTERNATIONAL_SEA', supported_transport_types: 'SEA', default_currency: 'CNY', is_active: 1 },
      { carrier_code: 'CR-MAERSK', carrier_name: '马士基', carrier_type: 'INTERNATIONAL_SEA', supported_transport_types: 'SEA', default_currency: 'USD', is_active: 1 },
      { carrier_code: 'CR-DHL', carrier_name: 'DHL', carrier_type: 'INTERNATIONAL_EXPRESS', supported_transport_types: 'AIR', default_currency: 'USD', is_active: 1 },
      { carrier_code: 'CR-AUP', carrier_name: 'Australia Post', carrier_type: 'LAST_MILE', supported_transport_types: 'TRUCK', default_currency: 'AUD', is_active: 1 },
    ]);
    console.log('[seed] Inserted 6 carriers');
  }

  const existingTm = await knex('teams').count('* as c').first();
  if (Number(existingTm?.c) === 0) {
    await knex('teams').insert([
      { team_code: 'TM-AU', team_name: '澳洲团队', leader: '张经理', is_active: 1 },
      { team_code: 'TM-EU', team_name: '欧洲团队', leader: '李经理', is_active: 1 },
      { team_code: 'TM-US', team_name: '北美团队', leader: '王经理', is_active: 1 },
    ]);
    console.log('[seed] Inserted 3 teams');
  }
}
