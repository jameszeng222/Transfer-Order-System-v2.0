import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transfer_order_items', (table) => {
    table.increments('id').primary();
    table.string('transfer_no').notNullable().references('transfer_no').inTable('transfer_orders');
    table.string('inbound_order_no');
    table.string('sku_code').notNullable();
    table.string('sku_name');
    table.integer('expected_qty').defaultTo(0);
    table.integer('outbound_qty').defaultTo(0);
    table.integer('inbound_qty').defaultTo(0);
    table.integer('shelf_qty').defaultTo(0);
    table.integer('outbound_diff');
    table.integer('inbound_diff');
    table.integer('total_diff');
    table.string('diff_reason');
    table.decimal('unit_weight');
    table.decimal('unit_volume');
    table.decimal('freight_cost_total');
    table.decimal('freight_cost_per_unit');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transfer_order_items');
}
