import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE change_logs_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL CHECK (record_type IN ('transfer_order', 'transfer_carton', 'transfer_order_item', 'freight_bill', 'discrepancy', 'import_history')),
      record_id INTEGER NOT NULL,
      transfer_no TEXT,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_source TEXT DEFAULT 'MANUAL',
      change_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      operator TEXT,
      reason TEXT
    )
  `);

  await knex.raw(`
    INSERT INTO change_logs_new SELECT * FROM change_logs
  `);

  await knex.raw(`DROP TABLE change_logs`);
  await knex.raw(`ALTER TABLE change_logs_new RENAME TO change_logs`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE change_logs_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL CHECK (record_type IN ('transfer_order', 'transfer_carton', 'transfer_order_item', 'freight_bill', 'discrepancy')),
      record_id INTEGER NOT NULL,
      transfer_no TEXT,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_source TEXT DEFAULT 'MANUAL',
      change_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      operator TEXT,
      reason TEXT
    )
  `);

  await knex.raw(`
    INSERT INTO change_logs_old
    SELECT * FROM change_logs WHERE record_type != 'import_history'
  `);

  await knex.raw(`DROP TABLE change_logs`);
  await knex.raw(`ALTER TABLE change_logs_old RENAME TO change_logs`);
}
