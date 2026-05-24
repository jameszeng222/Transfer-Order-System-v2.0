import type { MiddlewareHandler } from 'hono';

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err: any) {
    console.error('Unhandled error:', err);
    return c.json(
      {
        success: false,
        error: err.message || 'Internal Server Error',
      },
      err.status || 500
    );
  }
};
