import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('teams', (table) => {
    table.increments('id').primary();
    table.string('team_code').unique().notNullable();
    table.string('team_name').notNullable();
    table.string('leader').defaultTo('');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('teams');
}
