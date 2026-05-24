import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transfer_carton_items', (table) => {
    table.increments('id').primary();
    table.string('carton_no').notNullable();
    table.string('transfer_no').notNullable().references('transfer_no').inTable('transfer_orders');
    table.string('inbound_order_no');
    table.string('sku_code').notNullable();
    table.string('sku_name');
    table.string('overseas_sku_code');
    table.string('product_name');
    table.integer('qty').defaultTo(0);
    table.integer('shelf_qty').defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transfer_carton_items');
}
