import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('job_queue', (table) => {
    table.increments('id').primary();
    table.string('job_type').notNullable();
    table.string('status').defaultTo('PENDING').checkIn(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']);
    table.timestamp('started_at');
    table.timestamp('finished_at');
    table.json('result').nullable();
    table.string('error');
    table.integer('retry_count').defaultTo(0);
    table.string('trigger_source').checkIn(['CRON', 'MANUAL']);
    table.timestamp('create_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('job_queue');
}
