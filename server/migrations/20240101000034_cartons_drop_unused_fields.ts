import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const cols = await knex.raw('PRAGMA table_info(transfer_cartons)');
  const colNames = cols.map((r: any) => r.name);

  const dropCols = [
    'logistics_carrier_order_no',
    'receipt_time',
    'arrival_port_time_local',
    'departure_time_local',
    'landing_time_local',
    'last_mile_pickup_time_local',
    'logistics_sign_time_local',
    'unload_time_local',
    'shelf_time_local',
    'carton_spec_code',
    'declared_product_name',
    'checkout_to_sign_days',
    'sign_to_shelf_days',
    'is_shelf_within_3days',
    'is_carton_within_11days',
    'is_carton_within_7days',
    'is_carton_within_4days',
  ];

  for (const col of dropCols) {
    if (colNames.includes(col)) {
      await knex.raw(`ALTER TABLE transfer_cartons DROP COLUMN ${col}`);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
}
