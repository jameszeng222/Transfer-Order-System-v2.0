import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasData = await knex('change_logs').count('* as count').first();
  const count = Number(hasData?.count || 0);

  await knex.raw(`DROP TABLE IF EXISTS change_logs_backup`);

  await knex.raw(`ALTER TABLE change_logs RENAME TO change_logs_backup`);

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

  if (count > 0) {
    await knex.raw(`
      INSERT INTO change_logs (id, record_type, record_id, field_name, old_value, new_value, change_source, change_time, operator)
      SELECT id, record_type, record_id, field_name, old_value, new_value, change_source, change_time, operator
      FROM change_logs_backup
    `);
  }

  await knex.raw(`DROP TABLE change_logs_backup`);
}

export async function down(knex: Knex): Promise<void> {
  const hasData = await knex('change_logs').count('* as count').first();
  const count = Number(hasData?.count || 0);

  await knex.raw(`DROP TABLE IF EXISTS change_logs_backup`);

  await knex.raw(`ALTER TABLE change_logs RENAME TO change_logs_backup`);

  await knex.raw(`
    CREATE TABLE change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL CHECK (record_type IN ('transfer_order', 'transfer_carton', 'transfer_order_item')),
      record_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_source TEXT DEFAULT 'MANUAL',
      change_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      operator TEXT
    )
  `);

  if (count > 0) {
    const validRows = await knex('change_logs_backup')
      .whereIn('record_type', ['transfer_order', 'transfer_carton', 'transfer_order_item']);
    if (validRows.length > 0) {
      await knex('change_logs').insert(validRows);
    }
  }

  await knex.raw(`DROP TABLE change_logs_backup`);
}
