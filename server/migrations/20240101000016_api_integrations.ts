import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('api_integrations', (table) => {
    table.increments('id').primary();
    table.string('api_code').unique().notNullable();
    table.string('api_name').notNullable();
    table.string('api_provider').checkIn(['WANYITONG', 'AMAZON', 'OTHER']);
    table.string('api_type').checkIn(['DATA_SYNC', 'ORDER_CREATE', 'STATUS_CALLBACK']);
    table.string('api_endpoint');
    table.string('auth_type').checkIn(['API_KEY', 'OAUTH2', 'BASIC']);
    table.json('auth_config').nullable();
    table.string('sync_frequency');
    table.string('sync_direction').checkIn(['PULL', 'PUSH', 'BIDIRECTIONAL']);
    table.json('data_mapping').nullable();
    table.timestamp('last_sync_time');
    table.string('last_sync_status').checkIn(['SUCCESS', 'FAILED', 'NOT_EXECUTED']);
    table.integer('last_sync_record_count');
    table.string('error_message');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('api_integrations');
}
