import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = async (col: string) => {
    const rows = await knex.raw(`PRAGMA table_info(transfer_orders)`);
    return rows.some((r: any) => r.name === col);
  };

  if (await hasColumn('order_remark')) {
    await knex.raw('UPDATE transfer_orders SET remark = order_remark WHERE remark IS NULL AND order_remark IS NOT NULL');
  }

  if (await hasColumn('depart_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN depart_time TO departure_time');
  }
  if (await hasColumn('arrive_port_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN arrive_port_time TO arrival_port_time');
  }
  if (await hasColumn('clearance_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN clearance_time TO customs_clearance_time');
  }
  if (await hasColumn('delivery_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN delivery_time TO logistics_sign_time');
  }
  if (await hasColumn('shelve_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN shelve_time TO shelf_time');
  }
  if (await hasColumn('order_remark')) {
    await knex.raw('ALTER TABLE transfer_orders DROP COLUMN order_remark');
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = async (col: string) => {
    const rows = await knex.raw(`PRAGMA table_info(transfer_orders)`);
    return rows.some((r: any) => r.name === col);
  };

  if (await hasColumn('departure_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN departure_time TO depart_time');
  }
  if (await hasColumn('arrival_port_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN arrival_port_time TO arrive_port_time');
  }
  if (await hasColumn('customs_clearance_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN customs_clearance_time TO clearance_time');
  }
  if (await hasColumn('logistics_sign_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN logistics_sign_time TO delivery_time');
  }
  if (await hasColumn('shelf_time')) {
    await knex.raw('ALTER TABLE transfer_orders RENAME COLUMN shelf_time TO shelve_time');
  }
  if (!(await hasColumn('order_remark'))) {
    await knex.raw('ALTER TABLE transfer_orders ADD COLUMN order_remark TEXT');
  }
}
