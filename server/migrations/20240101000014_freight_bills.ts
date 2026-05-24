import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('freight_bills', (table) => {
    table.increments('id').primary();
    table.string('bill_no').unique().notNullable();
    table.string('transfer_no').notNullable().references('transfer_no').inTable('transfer_orders');
    table.string('logistics_carrier');
    table.decimal('freight_fee').defaultTo(0);
    table.decimal('customs_fee').defaultTo(0);
    table.decimal('other_fee').defaultTo(0);
    table.decimal('total_amount').defaultTo(0);
    table.string('currency').defaultTo('CNY');
    table.decimal('exchange_rate').defaultTo(1);
    table.decimal('total_amount_cny').defaultTo(0);
    table.date('bill_date');
    table.string('bill_status').defaultTo('PENDING').checkIn(['PENDING', 'CONFIRMED', 'RECONCILED']);
    table.timestamp('confirm_time');
    table.string('confirmer');
    table.string('remark');
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('freight_bills');
}
