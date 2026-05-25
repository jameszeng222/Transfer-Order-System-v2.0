import { Hono } from 'hono';
import { db } from '../db/index.js';

const query = new Hono();

query.post('/order', async (c) => {
  let transferNo = '';
  const body = await c.req.json().catch(() => ({}));
  transferNo = body.transferNo || c.req.header('X-Transfer-No') || '';
  if (!transferNo) {
    return c.json({ success: false, error: 'transferNo is required' }, 400);
  }

  const order = await db('transfer_orders').where({ transfer_no: transferNo }).first();
  if (!order) {
    return c.json({ success: false, error: 'Transfer order not found' }, 404);
  }

  const items = await db('transfer_order_items').where({ transfer_no: transferNo });
  const cartons = await db('transfer_cartons').where({ transfer_no: transferNo });
  const trackingEvents = await db('tracking_events').where({ transfer_no: transferNo }).orderBy('event_time', 'desc');
  const discrepancyRecords = await db('discrepancy_records').where({ transfer_no: transferNo });
  const freightBills = await db('freight_bills').where({ transfer_no: transferNo });
  const changeLogs = await db('change_logs').where({ transfer_no: transferNo }).orderBy('change_time', 'desc').limit(20);

  const cartonNos = cartons.map((ct: any) => ct.carton_no);
  let cartonItems: any[] = [];
  if (cartonNos.length > 0) {
    cartonItems = await db('transfer_carton_items')
      .where({ transfer_no: transferNo })
      .whereIn('carton_no', cartonNos);
  }

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
      items,
      cartons: cartonsWithItems,
      tracking_events: trackingEvents,
      discrepancy_records: discrepancyRecords,
      freight_bills: freightBills,
      change_logs: changeLogs,
    },
  });
});

export default query;
