import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const cols = await knex.raw('PRAGMA table_info(transfer_orders)');
  const colNames = cols.map((r: any) => r.name);

  const dropCols = [
    'is_shelf_within_3days',
    'is_carton_within_11days',
    'is_carton_within_7days',
    'is_carton_within_4days',
    'erp_order_no',
    'source',
    'actual_arrival_date',
  ];

  for (const col of dropCols) {
    if (colNames.includes(col)) {
      await knex.raw(`ALTER TABLE transfer_orders DROP COLUMN ${col}`);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
}
