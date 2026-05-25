import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasItems = await knex('transfer_order_items').count('* as count').first();
  if (Number(hasItems?.count) > 0) return;

  const orders = await knex('transfer_orders').select('id', 'transfer_no');
  if (orders.length === 0) return;

  const orderMap: Record<string, number> = {};
  for (const o of orders) orderMap[o.transfer_no] = o.id;

  const items: any[] = [
    { transfer_no: 'DB-20260501-001', system_sku: 'SKU-001-A', overseas_sku: 'OS-SKU-001-A', product_name: '蓝牙耳机 Pro', quantity: 200, unit_price: 25.00, carton_qty: 50 },
    { transfer_no: 'DB-20260501-001', system_sku: 'SKU-001-B', overseas_sku: 'OS-SKU-001-B', product_name: '充电宝 20000mAh', quantity: 180, unit_price: 15.00, carton_qty: 30 },
    { transfer_no: 'DB-20260501-001', system_sku: 'SKU-001-C', overseas_sku: 'OS-SKU-001-C', product_name: 'USB-C数据线 1m', quantity: 200, unit_price: 2.50, carton_qty: 100 },
    { transfer_no: 'DB-20260505-002', system_sku: 'SKU-002-A', overseas_sku: 'OS-SKU-002-A', product_name: '无线鼠标', quantity: 150, unit_price: 12.00, carton_qty: 50 },
    { transfer_no: 'DB-20260505-002', system_sku: 'SKU-002-B', overseas_sku: 'OS-SKU-002-B', product_name: '键盘套装', quantity: 150, unit_price: 35.00, carton_qty: 30 },
    { transfer_no: 'DB-20260508-003', system_sku: 'SKU-003-A', overseas_sku: 'OS-SKU-003-A', product_name: '手机壳 iPhone15', quantity: 100, unit_price: 3.00, carton_qty: 50 },
    { transfer_no: 'DB-20260508-003', system_sku: 'SKU-003-B', overseas_sku: 'OS-SKU-003-B', product_name: '钢化膜 iPhone15', quantity: 100, unit_price: 1.50, carton_qty: 100 },
    { transfer_no: 'DB-20260510-004', system_sku: 'SKU-004-A', overseas_sku: 'OS-SKU-004-A', product_name: '智能手表', quantity: 100, unit_price: 45.00, carton_qty: 25 },
    { transfer_no: 'DB-20260510-004', system_sku: 'SKU-004-B', overseas_sku: 'OS-SKU-004-B', product_name: '运动手环', quantity: 100, unit_price: 20.00, carton_qty: 50 },
    { transfer_no: 'DB-20260510-004', system_sku: 'SKU-004-C', overseas_sku: 'OS-SKU-004-C', product_name: '耳机收纳盒', quantity: 100, unit_price: 5.00, carton_qty: 100 },
    { transfer_no: 'DB-20260510-004', system_sku: 'SKU-004-D', overseas_sku: 'OS-SKU-004-D', product_name: '充电器 65W', quantity: 100, unit_price: 18.00, carton_qty: 25 },
    { transfer_no: 'DB-20260512-005', system_sku: 'SKU-005-A', overseas_sku: 'OS-SKU-005-A', product_name: '便携音箱', quantity: 150, unit_price: 22.00, carton_qty: 30 },
  ].map(item => ({ ...item, order_id: orderMap[item.transfer_no] })).filter(item => item.order_id);

  if (items.length > 0) {
    await knex('transfer_order_items').insert(items);
  }

  const cartons: any[] = [
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-01', carton_status: 'SHELVED', weight_kg: 12.5, length_cm: 50, width_cm: 40, height_cm: 35 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-02', carton_status: 'SHELVED', weight_kg: 11.8, length_cm: 50, width_cm: 40, height_cm: 35 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-03', carton_status: 'SHELVED', weight_kg: 10.2, length_cm: 45, width_cm: 35, height_cm: 30 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-04', carton_status: 'SHELVED', weight_kg: 9.5, length_cm: 45, width_cm: 35, height_cm: 30 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-05', carton_status: 'SHELVED', weight_kg: 8.0, length_cm: 40, width_cm: 30, height_cm: 25 },
    { transfer_no: 'DB-20260505-002', carton_no: 'CTN-002-01', carton_status: 'IN_TRANSIT', weight_kg: 14.0, length_cm: 55, width_cm: 45, height_cm: 40 },
    { transfer_no: 'DB-20260505-002', carton_no: 'CTN-002-02', carton_status: 'IN_TRANSIT', weight_kg: 13.5, length_cm: 55, width_cm: 45, height_cm: 40 },
    { transfer_no: 'DB-20260505-002', carton_no: 'CTN-002-03', carton_status: 'IN_TRANSIT', weight_kg: 12.0, length_cm: 50, width_cm: 40, height_cm: 35 },
    { transfer_no: 'DB-20260508-003', carton_no: 'CTN-003-01', carton_status: 'OUTBOUNDED', weight_kg: 6.0, length_cm: 35, width_cm: 25, height_cm: 20 },
    { transfer_no: 'DB-20260508-003', carton_no: 'CTN-003-02', carton_status: 'OUTBOUNDED', weight_kg: 5.5, length_cm: 35, width_cm: 25, height_cm: 20 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-01', carton_status: 'PENDING', weight_kg: 15.0, length_cm: 60, width_cm: 50, height_cm: 45 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-02', carton_status: 'PENDING', weight_kg: 14.5, length_cm: 60, width_cm: 50, height_cm: 45 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-03', carton_status: 'PENDING', weight_kg: 10.0, length_cm: 45, width_cm: 35, height_cm: 30 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-04', carton_status: 'PENDING', weight_kg: 8.5, length_cm: 40, width_cm: 30, height_cm: 25 },
    { transfer_no: 'DB-20260512-005', carton_no: 'CTN-005-01', carton_status: 'RECEIVED', weight_kg: 11.0, length_cm: 50, width_cm: 40, height_cm: 35 },
    { transfer_no: 'DB-20260512-005', carton_no: 'CTN-005-02', carton_status: 'RECEIVED', weight_kg: 10.5, length_cm: 50, width_cm: 40, height_cm: 35 },
  ].map(ct => ({ ...ct, order_id: orderMap[ct.transfer_no] })).filter(ct => ct.order_id);

  if (cartons.length > 0) {
    await knex('transfer_cartons').insert(cartons);
  }

  const cartonItems: any[] = [
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-01', system_sku: 'SKU-001-A', overseas_sku: 'OS-SKU-001-A', quantity: 50 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-02', system_sku: 'SKU-001-A', overseas_sku: 'OS-SKU-001-A', quantity: 50 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-03', system_sku: 'SKU-001-B', overseas_sku: 'OS-SKU-001-B', quantity: 30 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-03', system_sku: 'SKU-001-C', overseas_sku: 'OS-SKU-001-C', quantity: 50 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-04', system_sku: 'SKU-001-B', overseas_sku: 'OS-SKU-001-B', quantity: 30 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-04', system_sku: 'SKU-001-C', overseas_sku: 'OS-SKU-001-C', quantity: 50 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-05', system_sku: 'SKU-001-B', overseas_sku: 'OS-SKU-001-B', quantity: 30 },
    { transfer_no: 'DB-20260501-001', carton_no: 'CTN-001-05', system_sku: 'SKU-001-C', overseas_sku: 'OS-SKU-001-C', quantity: 50 },
    { transfer_no: 'DB-20260505-002', carton_no: 'CTN-002-01', system_sku: 'SKU-002-A', overseas_sku: 'OS-SKU-002-A', quantity: 50 },
    { transfer_no: 'DB-20260505-002', carton_no: 'CTN-002-02', system_sku: 'SKU-002-A', overseas_sku: 'OS-SKU-002-A', quantity: 50 },
    { transfer_no: 'DB-20260505-002', carton_no: 'CTN-002-03', system_sku: 'SKU-002-B', overseas_sku: 'OS-SKU-002-B', quantity: 30 },
    { transfer_no: 'DB-20260505-002', carton_no: 'CTN-002-03', system_sku: 'SKU-002-A', overseas_sku: 'OS-SKU-002-A', quantity: 50 },
    { transfer_no: 'DB-20260508-003', carton_no: 'CTN-003-01', system_sku: 'SKU-003-A', overseas_sku: 'OS-SKU-003-A', quantity: 50 },
    { transfer_no: 'DB-20260508-003', carton_no: 'CTN-003-01', system_sku: 'SKU-003-B', overseas_sku: 'OS-SKU-003-B', quantity: 50 },
    { transfer_no: 'DB-20260508-003', carton_no: 'CTN-003-02', system_sku: 'SKU-003-A', overseas_sku: 'OS-SKU-003-A', quantity: 50 },
    { transfer_no: 'DB-20260508-003', carton_no: 'CTN-003-02', system_sku: 'SKU-003-B', overseas_sku: 'OS-SKU-003-B', quantity: 50 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-01', system_sku: 'SKU-004-A', overseas_sku: 'OS-SKU-004-A', quantity: 25 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-02', system_sku: 'SKU-004-A', overseas_sku: 'OS-SKU-004-A', quantity: 25 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-02', system_sku: 'SKU-004-D', overseas_sku: 'OS-SKU-004-D', quantity: 25 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-03', system_sku: 'SKU-004-B', overseas_sku: 'OS-SKU-004-B', quantity: 50 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-03', system_sku: 'SKU-004-C', overseas_sku: 'OS-SKU-004-C', quantity: 50 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-04', system_sku: 'SKU-004-D', overseas_sku: 'OS-SKU-004-D', quantity: 25 },
    { transfer_no: 'DB-20260510-004', carton_no: 'CTN-004-04', system_sku: 'SKU-004-C', overseas_sku: 'OS-SKU-004-C', quantity: 50 },
    { transfer_no: 'DB-20260512-005', carton_no: 'CTN-005-01', system_sku: 'SKU-005-A', overseas_sku: 'OS-SKU-005-A', quantity: 30 },
    { transfer_no: 'DB-20260512-005', carton_no: 'CTN-005-02', system_sku: 'SKU-005-A', overseas_sku: 'OS-SKU-005-A', quantity: 30 },
  ];

  if (cartonItems.length > 0) {
    await knex('transfer_carton_items').insert(cartonItems);
  }

  const trackingEvents: any[] = [
    { transfer_no: 'DB-20260501-001', event_type: 'CREATED', event_time: '2026-05-01 09:00:00', location: '深圳仓', remark: '调拨单创建' },
    { transfer_no: 'DB-20260501-001', event_type: 'OUTBOUNDED', event_time: '2026-05-02 14:00:00', location: '深圳仓', remark: '已出库' },
    { transfer_no: 'DB-20260501-001', event_type: 'DEPARTED', event_time: '2026-05-03 10:00:00', location: '深圳港', remark: '已发船' },
    { transfer_no: 'DB-20260501-001', event_type: 'ARRIVED', event_time: '2026-05-18 08:00:00', location: '洛杉矶港', remark: '已到港' },
    { transfer_no: 'DB-20260501-001', event_type: 'DELIVERED', event_time: '2026-05-20 15:00:00', location: '洛杉矶仓', remark: '已签收' },
    { transfer_no: 'DB-20260501-001', event_type: 'SHELVED', event_time: '2026-05-21 10:00:00', location: '洛杉矶仓', remark: '已上架' },
    { transfer_no: 'DB-20260505-002', event_type: 'CREATED', event_time: '2026-05-05 10:00:00', location: '广州仓', remark: '调拨单创建' },
    { transfer_no: 'DB-20260505-002', event_type: 'OUTBOUNDED', event_time: '2026-05-06 15:00:00', location: '广州仓', remark: '已出库' },
    { transfer_no: 'DB-20260512-005', event_type: 'CREATED', event_time: '2026-05-12 09:00:00', location: '广州仓', remark: '调拨单创建' },
    { transfer_no: 'DB-20260512-005', event_type: 'OUTBOUNDED', event_time: '2026-05-13 14:00:00', location: '广州仓', remark: '已出库' },
    { transfer_no: 'DB-20260512-005', event_type: 'DEPARTED', event_time: '2026-05-14 10:00:00', location: '广州港', remark: '已发船' },
    { transfer_no: 'DB-20260512-005', event_type: 'ARRIVED', event_time: '2026-05-20 08:00:00', location: '东京港', remark: '已到港' },
    { transfer_no: 'DB-20260512-005', event_type: 'DELIVERED', event_time: '2026-05-22 15:00:00', location: '东京仓', remark: '已签收' },
  ];

  if (trackingEvents.length > 0) {
    await knex('tracking_events').insert(trackingEvents);
  }

  const freightBills: any[] = [
    { transfer_no: 'DB-20260501-001', bill_type: 'ESTIMATED', amount: 2500.00, currency: 'USD', allocation_method: 'BY_QTY', is_confirmed: true, confirm_time: '2026-05-22 10:00:00' },
    { transfer_no: 'DB-20260501-001', bill_type: 'ACTUAL', amount: 2350.00, currency: 'USD', allocation_method: 'BY_QTY', is_confirmed: true, confirm_time: '2026-05-23 09:00:00' },
    { transfer_no: 'DB-20260512-005', bill_type: 'ESTIMATED', amount: 1200.00, currency: 'USD', allocation_method: 'BY_QTY', is_confirmed: false },
  ];

  if (freightBills.length > 0) {
    await knex('freight_bills').insert(freightBills);
  }

  const discrepancyRecords: any[] = [
    { transfer_no: 'DB-20260512-005', carton_no: 'CTN-005-01', discrepancy_type: 'QUANTITY_MISMATCH', system_qty: 30, actual_qty: 28, system_sku: 'SKU-005-A', overseas_sku: 'OS-SKU-005-A', status: 'PENDING' },
    { transfer_no: 'DB-20260512-005', carton_no: 'CTN-005-02', discrepancy_type: 'SKU_MISMATCH', system_qty: 30, actual_qty: 30, system_sku: 'SKU-005-A', overseas_sku: 'OS-SKU-005-A', actual_sku: 'OS-SKU-005-B', status: 'PENDING' },
  ];

  if (discrepancyRecords.length > 0) {
    await knex('discrepancy_records').insert(discrepancyRecords);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('discrepancy_records').del();
  await knex('freight_bills').del();
  await knex('tracking_events').del();
  await knex('transfer_carton_items').del();
  await knex('transfer_cartons').del();
  await knex('transfer_order_items').del();
}
