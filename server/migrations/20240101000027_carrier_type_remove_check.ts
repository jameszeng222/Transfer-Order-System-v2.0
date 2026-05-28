import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF');

  await knex.raw(`
    CREATE TABLE carriers_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrier_code TEXT UNIQUE NOT NULL,
      carrier_name TEXT NOT NULL,
      carrier_type TEXT DEFAULT '',
      supported_transport_types TEXT DEFAULT '',
      supported_routes TEXT DEFAULT '',
      default_currency TEXT DEFAULT 'CNY',
      settlement_cycle TEXT DEFAULT '',
      contact_name TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      create_time TEXT DEFAULT (datetime('now')),
      update_time TEXT DEFAULT (datetime('now'))
    )
  `);

  await knex.raw(`
    INSERT INTO carriers_new SELECT * FROM carriers
  `);

  await knex.raw('DROP TABLE carriers');
  await knex.raw('ALTER TABLE carriers_new RENAME TO carriers');

  await knex.raw('PRAGMA foreign_keys = ON');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF');

  await knex.raw(`
    CREATE TABLE carriers_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrier_code TEXT UNIQUE NOT NULL,
      carrier_name TEXT NOT NULL,
      carrier_type TEXT DEFAULT 'INTERNATIONAL_SEA' CHECK(carrier_type IN ('INTERNATIONAL_EXPRESS', 'INTERNATIONAL_SEA', 'INTERNATIONAL_AIR', 'RAIL', 'TRUCK')),
      supported_transport_types TEXT DEFAULT '',
      supported_routes TEXT DEFAULT '',
      default_currency TEXT DEFAULT 'CNY',
      settlement_cycle TEXT DEFAULT '',
      contact_name TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      create_time TEXT DEFAULT (datetime('now')),
      update_time TEXT DEFAULT (datetime('now'))
    )
  `);

  await knex.raw(`
    INSERT INTO carriers_old SELECT * FROM carriers
  `);

  await knex.raw('DROP TABLE carriers');
  await knex.raw('ALTER TABLE carriers_old RENAME TO carriers');

  await knex.raw('PRAGMA foreign_keys = ON');
}
