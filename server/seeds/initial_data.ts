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

  const [teamAId, teamBId, teamCId, teamDId] = await knex('teams').insert([
    { team_code: 'TEAM_HN1', team_name: '华南一组', leader: '张三' },
    { team_code: 'TEAM_HN2', team_name: '华南二组', leader: '李四' },
    { team_code: 'TEAM_HD1', team_name: '华东一组', leader: '王五' },
    { team_code: 'TEAM_HD2', team_name: '华东二组', leader: '赵六' },
  ]).returning('id').then((rows) => rows.map((r) => r.id));

  void teamAId;
  void teamBId;
  void teamCId;
  void teamDId;

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

  await knex('warehouses').insert([
    { warehouse_code: 'WH-SZ-01', warehouse_name: '深圳仓', region: '国内', country: '中国', timezone: 'Asia/Shanghai', warehouse_type: 'DOMESTIC', warehouse_category: 'SELF' },
    { warehouse_code: 'WH-GZ-01', warehouse_name: '广州仓', region: '国内', country: '中国', timezone: 'Asia/Shanghai', warehouse_type: 'DOMESTIC', warehouse_category: 'SELF' },
    { warehouse_code: 'WH-SH-01', warehouse_name: '上海仓', region: '国内', country: '中国', timezone: 'Asia/Shanghai', warehouse_type: 'DOMESTIC', warehouse_category: 'SELF' },
    { warehouse_code: 'WH-YW-01', warehouse_name: '义乌仓', region: '国内', country: '中国', timezone: 'Asia/Shanghai', warehouse_type: 'DOMESTIC', warehouse_category: 'SELF' },
    { warehouse_code: 'WH-US-LA', warehouse_name: '洛杉矶仓', region: '北美', country: '美国', timezone: 'America/Los_Angeles', warehouse_type: 'OVERSEAS', warehouse_category: 'WANYITONG', api_enabled: true, api_provider: 'WANYITONG' },
    { warehouse_code: 'WH-US-NJ', warehouse_name: '新泽西仓', region: '北美', country: '美国', timezone: 'America/New_York', warehouse_type: 'OVERSEAS', warehouse_category: 'WANYITONG', api_enabled: true, api_provider: 'WANYITONG' },
    { warehouse_code: 'WH-UK-LON', warehouse_name: '伦敦仓', region: '欧洲', country: '英国', timezone: 'Europe/London', warehouse_type: 'OVERSEAS', warehouse_category: 'WANYITONG' },
    { warehouse_code: 'WH-DE-HAM', warehouse_name: '汉堡仓', region: '欧洲', country: '德国', timezone: 'Europe/Berlin', warehouse_type: 'OVERSEAS', warehouse_category: 'SICHUANG' },
    { warehouse_code: 'WH-DE-FRA', warehouse_name: '法兰克福仓', region: '欧洲', country: '德国', timezone: 'Europe/Berlin', warehouse_type: 'OVERSEAS', warehouse_category: 'SICHUANG' },
    { warehouse_code: 'WH-JP-TKY', warehouse_name: '东京仓', region: '亚太', country: '日本', timezone: 'Asia/Tokyo', warehouse_type: 'OVERSEAS', warehouse_category: 'ONNAT' },
    { warehouse_code: 'WH-AU-SYD', warehouse_name: '悉尼仓', region: '亚太', country: '澳大利亚', timezone: 'Australia/Sydney', warehouse_type: 'OVERSEAS', warehouse_category: 'WANYITONG' },
    { warehouse_code: 'WH-FBA-US', warehouse_name: 'FBA美国', region: '北美', country: '美国', timezone: 'America/Los_Angeles', warehouse_type: 'FBA', warehouse_category: 'AMAZON_FBA' },
  ]);

  const warehouseRows = await knex('warehouses').select('id', 'warehouse_code');
  const whIdMap: Record<string, number> = {};
  for (const row of warehouseRows) {
    whIdMap[row.warehouse_code] = row.id;
  }

  await knex('carriers').insert([
    { carrier_code: 'CARRIER-001', carrier_name: '万邑通', carrier_type: 'INTERNATIONAL_SEA' },
    { carrier_code: 'CARRIER-002', carrier_name: '递四方', carrier_type: 'INTERNATIONAL_EXPRESS' },
    { carrier_code: 'CARRIER-003', carrier_name: '纵腾', carrier_type: 'INTERNATIONAL_SEA' },
    { carrier_code: 'CARRIER-004', carrier_name: '中外运', carrier_type: 'INTERNATIONAL_SEA' },
    { carrier_code: 'CARRIER-005', carrier_name: '顺丰国际', carrier_type: 'INTERNATIONAL_AIR' },
    { carrier_code: 'CARRIER-006', carrier_name: '中欧铁路', carrier_type: 'RAIL' },
  ]);

  await knex('sla_rules').insert([
    { dest_warehouse_id: whIdMap['WH-US-LA'], transport_type: 'SEA', sla_days: 35, shelf_sla_days: 3 },
    { dest_warehouse_id: whIdMap['WH-US-LA'], transport_type: 'AIR', sla_days: 7, shelf_sla_days: 3 },
    { dest_warehouse_id: whIdMap['WH-US-NJ'], transport_type: 'SEA', sla_days: 40, shelf_sla_days: 3 },
    { dest_warehouse_id: whIdMap['WH-US-NJ'], transport_type: 'AIR', sla_days: 8, shelf_sla_days: 3 },
    { dest_warehouse_id: whIdMap['WH-UK-LON'], transport_type: 'SEA', sla_days: 30, shelf_sla_days: 3 },
    { dest_warehouse_id: whIdMap['WH-DE-HAM'], transport_type: 'RAIL', sla_days: 20, shelf_sla_days: 3 },
    { dest_warehouse_id: whIdMap['WH-JP-TKY'], transport_type: 'SEA', sla_days: 10, shelf_sla_days: 3 },
  ]);

}
