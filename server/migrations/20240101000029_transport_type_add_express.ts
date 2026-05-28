import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_transfer_orders_transport_type');
  await knex.raw(`CREATE TABLE IF NOT EXISTS transfer_orders_tmp AS SELECT * FROM transfer_orders`);
  await knex.raw('DROP TABLE IF EXISTS transfer_orders_tmp');

  const colInfo = await knex.raw('PRAGMA table_info(transfer_orders)');
  const transportCol = colInfo.find((c: any) => c.name === 'transport_type');
  if (transportCol) {
    await knex.raw(`ALTER TABLE transfer_orders DROP COLUMN transport_type`);
    await knex.raw(`ALTER TABLE transfer_orders ADD COLUMN transport_type TEXT CHECK(transport_type IN ('SEA', 'AIR', 'RAIL', 'TRUCK', 'EXPRESS', 'FAST_SEA', 'SPECIAL'))`);
  }

  const slaColInfo = await knex.raw('PRAGMA table_info(sla_rules)');
  const slaTransportCol = slaColInfo.find((c: any) => c.name === 'transport_type');
  if (slaTransportCol) {
    await knex.raw(`ALTER TABLE sla_rules DROP COLUMN transport_type`);
    await knex.raw(`ALTER TABLE sla_rules ADD COLUMN transport_type TEXT NOT NULL DEFAULT 'SEA' CHECK(transport_type IN ('SEA', 'AIR', 'RAIL', 'TRUCK', 'EXPRESS', 'FAST_SEA', 'SPECIAL'))`);
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_transfer_orders_transport_type');
  await knex.raw(`ALTER TABLE transfer_orders DROP COLUMN transport_type`);
  await knex.raw(`ALTER TABLE transfer_orders ADD COLUMN transport_type TEXT CHECK(transport_type IN ('SEA', 'AIR', 'RAIL', 'TRUCK'))`);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
}
