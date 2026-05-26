import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_status ON transfer_orders(status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_create_time ON transfer_orders(create_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_from_warehouse ON transfer_orders(from_warehouse)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_to_warehouse ON transfer_orders(to_warehouse)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_pickup_time ON transfer_orders(pickup_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_depart_time ON transfer_orders(depart_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_delivery_time ON transfer_orders(delivery_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_shelve_time ON transfer_orders(shelve_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_order_items_transfer_no ON transfer_order_items(transfer_no)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_order_items_transfer_sku ON transfer_order_items(transfer_no, sku_code)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_cartons_transfer_no ON transfer_cartons(transfer_no)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_cartons_transfer_carton ON transfer_cartons(transfer_no, carton_no)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_carton_items_transfer_no ON transfer_carton_items(transfer_no)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tracking_events_transfer_time ON tracking_events(transfer_no, event_time)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_freight_bills_transfer_no ON freight_bills(transfer_no)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_freight_bills_bill_status ON freight_bills(bill_status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_discrepancy_records_transfer_no ON discrepancy_records(transfer_no)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_discrepancy_records_status ON discrepancy_records(status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_change_logs_transfer_no ON change_logs(transfer_no)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_change_logs_change_time ON change_logs(change_time)');
}

export async function down(knex: Knex): Promise<void> {
}
