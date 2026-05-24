import { Hono } from 'hono';
import { db } from '../db/index.js';

const health = new Hono();

health.get('/', async (c) => {
  try {
    const result = await db.raw('SELECT 1 as ok');
    return c.json({
      success: true,
      data: {
        status: 'ok',
        database: result[0]?.ok === 1 ? 'connected' : 'error',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return c.json({
      success: false,
      data: {
        status: 'error',
        database: 'disconnected',
        error: err.message,
        timestamp: new Date().toISOString(),
      },
    }, 503);
  }
});

export default health;
