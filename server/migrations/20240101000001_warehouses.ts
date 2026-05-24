import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('warehouses', (table) => {
    table.increments('id').primary();
    table.string('warehouse_code').unique().notNullable();
    table.string('warehouse_name').notNullable();
    table.string('region').defaultTo('');
    table.string('country').defaultTo('');
    table.string('timezone').defaultTo('Asia/Shanghai');
    table.string('warehouse_type').notNullable().checkIn(['DOMESTIC', 'OVERSEAS', 'FBA', 'THIRD_PARTY']);
    table.string('warehouse_category').defaultTo('SELF').checkIn(['SELF', 'WANYITONG', 'AMAZON_FBA', 'SICHUANG', 'ONNAT', 'OTHER']);
    table.boolean('api_enabled').defaultTo(false);
    table.string('api_provider').defaultTo('NONE').checkIn(['WANYITONG', 'AMAZON', 'NONE']);
    table.json('api_config').nullable();
    table.string('api_sync_frequency').defaultTo('');
    table.timestamp('last_sync_time').nullable();
    table.string('contact_name').defaultTo('');
    table.string('contact_phone').defaultTo('');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('create_time').defaultTo(knex.fn.now());
    table.timestamp('update_time').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('warehouses');
}
