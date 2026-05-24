import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('discrepancy_records', (table) => {
    table.increments('id').primary();
    table.string('transfer_no').notNullable().references('transfer_no').inTable('transfer_orders');
    table.string('carton_no');
    table.string('sku_code');
    table.string('discrepancy_category').checkIn(['QUANTITY_DIFF', 'QUALITY_ISSUE', 'LOGISTICS_ABNORMAL', 'SHELF_ABNORMAL']);
    table.string('discrepancy_type').checkIn(['SHORT_SHIPMENT', 'OVER_SHIPMENT', 'WRONG_ITEM', 'DAMAGED', 'DETERIORATED', 'TIMEOUT_PORT', 'TIMEOUT_CUSTOMS', 'TIMEOUT_DELIVERY', 'LOST', 'PARTIAL_SHELF', 'NOT_SHELVED', 'WRONG_SHELF']);
    table.integer('discrepancy_qty');
    table.string('status').defaultTo('PENDING').checkIn(['PENDING', 'PROCESSING', 'CLOSED']);
    table.string('handler');
    table.string('resolution');
    table.string('resolution_remark');
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
    table.timestamp('close_time');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('discrepancy_records');
}
