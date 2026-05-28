import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const ordersExists = await knex.schema.hasTable('transfer_orders');
  if (ordersExists) {
    const ordersCols = await knex.raw('PRAGMA table_info(transfer_orders)');
    const hasOldCol = ordersCols.some((c: any) => c.name === 'transport_type');
    const hasNewCol = ordersCols.some((c: any) => c.name === 'transport_type_new');

    if (hasOldCol && !hasNewCol) {
      await knex.raw('DROP INDEX IF EXISTS idx_transfer_orders_transport_type');
      await knex.raw('ALTER TABLE transfer_orders ADD COLUMN transport_type_new TEXT');
      await knex.raw('UPDATE transfer_orders SET transport_type_new = transport_type');
      await knex.raw('ALTER TABLE transfer_orders DROP COLUMN transport_type');
      await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN transport_type_new TO transport_type');
      await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
    } else if (hasNewCol && !hasOldCol) {
      await knex.raw('DROP INDEX IF EXISTS idx_transfer_orders_transport_type');
      await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN transport_type_new TO transport_type');
      await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
    }
  }

  const slaExists = await knex.schema.hasTable('sla_rules');
  if (slaExists) {
    const slaCols = await knex.raw('PRAGMA table_info(sla_rules)');
    const hasOldCol = slaCols.some((c: any) => c.name === 'transport_type');
    const hasNewCol = slaCols.some((c: any) => c.name === 'transport_type_new');

    if (hasOldCol && !hasNewCol) {
      await knex.raw('DROP INDEX IF EXISTS sla_rules_dest_warehouse_id_transport_type_unique');
      await knex.raw('ALTER TABLE sla_rules ADD COLUMN transport_type_new TEXT NOT NULL DEFAULT \'SEA\'');
      await knex.raw('UPDATE sla_rules SET transport_type_new = transport_type');
      await knex.raw('ALTER TABLE sla_rules DROP COLUMN transport_type');
      await knex.raw('ALTER TABLE sla_rules RENAME COLUMN transport_type_new TO transport_type');
      await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS sla_rules_dest_warehouse_id_transport_type_unique ON sla_rules(dest_warehouse_id, transport_type)');
    } else if (hasNewCol && !hasOldCol) {
      await knex.raw('DROP INDEX IF EXISTS sla_rules_dest_warehouse_id_transport_type_unique');
      await knex.raw('ALTER TABLE sla_rules DROP COLUMN transport_type');
      await knex.raw('ALTER TABLE sla_rules RENAME COLUMN transport_type_new TO transport_type');
      await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS sla_rules_dest_warehouse_id_transport_type_unique ON sla_rules(dest_warehouse_id, transport_type)');
    }
  }
}

export async function down(knex: Knex): Promise<void> {
}
