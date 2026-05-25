import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE change_logs DROP CONSTRAINT change_logs_record_type_check`);
  await knex.raw(`ALTER TABLE change_logs ADD CONSTRAINT change_logs_record_type_check CHECK (record_type IN ('transfer_order', 'transfer_carton', 'transfer_order_item', 'freight_bill', 'discrepancy'))`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE change_logs DROP CONSTRAINT change_logs_record_type_check`);
  await knex.raw(`ALTER TABLE change_logs ADD CONSTRAINT change_logs_record_type_check CHECK (record_type IN ('transfer_order', 'transfer_carton', 'transfer_order_item'))`);
}
