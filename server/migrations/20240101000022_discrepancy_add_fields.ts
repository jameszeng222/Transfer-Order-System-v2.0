import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasSource = await knex.raw(`PRAGMA table_info(discrepancy_records)`);
  const columns = hasSource.map((row: any) => row.name);

  if (!columns.includes('sku_name')) {
    await knex.raw(`ALTER TABLE discrepancy_records ADD COLUMN sku_name TEXT`);
  }
  if (!columns.includes('overseas_sku_code')) {
    await knex.raw(`ALTER TABLE discrepancy_records ADD COLUMN overseas_sku_code TEXT`);
  }
  if (!columns.includes('source')) {
    await knex.raw(`ALTER TABLE discrepancy_records ADD COLUMN source TEXT DEFAULT 'MANUAL'`);
  }
  if (!columns.includes('inbound_order_no')) {
    await knex.raw(`ALTER TABLE discrepancy_records ADD COLUMN inbound_order_no TEXT`);
  }
}

export async function down(knex: Knex): Promise<void> {
}
