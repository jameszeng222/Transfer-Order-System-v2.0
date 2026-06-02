import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const colInfo = await knex.raw('PRAGMA table_info(transfer_orders)');
  const statusCol = colInfo.find((r: any) => r.name === 'status');
  if (!statusCol) return;

  const hasCheck = await knex.raw('SELECT sql FROM sqlite_master WHERE type = ? AND tbl_name = ?', ['table', 'transfer_orders']);
  const tableSql = hasCheck[0]?.sql || '';

  if (tableSql.includes('PARTIAL_SHELVED')) return;

  const colInfoRows = colInfo as any[];
  const colNames = colInfoRows.map((r: any) => r.name);

  const keepCols = colNames.filter(c =>
    !['is_shelf_within_3days', 'is_carton_within_11days', 'is_carton_within_7days', 'is_carton_within_4days', 'erp_order_no', 'source', 'actual_arrival_date', 'last_mile_type', 'order_remark'].includes(c)
  );
  const colList = keepCols.join(', ');

  const fkRows = await knex.raw('PRAGMA foreign_key_list(transfer_orders)');
  const hasFk = fkRows.length > 0;

  if (hasFk) {
    await knex.raw('PRAGMA foreign_keys = OFF');
  }

  try {
    await knex.raw(`
      CREATE TABLE transfer_orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no TEXT UNIQUE NOT NULL,
        outbound_order_no TEXT,
        inbound_order_no TEXT UNIQUE NOT NULL,
        from_warehouse TEXT,
        to_warehouse TEXT,
        team TEXT,
        transfer_type TEXT CHECK(transfer_type IN ('DOMESTIC_TO_OVERSEAS', 'OVERSEAS_TO_OVERSEAS', 'RETURN_TO_SHELF', 'FBA_OUTBOUND')),
        status TEXT DEFAULT 'PENDING_OUTBOUND' CHECK(status IN ('PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'PARTIAL_SHELVED', 'SHELVED', 'COMPLETED', 'CANCELLED')),
        total_sku_count INTEGER DEFAULT 0,
        total_qty INTEGER DEFAULT 0,
        total_carton_count INTEGER DEFAULT 0,
        logistics_status TEXT,
        expected_arrival_date TEXT,
        expected_shelf_date TEXT,
        logistics_carrier TEXT,
        logistics_tracking_no TEXT,
        is_customs_declared INTEGER DEFAULT 0,
        customs_factory TEXT,
        is_inspected INTEGER DEFAULT 0,
        timeline_requirement_days INTEGER,
        transport_type TEXT,
        last_mile_channel TEXT,
        pickup_time TEXT,
        departure_time TEXT,
        arrival_port_time TEXT,
        customs_clearance_time TEXT,
        last_mile_pickup_time TEXT,
        logistics_sign_time TEXT,
        unload_time TEXT,
        shelf_time TEXT,
        is_logistics_abnormal INTEGER DEFAULT 0,
        logistics_abnormal_type TEXT,
        logistics_abnormal_remark TEXT,
        is_shelf_abnormal INTEGER DEFAULT 0,
        shelf_abnormal_type TEXT,
        shelf_abnormal_remark TEXT,
        delay_explanation TEXT,
        estimated_unit_price REAL,
        estimated_freight REAL,
        total_freight_amount REAL,
        freight_currency TEXT DEFAULT 'CNY',
        freight_allocation_method TEXT DEFAULT 'BY_QUANTITY' CHECK(freight_allocation_method IN ('BY_QUANTITY', 'BY_WEIGHT', 'BY_VOLUME')),
        is_reconciled INTEGER DEFAULT 0,
        is_paid INTEGER DEFAULT 0,
        create_time TEXT DEFAULT (datetime('now')),
        update_time TEXT DEFAULT (datetime('now')),
        remark TEXT
      )
    `);

    await knex.raw(`INSERT INTO transfer_orders_new (${colList}) SELECT ${colList} FROM transfer_orders`);

    await knex.raw('DROP TABLE transfer_orders');
    await knex.raw('ALTER TABLE transfer_orders_new RENAME TO transfer_orders');

    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_status ON transfer_orders(status)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_create_time ON transfer_orders(create_time)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_from_warehouse ON transfer_orders(from_warehouse)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_to_warehouse ON transfer_orders(to_warehouse)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_pickup_time ON transfer_orders(pickup_time)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_departure_time ON transfer_orders(departure_time)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_logistics_sign_time ON transfer_orders(logistics_sign_time)');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_shelf_time ON transfer_orders(shelf_time)');
  } finally {
    if (hasFk) {
      await knex.raw('PRAGMA foreign_keys = ON');
    }
  }
}

export async function down(knex: Knex): Promise<void> {
}
