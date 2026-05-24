import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('change_logs', (table) => {
    table.increments('id').primary();
    table.string('record_type').notNullable().checkIn(['transfer_order', 'transfer_carton', 'transfer_order_item']);
    table.integer('record_id').notNullable();
    table.string('transfer_no');
    table.string('field_name').notNullable();
    table.string('old_value');
    table.string('new_value');
    table.string('change_source').checkIn(['API', 'IMPORT', 'MANUAL']);
    table.string('operator');
    table.timestamp('change_time').defaultTo(knex.fn.now());
    table.string('reason');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('change_logs');
}
