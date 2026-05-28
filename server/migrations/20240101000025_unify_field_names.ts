import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('UPDATE transfer_orders SET remark = order_remark WHERE remark IS NULL AND order_remark IS NOT NULL');
  await knex.schema.alterTable('transfer_orders', (table) => {
    table.renameColumn('depart_time', 'departure_time');
    table.renameColumn('arrive_port_time', 'arrival_port_time');
    table.renameColumn('clearance_time', 'customs_clearance_time');
    table.renameColumn('delivery_time', 'logistics_sign_time');
    table.renameColumn('shelve_time', 'shelf_time');
    table.dropColumn('order_remark');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('transfer_orders', (table) => {
    table.renameColumn('departure_time', 'depart_time');
    table.renameColumn('arrival_port_time', 'arrive_port_time');
    table.renameColumn('customs_clearance_time', 'clearance_time');
    table.renameColumn('logistics_sign_time', 'delivery_time');
    table.renameColumn('shelf_time', 'shelve_time');
    table.string('order_remark').nullable();
  });
}
