import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transfer_orders', (table) => {
    table.increments('id').primary();
    table.string('transfer_no').unique().notNullable();
    table.string('erp_order_no');
    table.string('outbound_order_no');
    table.string('inbound_order_no').unique().notNullable();
    table.string('from_warehouse');
    table.string('to_warehouse');
    table.string('team');
    table.string('source').checkIn(['API_WANYITONG', 'API_AMAZON', 'MANUAL', 'OTHER']);
    table.string('transfer_type').checkIn(['DOMESTIC_TO_OVERSEAS', 'OVERSEAS_TO_OVERSEAS', 'RETURN_TO_SHELF', 'FBA_OUTBOUND']);
    table.string('status').defaultTo('PENDING_OUTBOUND').checkIn(['PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED', 'CANCELLED']);
    table.integer('total_sku_count').defaultTo(0);
    table.integer('total_qty').defaultTo(0);
    table.integer('total_carton_count').defaultTo(0);
    table.string('logistics_status');
    table.date('expected_arrival_date');
    table.date('actual_arrival_date');
    table.date('expected_shelf_date');
    table.string('logistics_carrier');
    table.string('logistics_tracking_no');
    table.boolean('is_customs_declared').defaultTo(false);
    table.string('customs_factory');
    table.boolean('is_inspected').defaultTo(false);
    table.integer('timeline_requirement_days');
    table.string('order_remark');
    table.string('transport_type').checkIn(['SEA', 'AIR', 'RAIL', 'TRUCK']);
    table.string('last_mile_type');
    table.string('last_mile_channel');
    table.timestamp('pickup_time');
    table.timestamp('depart_time');
    table.timestamp('arrive_port_time');
    table.timestamp('clearance_time');
    table.timestamp('last_mile_pickup_time');
    table.timestamp('delivery_time');
    table.timestamp('unload_time');
    table.timestamp('shelve_time');
    table.boolean('is_logistics_abnormal').defaultTo(false);
    table.string('logistics_abnormal_type');
    table.string('logistics_abnormal_remark');
    table.boolean('is_shelf_abnormal').defaultTo(false);
    table.string('shelf_abnormal_type');
    table.string('shelf_abnormal_remark');
    table.boolean('is_shelf_within_3days');
    table.boolean('is_carton_within_11days');
    table.boolean('is_carton_within_7days');
    table.boolean('is_carton_within_4days');
    table.string('delay_explanation');
    table.decimal('estimated_unit_price');
    table.decimal('estimated_freight');
    table.decimal('total_freight_amount');
    table.string('freight_currency').defaultTo('CNY');
    table.string('freight_allocation_method').defaultTo('BY_QUANTITY').checkIn(['BY_QUANTITY', 'BY_WEIGHT', 'BY_VOLUME']);
    table.boolean('is_reconciled').defaultTo(false);
    table.boolean('is_paid').defaultTo(false);
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
    table.string('remark');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transfer_orders');
}
