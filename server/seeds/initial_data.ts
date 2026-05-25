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
  await knex('job_queue').del();
  await knex('api_integrations').del();
  await knex('change_logs').del();
  await knex('freight_bills').del();
  await knex('discrepancy_records').del();
  await knex('transfer_carton_items').del();
  await knex('transfer_cartons').del();
  await knex('tracking_events').del();
  await knex('transfer_order_items').del();
  await knex('transfer_orders').del();
  await knex('sla_rules').del();
  await knex('users').del();
  await knex('role_permissions').del();
  await knex('roles').del();
  await knex('teams').del();
  await knex('carriers').del();
  await knex('warehouses').del();

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

  const [teamAId, teamBId, teamCId] = await knex('teams').insert([
    { team_code: 'TEAM_A', team_name: 'A组', leader: '张三' },
    { team_code: 'TEAM_B', team_name: 'B组', leader: '李四' },
    { team_code: 'TEAM_C', team_name: 'C组', leader: '王五' },
  ]).returning('id').then((rows) => rows.map((r) => r.id));

  void teamAId;
  void teamBId;
  void teamCId;

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
    { warehouse_code: 'WH-YW-01', warehouse_name: '义乌仓', region: '国内', country: '中国', timezone: 'Asia/Shanghai', warehouse_type: 'DOMESTIC', warehouse_category: 'SELF' },
    { warehouse_code: 'WH-US-LA', warehouse_name: '洛杉矶仓', region: '北美', country: '美国', timezone: 'America/Los_Angeles', warehouse_type: 'OVERSEAS', warehouse_category: 'WANYITONG', api_enabled: true, api_provider: 'WANYITONG' },
    { warehouse_code: 'WH-US-NJ', warehouse_name: '新泽西仓', region: '北美', country: '美国', timezone: 'America/New_York', warehouse_type: 'OVERSEAS', warehouse_category: 'WANYITONG', api_enabled: true, api_provider: 'WANYITONG' },
    { warehouse_code: 'WH-UK-LON', warehouse_name: '伦敦仓', region: '欧洲', country: '英国', timezone: 'Europe/London', warehouse_type: 'OVERSEAS', warehouse_category: 'WANYITONG' },
    { warehouse_code: 'WH-DE-HAM', warehouse_name: '汉堡仓', region: '欧洲', country: '德国', timezone: 'Europe/Berlin', warehouse_type: 'OVERSEAS', warehouse_category: 'SICHUANG' },
    { warehouse_code: 'WH-JP-TKY', warehouse_name: '东京仓', region: '亚太', country: '日本', timezone: 'Asia/Tokyo', warehouse_type: 'OVERSEAS', warehouse_category: 'ONNAT' },
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

  // ========== 测试数据 ==========

  await knex('transfer_orders').insert([
    {
      transfer_no: 'DB-20260501-001', erp_order_no: 'ERP-20260501-001', inbound_order_no: 'INB-20260501-001',
      from_warehouse: 'WH-SZ-01', to_warehouse: 'WH-US-LA', team: 'TEAM_A', source: 'MANUAL',
      transfer_type: 'DOMESTIC_TO_OVERSEAS', status: 'COMPLETED', total_sku_count: 3, total_qty: 580, total_carton_count: 5,
      logistics_status: 'DELIVERED', expected_arrival_date: '2026-05-20', actual_arrival_date: '2026-05-18',
      expected_shelf_date: '2026-05-21', logistics_carrier: '万邑通', logistics_tracking_no: 'WYT20260501001',
      is_customs_declared: true, customs_factory: '深圳报关行', is_inspected: false,
      transport_type: 'SEA', last_mile_type: 'TRUCK', last_mile_channel: 'UPS',
      pickup_time: '2026-05-02T09:00:00Z', depart_time: '2026-05-03T14:00:00Z',
      arrive_port_time: '2026-05-15T08:00:00Z', clearance_time: '2026-05-16T10:00:00Z',
      last_mile_pickup_time: '2026-05-17T09:00:00Z', delivery_time: '2026-05-18T11:00:00Z',
      unload_time: '2026-05-18T14:00:00Z', shelve_time: '2026-05-19T16:00:00Z',
      estimated_freight: 12500.00, total_freight_amount: 13200.50, freight_currency: 'CNY',
      freight_allocation_method: 'BY_QUANTITY', is_reconciled: true, is_paid: true,
      remark: '5月第一批美国海运',
    },
    {
      transfer_no: 'DB-20260505-002', erp_order_no: 'ERP-20260505-002', inbound_order_no: 'INB-20260505-002',
      from_warehouse: 'WH-GZ-01', to_warehouse: 'WH-US-NJ', team: 'TEAM_A', source: 'API_WANYITONG',
      transfer_type: 'DOMESTIC_TO_OVERSEAS', status: 'IN_TRANSIT', total_sku_count: 2, total_qty: 300, total_carton_count: 3,
      logistics_status: 'IN_TRANSIT', expected_arrival_date: '2026-06-10', actual_arrival_date: null,
      expected_shelf_date: '2026-06-13', logistics_carrier: '递四方', logistics_tracking_no: 'DSF20260505002',
      is_customs_declared: true, customs_factory: '广州报关行', is_inspected: false,
      transport_type: 'SEA', last_mile_type: 'TRUCK', last_mile_channel: 'FedEx',
      pickup_time: '2026-05-06T10:00:00Z', depart_time: '2026-05-07T16:00:00Z',
      arrive_port_time: null, clearance_time: null, last_mile_pickup_time: null,
      delivery_time: null, unload_time: null, shelve_time: null,
      is_logistics_abnormal: false, estimated_freight: 9800.00, total_freight_amount: null,
      freight_currency: 'CNY', freight_allocation_method: 'BY_QUANTITY', is_reconciled: false, is_paid: false,
      remark: '5月新泽西海运，预计6月到港',
    },
    {
      transfer_no: 'DB-20260508-003', erp_order_no: null, inbound_order_no: 'INB-20260508-003',
      from_warehouse: 'WH-YW-01', to_warehouse: 'WH-UK-LON', team: 'TEAM_B', source: 'MANUAL',
      transfer_type: 'DOMESTIC_TO_OVERSEAS', status: 'OUTBOUNDED', total_sku_count: 2, total_qty: 200, total_carton_count: 2,
      logistics_status: 'PENDING_PICKUP', expected_arrival_date: '2026-06-05', actual_arrival_date: null,
      expected_shelf_date: '2026-06-08', logistics_carrier: '纵腾', logistics_tracking_no: null,
      is_customs_declared: false, customs_factory: null, is_inspected: false,
      transport_type: 'AIR', last_mile_type: 'TRUCK', last_mile_channel: 'DHL',
      pickup_time: null, depart_time: null, arrive_port_time: null, clearance_time: null,
      last_mile_pickup_time: null, delivery_time: null, unload_time: null, shelve_time: null,
      estimated_freight: 15600.00, total_freight_amount: null,
      freight_currency: 'CNY', freight_allocation_method: 'BY_WEIGHT', is_reconciled: false, is_paid: false,
      remark: '英国空运，等物流商提货',
    },
    {
      transfer_no: 'DB-20260510-004', erp_order_no: 'ERP-20260510-004', inbound_order_no: 'INB-20260510-004',
      from_warehouse: 'WH-SZ-01', to_warehouse: 'WH-DE-HAM', team: 'TEAM_C', source: 'MANUAL',
      transfer_type: 'DOMESTIC_TO_OVERSEAS', status: 'PENDING_OUTBOUND', total_sku_count: 4, total_qty: 400, total_carton_count: 4,
      logistics_status: null, expected_arrival_date: '2026-06-30', actual_arrival_date: null,
      expected_shelf_date: '2026-07-03', logistics_carrier: '中欧铁路', logistics_tracking_no: null,
      is_customs_declared: false, customs_factory: null, is_inspected: false,
      transport_type: 'RAIL', last_mile_type: 'TRUCK', last_mile_channel: 'DPD',
      pickup_time: null, depart_time: null, arrive_port_time: null, clearance_time: null,
      last_mile_pickup_time: null, delivery_time: null, unload_time: null, shelve_time: null,
      estimated_freight: 8200.00, total_freight_amount: null,
      freight_currency: 'CNY', freight_allocation_method: 'BY_QUANTITY', is_reconciled: false, is_paid: false,
      remark: '德国铁路，待出库',
    },
    {
      transfer_no: 'DB-20260512-005', erp_order_no: null, inbound_order_no: 'INB-20260512-005',
      from_warehouse: 'WH-GZ-01', to_warehouse: 'WH-JP-TKY', team: 'TEAM_B', source: 'MANUAL',
      transfer_type: 'DOMESTIC_TO_OVERSEAS', status: 'RECEIVED', total_sku_count: 1, total_qty: 150, total_carton_count: 2,
      logistics_status: 'DELIVERED', expected_arrival_date: '2026-05-22', actual_arrival_date: '2026-05-21',
      expected_shelf_date: '2026-05-24', logistics_carrier: '顺丰国际', logistics_tracking_no: 'SF20260512005',
      is_customs_declared: true, customs_factory: '广州报关行', is_inspected: true,
      transport_type: 'SEA', last_mile_type: 'TRUCK', last_mile_channel: '佐川急便',
      pickup_time: '2026-05-13T08:00:00Z', depart_time: '2026-05-14T12:00:00Z',
      arrive_port_time: '2026-05-19T06:00:00Z', clearance_time: '2026-05-20T09:00:00Z',
      last_mile_pickup_time: '2026-05-20T14:00:00Z', delivery_time: '2026-05-21T10:00:00Z',
      unload_time: '2026-05-21T15:00:00Z', shelve_time: null,
      is_shelf_abnormal: true, shelf_abnormal_type: 'QTY_MISMATCH', shelf_abnormal_remark: '上架数量比签收少20个',
      estimated_freight: 4500.00, total_freight_amount: 4800.00, freight_currency: 'CNY',
      freight_allocation_method: 'BY_QUANTITY', is_reconciled: false, is_paid: false,
      remark: '日本海运，已签收待上架，有上架异常',
    },
  ]);

  await knex('transfer_order_items').insert([
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-001', sku_name: '蓝牙耳机 Pro', expected_qty: 200, outbound_qty: 200, inbound_qty: 200, shelf_qty: 200, unit_weight: 0.15, unit_volume: 0.001, freight_cost_total: 4550.00, freight_cost_per_unit: 22.75 },
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-002', sku_name: '手机壳 透明', expected_qty: 300, outbound_qty: 300, inbound_qty: 300, shelf_qty: 300, unit_weight: 0.05, unit_volume: 0.0003, freight_cost_total: 3410.50, freight_cost_per_unit: 11.37 },
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-003', sku_name: '充电线 Type-C 1m', expected_qty: 80, outbound_qty: 80, inbound_qty: 80, shelf_qty: 80, unit_weight: 0.08, unit_volume: 0.0005, freight_cost_total: 5240.00, freight_cost_per_unit: 65.50 },
    { transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', sku_code: 'SKU-004', sku_name: '智能手表 S9', expected_qty: 100, outbound_qty: 100, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.25, unit_volume: 0.002 },
    { transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', sku_code: 'SKU-005', sku_name: '无线充电器', expected_qty: 200, outbound_qty: 200, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.30, unit_volume: 0.003 },
    { transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', sku_code: 'SKU-006', sku_name: '平板支架', expected_qty: 120, outbound_qty: 120, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.45, unit_volume: 0.005 },
    { transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', sku_code: 'SKU-007', sku_name: '键盘膜', expected_qty: 80, outbound_qty: 80, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.02, unit_volume: 0.0002 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-001', sku_name: '蓝牙耳机 Pro', expected_qty: 100, outbound_qty: 0, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.15, unit_volume: 0.001 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-008', sku_name: 'USB集线器', expected_qty: 150, outbound_qty: 0, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.20, unit_volume: 0.0015 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-009', sku_name: '鼠标垫 大号', expected_qty: 100, outbound_qty: 0, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.35, unit_volume: 0.004 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-010', sku_name: '屏幕清洁套装', expected_qty: 50, outbound_qty: 0, inbound_qty: 0, shelf_qty: 0, unit_weight: 0.10, unit_volume: 0.0008 },
    { transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005', sku_code: 'SKU-011', sku_name: '数据线三合一', expected_qty: 150, outbound_qty: 150, inbound_qty: 150, shelf_qty: 130, inbound_diff: 0, shelf_abnormal_type: 'QTY_MISMATCH', unit_weight: 0.06, unit_volume: 0.0004, freight_cost_total: 4800.00, freight_cost_per_unit: 32.00 },
  ]);

  await knex('transfer_cartons').insert([
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', carton_no: 'CTN-001-01', logistics_tracking_no: 'WYT20260501001', carton_length: 60, carton_width: 40, carton_height: 35, carton_weight: 12.5, departure_time: '2026-05-03T14:00:00Z', arrival_port_time: '2026-05-15T08:00:00Z', customs_clearance_time: '2026-05-16T10:00:00Z', last_mile_pickup_time: '2026-05-17T09:00:00Z', logistics_sign_time: '2026-05-18T11:00:00Z', unload_time: '2026-05-18T14:00:00Z', shelf_time: '2026-05-19T16:00:00Z' },
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', carton_no: 'CTN-001-02', logistics_tracking_no: 'WYT20260501001', carton_length: 60, carton_width: 40, carton_height: 35, carton_weight: 11.8, departure_time: '2026-05-03T14:00:00Z', arrival_port_time: '2026-05-15T08:00:00Z', customs_clearance_time: '2026-05-16T10:00:00Z', last_mile_pickup_time: '2026-05-17T09:00:00Z', logistics_sign_time: '2026-05-18T11:00:00Z', unload_time: '2026-05-18T14:00:00Z', shelf_time: '2026-05-19T16:00:00Z' },
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', carton_no: 'CTN-001-03', logistics_tracking_no: 'WYT20260501001', carton_length: 50, carton_width: 35, carton_height: 30, carton_weight: 8.2, departure_time: '2026-05-03T14:00:00Z', arrival_port_time: '2026-05-15T08:00:00Z', customs_clearance_time: '2026-05-16T10:00:00Z', last_mile_pickup_time: '2026-05-17T09:00:00Z', logistics_sign_time: '2026-05-18T11:00:00Z', unload_time: '2026-05-18T14:00:00Z', shelf_time: '2026-05-19T16:00:00Z' },
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', carton_no: 'CTN-001-04', logistics_tracking_no: 'WYT20260501002', carton_length: 55, carton_width: 38, carton_height: 32, carton_weight: 10.1, departure_time: '2026-05-03T14:00:00Z', arrival_port_time: '2026-05-15T08:00:00Z', customs_clearance_time: '2026-05-16T10:00:00Z', last_mile_pickup_time: '2026-05-17T09:00:00Z', logistics_sign_time: '2026-05-18T11:00:00Z', unload_time: '2026-05-18T14:00:00Z', shelf_time: '2026-05-19T16:00:00Z' },
    { transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', carton_no: 'CTN-001-05', logistics_tracking_no: 'WYT20260501002', carton_length: 55, carton_width: 38, carton_height: 32, carton_weight: 9.6, departure_time: '2026-05-03T14:00:00Z', arrival_port_time: '2026-05-15T08:00:00Z', customs_clearance_time: '2026-05-16T10:00:00Z', last_mile_pickup_time: '2026-05-17T09:00:00Z', logistics_sign_time: '2026-05-18T11:00:00Z', unload_time: '2026-05-18T14:00:00Z', shelf_time: '2026-05-19T16:00:00Z' },
    { transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', carton_no: 'CTN-002-01', logistics_tracking_no: 'DSF20260505002', carton_length: 65, carton_width: 45, carton_height: 40, carton_weight: 15.0, departure_time: '2026-05-07T16:00:00Z' },
    { transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', carton_no: 'CTN-002-02', logistics_tracking_no: 'DSF20260505002', carton_length: 65, carton_width: 45, carton_height: 40, carton_weight: 14.5, departure_time: '2026-05-07T16:00:00Z' },
    { transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', carton_no: 'CTN-002-03', logistics_tracking_no: 'DSF20260505002', carton_length: 50, carton_width: 35, carton_height: 30, carton_weight: 8.0, departure_time: '2026-05-07T16:00:00Z' },
    { transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', carton_no: 'CTN-003-01', carton_length: 60, carton_width: 40, carton_height: 35, carton_weight: 13.0 },
    { transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', carton_no: 'CTN-003-02', carton_length: 50, carton_width: 35, carton_height: 30, carton_weight: 7.5 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', carton_no: 'CTN-004-01', carton_length: 60, carton_width: 40, carton_height: 35, carton_weight: 11.0 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', carton_no: 'CTN-004-02', carton_length: 60, carton_width: 40, carton_height: 35, carton_weight: 12.0 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', carton_no: 'CTN-004-03', carton_length: 55, carton_width: 38, carton_height: 32, carton_weight: 9.5 },
    { transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', carton_no: 'CTN-004-04', carton_length: 50, carton_width: 35, carton_height: 30, carton_weight: 6.0 },
    { transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005', carton_no: 'CTN-005-01', logistics_tracking_no: 'SF20260512005', carton_length: 55, carton_width: 38, carton_height: 32, carton_weight: 10.5, departure_time: '2026-05-14T12:00:00Z', arrival_port_time: '2026-05-19T06:00:00Z', customs_clearance_time: '2026-05-20T09:00:00Z', last_mile_pickup_time: '2026-05-20T14:00:00Z', logistics_sign_time: '2026-05-21T10:00:00Z', unload_time: '2026-05-21T15:00:00Z', is_shelf_abnormal: true, shelf_abnormal_type: 'QTY_MISMATCH', shelf_abnormal_remark: '上架少20个' },
    { transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005', carton_no: 'CTN-005-02', logistics_tracking_no: 'SF20260512005', carton_length: 50, carton_width: 35, carton_height: 30, carton_weight: 7.8, departure_time: '2026-05-14T12:00:00Z', arrival_port_time: '2026-05-19T06:00:00Z', customs_clearance_time: '2026-05-20T09:00:00Z', last_mile_pickup_time: '2026-05-20T14:00:00Z', logistics_sign_time: '2026-05-21T10:00:00Z', unload_time: '2026-05-21T15:00:00Z' },
  ]);

  await knex('transfer_carton_items').insert([
    { carton_no: 'CTN-001-01', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-001', sku_name: '蓝牙耳机 Pro', overseas_sku_code: 'OS-SKU-001', product_name: 'Bluetooth Earphone Pro', qty: 80, shelf_qty: 80 },
    { carton_no: 'CTN-001-01', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-002', sku_name: '手机壳 透明', overseas_sku_code: 'OS-SKU-002', product_name: 'Clear Phone Case', qty: 100, shelf_qty: 100 },
    { carton_no: 'CTN-001-02', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-001', sku_name: '蓝牙耳机 Pro', overseas_sku_code: 'OS-SKU-001', product_name: 'Bluetooth Earphone Pro', qty: 120, shelf_qty: 120 },
    { carton_no: 'CTN-001-02', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-002', sku_name: '手机壳 透明', overseas_sku_code: 'OS-SKU-002', product_name: 'Clear Phone Case', qty: 80, shelf_qty: 80 },
    { carton_no: 'CTN-001-03', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-002', sku_name: '手机壳 透明', overseas_sku_code: 'OS-SKU-002', product_name: 'Clear Phone Case', qty: 120, shelf_qty: 120 },
    { carton_no: 'CTN-001-03', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-003', sku_name: '充电线 Type-C 1m', overseas_sku_code: 'OS-SKU-003', product_name: 'Type-C Charging Cable 1m', qty: 40, shelf_qty: 40 },
    { carton_no: 'CTN-001-04', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-003', sku_name: '充电线 Type-C 1m', overseas_sku_code: 'OS-SKU-003', product_name: 'Type-C Charging Cable 1m', qty: 40, shelf_qty: 40 },
    { carton_no: 'CTN-001-05', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001', sku_code: 'SKU-002', sku_name: '手机壳 透明', overseas_sku_code: 'OS-SKU-002', product_name: 'Clear Phone Case', qty: 0, shelf_qty: 0 },
    { carton_no: 'CTN-002-01', transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', sku_code: 'SKU-004', sku_name: '智能手表 S9', overseas_sku_code: 'OS-SKU-004', product_name: 'Smart Watch S9', qty: 50, shelf_qty: 0 },
    { carton_no: 'CTN-002-01', transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', sku_code: 'SKU-005', sku_name: '无线充电器', overseas_sku_code: 'OS-SKU-005', product_name: 'Wireless Charger', qty: 50, shelf_qty: 0 },
    { carton_no: 'CTN-002-02', transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', sku_code: 'SKU-004', sku_name: '智能手表 S9', overseas_sku_code: 'OS-SKU-004', product_name: 'Smart Watch S9', qty: 50, shelf_qty: 0 },
    { carton_no: 'CTN-002-02', transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', sku_code: 'SKU-005', sku_name: '无线充电器', overseas_sku_code: 'OS-SKU-005', product_name: 'Wireless Charger', qty: 80, shelf_qty: 0 },
    { carton_no: 'CTN-002-03', transfer_no: 'DB-20260505-002', inbound_order_no: 'INB-20260505-002', sku_code: 'SKU-005', sku_name: '无线充电器', overseas_sku_code: 'OS-SKU-005', product_name: 'Wireless Charger', qty: 70, shelf_qty: 0 },
    { carton_no: 'CTN-003-01', transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', sku_code: 'SKU-006', sku_name: '平板支架', overseas_sku_code: 'OS-SKU-006', product_name: 'Tablet Stand', qty: 80, shelf_qty: 0 },
    { carton_no: 'CTN-003-01', transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', sku_code: 'SKU-007', sku_name: '键盘膜', overseas_sku_code: 'OS-SKU-007', product_name: 'Keyboard Skin', qty: 40, shelf_qty: 0 },
    { carton_no: 'CTN-003-02', transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', sku_code: 'SKU-006', sku_name: '平板支架', overseas_sku_code: 'OS-SKU-006', product_name: 'Tablet Stand', qty: 40, shelf_qty: 0 },
    { carton_no: 'CTN-003-02', transfer_no: 'DB-20260508-003', inbound_order_no: 'INB-20260508-003', sku_code: 'SKU-007', sku_name: '键盘膜', overseas_sku_code: 'OS-SKU-007', product_name: 'Keyboard Skin', qty: 40, shelf_qty: 0 },
    { carton_no: 'CTN-004-01', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-001', sku_name: '蓝牙耳机 Pro', overseas_sku_code: 'OS-SKU-001', product_name: 'Bluetooth Earphone Pro', qty: 60, shelf_qty: 0 },
    { carton_no: 'CTN-004-01', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-008', sku_name: 'USB集线器', overseas_sku_code: 'OS-SKU-008', product_name: 'USB Hub', qty: 40, shelf_qty: 0 },
    { carton_no: 'CTN-004-02', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-008', sku_name: 'USB集线器', overseas_sku_code: 'OS-SKU-008', product_name: 'USB Hub', qty: 60, shelf_qty: 0 },
    { carton_no: 'CTN-004-02', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-009', sku_name: '鼠标垫 大号', overseas_sku_code: 'OS-SKU-009', product_name: 'Large Mouse Pad', qty: 50, shelf_qty: 0 },
    { carton_no: 'CTN-004-03', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-009', sku_name: '鼠标垫 大号', overseas_sku_code: 'OS-SKU-009', product_name: 'Large Mouse Pad', qty: 50, shelf_qty: 0 },
    { carton_no: 'CTN-004-03', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-010', sku_name: '屏幕清洁套装', overseas_sku_code: 'OS-SKU-010', product_name: 'Screen Cleaning Kit', qty: 30, shelf_qty: 0 },
    { carton_no: 'CTN-004-04', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-001', sku_name: '蓝牙耳机 Pro', overseas_sku_code: 'OS-SKU-001', product_name: 'Bluetooth Earphone Pro', qty: 40, shelf_qty: 0 },
    { carton_no: 'CTN-004-04', transfer_no: 'DB-20260510-004', inbound_order_no: 'INB-20260510-004', sku_code: 'SKU-010', sku_name: '屏幕清洁套装', overseas_sku_code: 'OS-SKU-010', product_name: 'Screen Cleaning Kit', qty: 20, shelf_qty: 0 },
    { carton_no: 'CTN-005-01', transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005', sku_code: 'SKU-011', sku_name: '数据线三合一', overseas_sku_code: 'OS-SKU-011', product_name: '3-in-1 Data Cable', qty: 80, shelf_qty: 70 },
    { carton_no: 'CTN-005-02', transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005', sku_code: 'SKU-011', sku_name: '数据线三合一', overseas_sku_code: 'OS-SKU-011', product_name: '3-in-1 Data Cable', qty: 70, shelf_qty: 60 },
  ]);

  await knex('tracking_events').insert([
    { transfer_no: 'DB-20260501-001', event_time: '2026-05-02T09:00:00Z', event_type: 'PICKUP', location: '深圳仓', description: '物流商提货', carrier: '万邑通', tracking_no: 'WYT20260501001' },
    { transfer_no: 'DB-20260501-001', event_time: '2026-05-03T14:00:00Z', event_type: 'DEPARTURE', location: '深圳盐田港', description: '离港发运', carrier: '万邑通', tracking_no: 'WYT20260501001' },
    { transfer_no: 'DB-20260501-001', event_time: '2026-05-15T08:00:00Z', event_type: 'ARRIVAL', location: '洛杉矶港', description: '到港', carrier: '万邑通', tracking_no: 'WYT20260501001' },
    { transfer_no: 'DB-20260501-001', event_time: '2026-05-16T10:00:00Z', event_type: 'CUSTOMS_CLEARANCE', location: '洛杉矶港', description: '清关完成', carrier: '万邑通', tracking_no: 'WYT20260501001' },
    { transfer_no: 'DB-20260501-001', event_time: '2026-05-17T09:00:00Z', event_type: 'LAST_MILE', location: '洛杉矶', description: '尾程提货', carrier: 'UPS', tracking_no: 'WYT20260501001' },
    { transfer_no: 'DB-20260501-001', event_time: '2026-05-18T11:00:00Z', event_type: 'DELIVERY', location: '洛杉矶仓', description: '签收入库', carrier: 'UPS', tracking_no: 'WYT20260501001' },
    { transfer_no: 'DB-20260505-002', event_time: '2026-05-06T10:00:00Z', event_type: 'PICKUP', location: '广州仓', description: '物流商提货', carrier: '递四方', tracking_no: 'DSF20260505002' },
    { transfer_no: 'DB-20260505-002', event_time: '2026-05-07T16:00:00Z', event_type: 'DEPARTURE', location: '广州南沙港', description: '离港发运', carrier: '递四方', tracking_no: 'DSF20260505002' },
    { transfer_no: 'DB-20260512-005', event_time: '2026-05-13T08:00:00Z', event_type: 'PICKUP', location: '广州仓', description: '物流商提货', carrier: '顺丰国际', tracking_no: 'SF20260512005' },
    { transfer_no: 'DB-20260512-005', event_time: '2026-05-14T12:00:00Z', event_type: 'DEPARTURE', location: '广州白云机场', description: '离港', carrier: '顺丰国际', tracking_no: 'SF20260512005' },
    { transfer_no: 'DB-20260512-005', event_time: '2026-05-19T06:00:00Z', event_type: 'ARRIVAL', location: '东京成田机场', description: '到港', carrier: '顺丰国际', tracking_no: 'SF20260512005' },
    { transfer_no: 'DB-20260512-005', event_time: '2026-05-20T09:00:00Z', event_type: 'CUSTOMS_CLEARANCE', location: '东京', description: '清关完成', carrier: '顺丰国际', tracking_no: 'SF20260512005' },
    { transfer_no: 'DB-20260512-005', event_time: '2026-05-21T10:00:00Z', event_type: 'DELIVERY', location: '东京仓', description: '签收入库', carrier: '佐川急便', tracking_no: 'SF20260512005' },
  ]);

  await knex('freight_bills').insert([
    {
      bill_no: 'FB-20260501-001', transfer_no: 'DB-20260501-001', inbound_order_no: 'INB-20260501-001',
      carrier_name: '万邑通', bill_type: 'SEA_FREIGHT', total_amount: 13200.50, currency: 'CNY',
      weight_kg: 52.2, volume_cbm: 2.8, allocation_method: 'BY_QUANTITY',
      status: 'CONFIRMED', bill_date: '2026-05-20', confirmed_time: '2026-05-22T10:00:00Z',
      confirmed_by: 'admin',
    },
    {
      bill_no: 'FB-20260512-005', transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005',
      carrier_name: '顺丰国际', bill_type: 'SEA_FREIGHT', total_amount: 4800.00, currency: 'CNY',
      weight_kg: 18.3, volume_cbm: 0.9, allocation_method: 'BY_QUANTITY',
      status: 'PENDING', bill_date: '2026-05-22',
    },
  ]);

  await knex('discrepancy_records').insert([
    {
      transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005',
      sku_code: 'SKU-011', sku_name: '数据线三合一', carton_no: 'CTN-005-01',
      discrepancy_category: 'SHELF', discrepancy_type: 'QTY_MISMATCH',
      expected_qty: 80, actual_qty: 70, diff_qty: -10,
      status: 'PENDING', description: '上架数量比签收少10个，原因待查',
    },
    {
      transfer_no: 'DB-20260512-005', inbound_order_no: 'INB-20260512-005',
      sku_code: 'SKU-011', sku_name: '数据线三合一', carton_no: 'CTN-005-02',
      discrepancy_category: 'SHELF', discrepancy_type: 'QTY_MISMATCH',
      expected_qty: 70, actual_qty: 60, diff_qty: -10,
      status: 'PENDING', description: '上架数量比签收少10个，原因待查',
    },
  ]);
}
