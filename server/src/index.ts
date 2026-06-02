import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/error.js';
import routes from './routes/index.js';
import { db } from './db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(serverDir, '..');

const app = new Hono();

app.use('*', cors({
  origin: [
    'https://jameszeng222.github.io',
    'https://transfer-order-system-v20-production.up.railway.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use('*', logger);
app.onError(errorHandler as any);

app.route('/api', routes);

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

const port = Number(process.env.PORT) || 3001;

async function bootstrap() {
  const dataDir = path.resolve(rootDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log('Running migrations...');
  try {
    await db('knex_migrations_lock').update({ is_locked: 0 }).where({ is_locked: 1 });
  } catch (_e) {
  }
  try {
    await db.migrate.latest({
      directory: path.resolve(serverDir, 'migrations'),
      extension: 'ts',
    });
  } catch (migrateErr: any) {
    console.error('Migration failed, attempting recovery:', migrateErr.message);
    try {
      await db('knex_migrations_lock').update({ is_locked: 0 }).where({ is_locked: 1 });
      const failedBatch = await db('knex_migrations').max('batch as b').first();
      if (failedBatch && Number(failedBatch.b) > 0) {
        await db('knex_migrations').where({ batch: failedBatch.b }).del();
      }
      await db.migrate.latest({
        directory: path.resolve(serverDir, 'migrations'),
        extension: 'ts',
      });
    } catch (retryErr: any) {
      console.error('Migration retry also failed:', retryErr.message);
      console.error('Server will start anyway, some features may not work');
    }
  }

  console.log('Checking field names...');
  const colInfo = await db.raw('PRAGMA table_info(transfer_orders)');
  const colNames = colInfo.map((r: any) => r.name);

  const tableDef = await db.raw('SELECT sql FROM sqlite_master WHERE type = ? AND tbl_name = ?', ['table', 'transfer_orders']);
  const tableSql = tableDef[0]?.sql || '';
  if (tableSql.includes('CHECK(status') && !tableSql.includes('PARTIAL_SHELVED')) {
    console.log('Fixing status CHECK constraint to include PARTIAL_SHELVED...');
    const keepCols = colNames.filter((c: string) =>
      !['is_shelf_within_3days', 'is_carton_within_11days', 'is_carton_within_7days', 'is_carton_within_4days', 'erp_order_no', 'source', 'actual_arrival_date', 'last_mile_type', 'order_remark'].includes(c)
    );
    const colList = keepCols.join(', ');

    await db.raw('PRAGMA foreign_keys = OFF');

    await db.raw(`
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

    await db.raw(`INSERT INTO transfer_orders_new (${colList}) SELECT ${colList} FROM transfer_orders`);
    await db.raw('DROP TABLE transfer_orders');
    await db.raw('ALTER TABLE transfer_orders_new RENAME TO transfer_orders');

    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_status ON transfer_orders(status)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_create_time ON transfer_orders(create_time)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_from_warehouse ON transfer_orders(from_warehouse)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_to_warehouse ON transfer_orders(to_warehouse)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_transport_type ON transfer_orders(transport_type)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_pickup_time ON transfer_orders(pickup_time)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_departure_time ON transfer_orders(departure_time)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_logistics_sign_time ON transfer_orders(logistics_sign_time)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_transfer_orders_shelf_time ON transfer_orders(shelf_time)');

    await db.raw('PRAGMA foreign_keys = ON');
    console.log('Status CHECK constraint fixed successfully.');
  }
  const renames: [string, string][] = [
    ['depart_time', 'departure_time'],
    ['arrive_port_time', 'arrival_port_time'],
    ['clearance_time', 'customs_clearance_time'],
    ['delivery_time', 'logistics_sign_time'],
    ['shelve_time', 'shelf_time'],
  ];
  for (const [oldName, newName] of renames) {
    if (colNames.includes(oldName) && !colNames.includes(newName)) {
      console.log(`Fixing column: ${oldName} → ${newName}`);
      await db.raw(`ALTER TABLE transfer_orders RENAME COLUMN ${oldName} TO ${newName}`);
    }
  }
  if (colNames.includes('order_remark')) {
    console.log('Merging order_remark into remark...');
    await db.raw('UPDATE transfer_orders SET remark = order_remark WHERE remark IS NULL AND order_remark IS NOT NULL');
    await db.raw('ALTER TABLE transfer_orders DROP COLUMN order_remark');
  }

  const hasUsers = await db('users').count('* as count').first();
  if (Number(hasUsers?.count) === 0) {
    console.log('Seeding foundational data (users missing)...');
    await db.seed.run({
      directory: path.resolve(serverDir, 'seeds'),
      extension: 'ts',
    });
  }

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server running at http://localhost:${info.port}`);
    }
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await db.destroy();
  process.exit(0);
});

export default app;
