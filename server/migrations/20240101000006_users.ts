import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('name').notNullable();
    table.string('phone').defaultTo('');
    table.string('email').defaultTo('');
    table.integer('team_id').unsigned().nullable().references('id').inTable('teams');
    table.integer('role_id').unsigned().notNullable().references('id').inTable('roles');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login_time').nullable();
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
