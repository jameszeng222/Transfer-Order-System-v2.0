import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('transfer_cartons', (table) => {
    table.string('declared_product_name');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('transfer_cartons', (table) => {
    table.dropColumn('declared_product_name');
  });
}
