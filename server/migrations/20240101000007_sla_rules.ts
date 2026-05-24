import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sla_rules', (table) => {
    table.increments('id').primary();
    table.integer('dest_warehouse_id').unsigned().notNullable().references('id').inTable('warehouses');
    table.string('transport_type').notNullable().checkIn(['SEA', 'AIR', 'RAIL', 'TRUCK']);
    table.integer('sla_days').notNullable();
    table.integer('shelf_sla_days').defaultTo(3);
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
    table.unique(['dest_warehouse_id', 'transport_type']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sla_rules');
}
