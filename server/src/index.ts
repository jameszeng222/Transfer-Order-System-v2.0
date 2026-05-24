import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/error.js';
import routes from './routes/index.js';
import { db } from './db/index.js';

const app = new Hono();

app.use('*', cors());
app.use('*', logger);
app.onError(errorHandler as any);

app.route('/api', routes);

const port = Number(process.env.PORT) || 3001;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
  }
);

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await db.destroy();
  process.exit(0);
});

export default app;
