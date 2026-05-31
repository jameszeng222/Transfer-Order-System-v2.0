import { Hono } from 'hono';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const query = new Hono();

query.post('/order', async (c) => {
  if (!await requirePermission(c, 'order.view')) {
    return c.json({ success: false, error: '无权限' }, 403);
  }
  try {
    const body = await c.req.json().catch(() => ({}));
    const transferNo = body.tn || body.transferNo || c.req.header('X-Transfer-No') || '';
    if (!transferNo) {
      return c.json({ success: false, error: 'transferNo is required' }, 400);
    }

    const order = await db('transfer_orders').where({ transfer_no: transferNo }).first();
    if (!order) {
      return c.json({ success: false, error: 'Transfer order not found' }, 404);
    }

    const [items, cartons, trackingEvents, discrepancyRecords, freightBills, changeLogs] = await Promise.all([
      db('transfer_order_items').where({ transfer_no: transferNo }),
      db('transfer_cartons').where({ transfer_no: transferNo }),
      db('tracking_events').where({ transfer_no: transferNo }).orderBy('event_time', 'desc'),
      db('discrepancy_records').where({ transfer_no: transferNo }),
      db('freight_bills').where({ transfer_no: transferNo }),
      db('change_logs').where({ transfer_no: transferNo }).orderBy('change_time', 'desc').limit(20),
    ]);

    const itemsWithShortage = items.map((item: any) => ({
      ...item,
      shelf_shortage: (item.inbound_qty > 0 && item.shelf_qty < item.inbound_qty) 
        ? item.inbound_qty - item.shelf_qty 
        : 0,
    }));

    const cartonItems = await db('transfer_carton_items').where({ transfer_no: transferNo });

    const natCmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    cartons.sort((a: any, b: any) => natCmp(a.carton_no || '', b.carton_no || ''));

    const cartonItemsMap: Record<string, any[]> = {};
    for (const ci of cartonItems) {
      if (!cartonItemsMap[ci.carton_no]) {
        cartonItemsMap[ci.carton_no] = [];
      }
      cartonItemsMap[ci.carton_no].push(ci);
    }

    const cartonsWithItems = cartons.map((ct: any) => ({
      ...ct,
      carton_items: cartonItemsMap[ct.carton_no] || [],
    }));

    return c.json({
      success: true,
      data: {
        ...order,
        items: itemsWithShortage,
        cartons: cartonsWithItems,
        tracking_events: trackingEvents,
        discrepancy_records: discrepancyRecords,
        freight_bills: freightBills,
        change_logs: changeLogs,
      },
    });
  } catch (err: any) {
    console.error('[query/order] Error:', err.message, err.stack);
    return c.json({ success: false, error: `Query error: ${err.message}` }, 500);
  }
});

export default query;
