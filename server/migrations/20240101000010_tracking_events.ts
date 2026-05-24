import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tracking_events', (table) => {
    table.increments('id').primary();
    table.string('transfer_no').notNullable().references('transfer_no').inTable('transfer_orders');
    table.timestamp('event_time');
    table.string('event_type').checkIn(['SHIPPED', 'ARRIVED_PORT', 'CLEARING', 'CLEARED', 'PICKED_UP', 'DELIVERING', 'SIGNED', 'ABNORMAL']);
    table.string('event_desc');
    table.string('location');
    table.string('operator');
    table.timestamp('create_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tracking_events');
}
