import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const ordersExists = await knex.schema.hasTable('transfer_orders');
  if (ordersExists) {
    await knex.raw('DROP INDEX IF EXISTS idx_transfer_orders_transport_type');
    await knex.raw('ALTER TABLE transfer_orders ADD COLUMN transport_type_new TEXT');
    await knex.raw('UPDATE transfer_orders SET transport_type_new = transport_type');
    await knex.raw('ALTER TABLE transfer_orders DROP COLUMN transport_type');
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN transport_type_new TO transport_type');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
  }

  const slaExists = await knex.schema.hasTable('sla_rules');
  if (slaExists) {
    await knex.raw('ALTER TABLE sla_rules ADD COLUMN transport_type_new TEXT NOT NULL DEFAULT \'SEA\'');
    await knex.raw('UPDATE sla_rules SET transport_type_new = transport_type');
    await knex.raw('ALTER TABLE sla_rules DROP COLUMN transport_type');
    await knex.raw('ALTER TABLE sla_rules RENAME COLUMN transport_type_new TO transport_type');
  }
}

export async function down(knex: Knex): Promise<void> {
}
