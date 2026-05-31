import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const columns = await knex.raw('PRAGMA table_info(transfer_order_items)');
  const colNames = columns.map((r: any) => r.name);

  if (!colNames.includes('overseas_sku_code')) {
    await knex.raw('ALTER TABLE transfer_order_items ADD COLUMN overseas_sku_code TEXT');
  }
}

export async function down(knex: Knex): Promise<void> {
  const columns = await knex.raw('PRAGMA table_info(transfer_order_items)');
  const colNames = columns.map((r: any) => r.name);

  if (colNames.includes('overseas_sku_code')) {
    await knex.raw('ALTER TABLE transfer_order_items DROP COLUMN overseas_sku_code');
  }
}
