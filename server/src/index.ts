import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/error.js';
import routes from './routes/index.js';
import { db } from './db/index.js';

const app = new Hono();

app.use('*', cors({
  origin: [
    'https://jameszeng222.github.io',
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
  console.log('Running migrations...');
  await db.migrate.latest({
    directory: './migrations',
    extension: 'ts',
  });

  const hasUsers = await db('users').count('* as count').first();
  if (Number(hasUsers?.count) === 0) {
    console.log('No users found, running seed...');
    await db.seed.run({
      directory: './seeds',
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
