import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const cols = await knex.raw('PRAGMA table_info(transfer_orders)');
  const colNames = cols.map((r: any) => r.name);

  if (colNames.includes('last_mile_type')) {
    await knex.raw('ALTER TABLE transfer_orders DROP COLUMN last_mile_type');
  }
}

export async function down(knex: Knex): Promise<void> {
}
