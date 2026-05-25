import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.raw(`PRAGMA table_info(change_logs)`);
  const columns = hasColumn.map((row: any) => row.name);
  if (!columns.includes('transfer_no')) {
    await knex.raw(`ALTER TABLE change_logs ADD COLUMN transfer_no TEXT`);
  }
  if (!columns.includes('reason')) {
    await knex.raw(`ALTER TABLE change_logs ADD COLUMN reason TEXT`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE change_logs_backup AS SELECT * FROM change_logs
  `);
  await knex.raw(`DROP TABLE change_logs`);
  await knex.raw(`
    CREATE TABLE change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL CHECK (record_type IN ('transfer_order', 'transfer_carton', 'transfer_order_item', 'freight_bill', 'discrepancy')),
      record_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_source TEXT DEFAULT 'MANUAL',
      change_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      operator TEXT
    )
  `);
  await knex.raw(`
    INSERT INTO change_logs (id, record_type, record_id, field_name, old_value, new_value, change_source, change_time, operator)
    SELECT id, record_type, record_id, field_name, old_value, new_value, change_source, change_time, operator
    FROM change_logs_backup
  `);
  await knex.raw(`DROP TABLE change_logs_backup`);
}
