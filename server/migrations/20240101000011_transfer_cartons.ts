import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transfer_cartons', (table) => {
    table.increments('id').primary();
    table.string('transfer_no').notNullable().references('transfer_no').inTable('transfer_orders');
    table.string('inbound_order_no');
    table.string('carton_no').notNullable();
    table.string('logistics_tracking_no');
    table.string('logistics_carrier_order_no');
    table.decimal('carton_length');
    table.decimal('carton_width');
    table.decimal('carton_height');
    table.decimal('carton_weight');
    table.decimal('declared_value');
    table.timestamp('departure_time');
    table.timestamp('arrival_port_time');
    table.timestamp('customs_clearance_time');
    table.timestamp('last_mile_pickup_time');
    table.timestamp('logistics_sign_time');
    table.timestamp('unload_time');
    table.timestamp('shelf_time');
    table.boolean('is_shelf_abnormal').defaultTo(false);
    table.string('shelf_abnormal_type');
    table.string('shelf_abnormal_remark');
    table.timestamp('receipt_time');
    table.timestamp('arrival_port_time_local');
    table.timestamp('departure_time_local');
    table.timestamp('landing_time_local');
    table.timestamp('last_mile_pickup_time_local');
    table.timestamp('logistics_sign_time_local');
    table.timestamp('unload_time_local');
    table.timestamp('shelf_time_local');
    table.decimal('checkout_to_sign_days');
    table.decimal('sign_to_shelf_days');
    table.decimal('unload_to_shelf_days');
    table.boolean('is_shelf_within_3days');
    table.boolean('is_carton_within_11days');
    table.boolean('is_carton_within_7days');
    table.boolean('is_carton_within_4days');
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transfer_cartons');
}
