import { Hono } from 'hono';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const dataManagement = new Hono();

dataManagement.post('/clear-orders', async (c) => {
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }

  await db.transaction(async (trx) => {
    await trx('change_logs').del();
    await trx('tracking_events').del();
    await trx('discrepancy_records').del();
    await trx('freight_bills').del();
    await trx('transfer_carton_items').del();
    await trx('transfer_order_items').del();
    await trx('transfer_cartons').del();
    await trx('transfer_orders').del();
  });

  return c.json({ success: true, message: '调拨单和在途数据已清除' });
});

dataManagement.get('/stats', async (c) => {
  if (!await requirePermission(c, 'settings.manage')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }

  const [orders, cartons, cartonItems, orderItems, trackingEvents, discrepancies, freightBills, changeLogs] = await Promise.all([
    db('transfer_orders').count('* as count').first(),
    db('transfer_cartons').count('* as count').first(),
    db('transfer_carton_items').count('* as count').first(),
    db('transfer_order_items').count('* as count').first(),
    db('tracking_events').count('* as count').first(),
    db('discrepancy_records').count('* as count').first(),
    db('freight_bills').count('* as count').first(),
    db('change_logs').count('* as count').first(),
  ]);

  return c.json({
    success: true,
    data: {
      orders: Number(orders?.count || 0),
      cartons: Number(cartons?.count || 0),
      cartonItems: Number(cartonItems?.count || 0),
      orderItems: Number(orderItems?.count || 0),
      trackingEvents: Number(trackingEvents?.count || 0),
      discrepancies: Number(discrepancies?.count || 0),
      freightBills: Number(freightBills?.count || 0),
      changeLogs: Number(changeLogs?.count || 0),
    },
  });
});

export default dataManagement;
