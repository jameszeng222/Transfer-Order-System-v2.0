import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transfer_cartons', (table) => {
    table.string('carton_spec_code');
    table.decimal('channel_weight');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transfer_cartons', (table) => {
    table.dropColumn('carton_spec_code');
    table.dropColumn('channel_weight');
  });
}
