import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('carriers', (table) => {
    table.increments('id').primary();
    table.string('carrier_code').unique().notNullable();
    table.string('carrier_name').notNullable();
    table.string('carrier_type').defaultTo('INTERNATIONAL_SEA').checkIn(['INTERNATIONAL_EXPRESS', 'INTERNATIONAL_SEA', 'INTERNATIONAL_AIR', 'RAIL', 'TRUCK']);
    table.string('supported_transport_types').defaultTo('');
    table.string('supported_routes').defaultTo('');
    table.string('default_currency').defaultTo('CNY');
    table.string('settlement_cycle').defaultTo('');
    table.string('contact_name').defaultTo('');
    table.string('contact_phone').defaultTo('');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('carriers');
}
