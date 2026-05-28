import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF');

  await knex.raw(`
    CREATE TABLE warehouses_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_code TEXT UNIQUE NOT NULL,
      warehouse_name TEXT NOT NULL,
      region TEXT DEFAULT '',
      country TEXT DEFAULT '',
      address TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      warehouse_type TEXT NOT NULL CHECK(warehouse_type IN ('DOMESTIC_SELF', 'DOMESTIC_3RD', 'OVERSEAS_SELF', 'OVERSEAS_3RD')),
      warehouse_category TEXT DEFAULT 'SELF' CHECK(warehouse_category IN ('SELF', 'WANYITONG', 'AMAZON_FBA', 'FBT', 'OTHER')),
      api_enabled INTEGER DEFAULT 0,
      api_provider TEXT DEFAULT 'NONE' CHECK(api_provider IN ('WANYITONG', 'AMAZON', 'NONE')),
      api_config TEXT,
      api_sync_frequency TEXT DEFAULT '',
      last_sync_time TEXT,
      contact_name TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      create_time TEXT DEFAULT (datetime('now')),
      update_time TEXT DEFAULT (datetime('now'))
    )
  `);

  await knex.raw(`
    INSERT INTO warehouses_new (
      id, warehouse_code, warehouse_name, region, country, address, postal_code,
      warehouse_type, warehouse_category, api_enabled, api_provider, api_config,
      api_sync_frequency, last_sync_time, contact_name, contact_phone,
      is_active, create_time, update_time
    )
    SELECT
      id, warehouse_code, warehouse_name, region, country, '', '',
      CASE warehouse_type
        WHEN 'DOMESTIC' THEN 'DOMESTIC_SELF'
        WHEN 'OVERSEAS' THEN 'OVERSEAS_SELF'
        WHEN 'FBA' THEN 'DOMESTIC_3RD'
        WHEN 'THIRD_PARTY' THEN 'OVERSEAS_3RD'
        ELSE 'DOMESTIC_SELF'
      END,
      CASE warehouse_category
        WHEN 'SICHUANG' THEN 'FBT'
        WHEN 'ONNAT' THEN 'FBT'
        ELSE warehouse_category
      END,
      api_enabled, api_provider, api_config,
      api_sync_frequency, last_sync_time, contact_name, contact_phone,
      is_active, create_time, update_time
    FROM warehouses
  `);

  await knex.raw('DROP TABLE warehouses');
  await knex.raw('ALTER TABLE warehouses_new RENAME TO warehouses');

  await knex.raw('PRAGMA foreign_keys = ON');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = OFF');

  await knex.raw(`
    CREATE TABLE warehouses_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_code TEXT UNIQUE NOT NULL,
      warehouse_name TEXT NOT NULL,
      region TEXT DEFAULT '',
      country TEXT DEFAULT '',
      timezone TEXT DEFAULT 'Asia/Shanghai',
      warehouse_type TEXT NOT NULL CHECK(warehouse_type IN ('DOMESTIC', 'OVERSEAS', 'FBA', 'THIRD_PARTY')),
      warehouse_category TEXT DEFAULT 'SELF' CHECK(warehouse_category IN ('SELF', 'WANYITONG', 'AMAZON_FBA', 'SICHUANG', 'ONNAT', 'OTHER')),
      api_enabled INTEGER DEFAULT 0,
      api_provider TEXT DEFAULT 'NONE' CHECK(api_provider IN ('WANYITONG', 'AMAZON', 'NONE')),
      api_config TEXT,
      api_sync_frequency TEXT DEFAULT '',
      last_sync_time TEXT,
      contact_name TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      create_time TEXT DEFAULT (datetime('now')),
      update_time TEXT DEFAULT (datetime('now'))
    )
  `);

  await knex.raw(`
    INSERT INTO warehouses_old (
      id, warehouse_code, warehouse_name, region, country, timezone,
      warehouse_type, warehouse_category, api_enabled, api_provider, api_config,
      api_sync_frequency, last_sync_time, contact_name, contact_phone,
      is_active, create_time, update_time
    )
    SELECT
      id, warehouse_code, warehouse_name, region, country, 'Asia/Shanghai',
      CASE warehouse_type
        WHEN 'DOMESTIC_SELF' THEN 'DOMESTIC'
        WHEN 'DOMESTIC_3RD' THEN 'FBA'
        WHEN 'OVERSEAS_SELF' THEN 'OVERSEAS'
        WHEN 'OVERSEAS_3RD' THEN 'THIRD_PARTY'
        ELSE 'DOMESTIC'
      END,
      CASE warehouse_category
        WHEN 'FBT' THEN 'SICHUANG'
        ELSE warehouse_category
      END,
      api_enabled, api_provider, api_config,
      api_sync_frequency, last_sync_time, contact_name, contact_phone,
      is_active, create_time, update_time
    FROM warehouses
  `);

  await knex.raw('DROP TABLE warehouses');
  await knex.raw('ALTER TABLE warehouses_old RENAME TO warehouses');

  await knex.raw('PRAGMA foreign_keys = ON');
}
