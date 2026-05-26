import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';

const freight = new Hono();

const createFreightBillSchema = z.object({
  transfer_no: z.string().min(1),
  logistics_carrier: z.string().optional(),
  freight_fee: z.number().nonnegative().optional(),
  customs_fee: z.number().nonnegative().optional(),
  other_fee: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  exchange_rate: z.number().positive().optional(),
  bill_date: z.string().optional(),
  remark: z.string().optional(),
});

const updateFreightBillSchema = z.object({
  logistics_carrier: z.string().optional(),
  freight_fee: z.number().nonnegative().optional(),
  customs_fee: z.number().nonnegative().optional(),
  other_fee: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  exchange_rate: z.number().positive().optional(),
  bill_date: z.string().optional(),
  remark: z.string().optional(),
});

async function generateBillNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
  const prefix = `FB-${dateStr}-`;

  const lastBill = await db('freight_bills')
    .where('bill_no', 'like', `${prefix}%`)
    .orderBy('bill_no', 'desc')
    .first();

  let seq = 1;
  if (lastBill) {
    const lastSeq = parseInt(lastBill.bill_no.substring(prefix.length), 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function allocateFreight(transferNo: string, user?: { username: string }, trx?: any) {
  const dbConn = trx || db;
  const order = await dbConn('transfer_orders').where({ transfer_no: transferNo }).first();
  if (!order) return;

  const bills = await dbConn('freight_bills')
    .where({ transfer_no: transferNo, bill_status: 'CONFIRMED' });

  const totalFreightCny = bills.reduce((sum: number, b: any) => sum + Number(b.total_amount_cny || 0), 0);

  const items = await dbConn('transfer_order_items')
    .where({ transfer_no: transferNo })
    .where('outbound_qty', '>', 0);

  if (items.length === 0) {
    throw new Error('该调拨单没有出库数量大于0的SKU，无法进行运费分摊');
  }

  const method = order.freight_allocation_method || 'BY_QUANTITY';
  let totalWeight = 0;
  let totalVolume = 0;
  let totalQty = 0;

  for (const item of items) {
    const qty = Number(item.outbound_qty || 0);
    const weight = Number(item.unit_weight || 0);
    const volume = Number(item.unit_volume || 0);
    totalQty += qty;
    totalWeight += qty * weight;
    totalVolume += qty * volume;
  }

  const allocations: { id: number; freight_cost_total: number; freight_cost_per_unit: number }[] = [];
  let allocatedSum = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qty = Number(item.outbound_qty || 0);
    const weight = Number(item.unit_weight || 0);
    const volume = Number(item.unit_volume || 0);

    let ratio = 0;
    if (method === 'BY_QUANTITY') {
      ratio = totalQty > 0 ? qty / totalQty : 0;
    } else if (method === 'BY_WEIGHT') {
      ratio = totalWeight > 0 ? (qty * weight) / totalWeight : 0;
    } else if (method === 'BY_VOLUME') {
      ratio = totalVolume > 0 ? (qty * volume) / totalVolume : 0;
    }

    let freightCostTotal: number;
    if (i === items.length - 1) {
      freightCostTotal = Math.round((totalFreightCny - allocatedSum) * 100) / 100;
    } else {
      freightCostTotal = Math.round(totalFreightCny * ratio * 100) / 100;
      allocatedSum += freightCostTotal;
    }

    const freightCostPerUnit = qty > 0 ? Math.round((freightCostTotal / qty) * 100) / 100 : 0;

    allocations.push({
      id: item.id,
      freight_cost_total: freightCostTotal,
      freight_cost_per_unit: freightCostPerUnit,
    });
  }

  const now = new Date().toISOString();
  for (const alloc of allocations) {
    await dbConn('transfer_order_items').where({ id: alloc.id }).update({
      freight_cost_total: alloc.freight_cost_total,
      freight_cost_per_unit: alloc.freight_cost_per_unit,
    });
  }

  await dbConn('transfer_orders').where({ transfer_no: transferNo }).update({
    total_freight_amount: totalFreightCny,
    update_time: now,
  });

  await dbConn('change_logs').insert({
    record_type: 'freight_bill',
    record_id: order.id,
    transfer_no: transferNo,
    field_name: 'freight_allocated',
    old_value: null,
    new_value: JSON.stringify({ totalFreightCny, method, itemCount: items.length }),
    change_source: 'MANUAL',
    operator: user?.username || 'unknown',
    change_time: now,
  });
}

freight.get('/stats', async (c) => {
  const [pendingResult, confirmedResult, reconciledResult, amountResult] = await Promise.all([
    db('freight_bills').where({ bill_status: 'PENDING' }).count('* as count').first(),
    db('freight_bills').where({ bill_status: 'CONFIRMED' }).count('* as count').first(),
    db('freight_bills').where({ bill_status: 'RECONCILED' }).count('* as count').first(),
    db('freight_bills').sum('total_amount_cny as total').first(),
  ]);

  return c.json({
    success: true,
    data: {
      pending_count: Number(pendingResult?.count || 0),
      confirmed_count: Number(confirmedResult?.count || 0),
      reconciled_count: Number(reconciledResult?.count || 0),
      total_amount_cny: Number(amountResult?.total || 0),
    },
  });
});

freight.get('/', async (c) => {
  const page = Number(c.req.query('page')) || 1;
  const MAX_PAGE_SIZE = 200;
const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, MAX_PAGE_SIZE);
  const billStatus = c.req.query('bill_status');
  const logisticsCarrier = c.req.query('logistics_carrier');
  const transferNo = c.req.query('transfer_no');

  let query = db('freight_bills')
    .leftJoin('transfer_orders', 'freight_bills.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'freight_bills.*',
      'transfer_orders.inbound_order_no',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse'
    );

  if (billStatus) {
    query = query.where('freight_bills.bill_status', billStatus);
  }
  if (logisticsCarrier) {
    query = query.where('freight_bills.logistics_carrier', logisticsCarrier);
  }
  if (transferNo) {
    query = query.where('freight_bills.transfer_no', 'like', `%${transferNo}%`);
  }

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const data = await query
    .clone()
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .orderBy('freight_bills.id', 'desc');

  return c.json({
    success: true,
    data,
    pagination: { total, page, pageSize },
  });
});

const batchReconcileSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

freight.put('/batch-reconcile', zValidator('json', batchReconcileSchema), async (c) => {
  const { ids } = c.req.valid('json');
  const user = c.get('user');

  const bills = await db('freight_bills').whereIn('id', ids);
  const confirmableBills = bills.filter((b: any) => b.bill_status === 'CONFIRMED');

  if (confirmableBills.length === 0) {
    return c.json({ success: false, error: '没有可对账的账单（需要已确认状态）' }, 400);
  }

  const now = new Date().toISOString();
  const confirmableIds = confirmableBills.map((b: any) => b.id);
  const transferNos = [...new Set(confirmableBills.map((b: any) => b.transfer_no))];

  await db('freight_bills').whereIn('id', confirmableIds).update({
    bill_status: 'RECONCILED',
    update_time: now,
  });

  await db('transfer_orders')
    .whereIn('transfer_no', transferNos)
    .update({
      is_reconciled: true,
      update_time: now,
    });

  const logEntries = confirmableBills.map((b: any) => ({
    record_type: 'freight_bill',
    record_id: b.id,
    transfer_no: b.transfer_no,
    field_name: 'freight_bill.status',
    old_value: b.bill_status,
    new_value: 'RECONCILED',
    change_source: 'MANUAL',
    operator: user?.username || 'unknown',
    change_time: now,
  }));

  await db('change_logs').insert(logEntries);

  return c.json({
    success: true,
    data: {
      reconciled_count: confirmableIds.length,
      skipped_count: ids.length - confirmableIds.length,
    },
  });
});

freight.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const item = await db('freight_bills')
    .leftJoin('transfer_orders', 'freight_bills.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'freight_bills.*',
      'transfer_orders.inbound_order_no',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse'
    )
    .where('freight_bills.id', id)
    .first();
  if (!item) {
    return c.json({ success: false, error: 'Freight bill not found' }, 404);
  }
  return c.json({ success: true, data: item });
});

freight.post('/', zValidator('json', createFreightBillSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  const order = await db('transfer_orders').where({ transfer_no: body.transfer_no }).first();
  if (!order) {
    return c.json({ success: false, error: 'transfer_no 不存在' }, 400);
  }

  const billNo = await generateBillNo();
  const freightFee = Number(body.freight_fee || 0);
  const customsFee = Number(body.customs_fee || 0);
  const otherFee = Number(body.other_fee || 0);
  const totalAmount = Math.round((freightFee + customsFee + otherFee) * 100) / 100;
  const exchangeRate = Number(body.exchange_rate || 1);
  const totalAmountCny = Math.round(totalAmount * exchangeRate * 100) / 100;

  const now = new Date().toISOString();
  const [inserted] = await db('freight_bills')
    .insert({
      bill_no: billNo,
      transfer_no: body.transfer_no,
      logistics_carrier: body.logistics_carrier || null,
      freight_fee: freightFee,
      customs_fee: customsFee,
      other_fee: otherFee,
      total_amount: totalAmount,
      currency: body.currency || 'CNY',
      exchange_rate: exchangeRate,
      total_amount_cny: totalAmountCny,
      bill_date: body.bill_date || null,
      remark: body.remark || null,
      bill_status: 'PENDING',
      create_time: now,
      update_time: now,
    })
    .returning('*');

  await db('change_logs').insert({
    record_type: 'freight_bill',
    record_id: order.id,
    transfer_no: body.transfer_no,
    field_name: 'freight_bill_created',
    old_value: null,
    new_value: JSON.stringify(inserted),
    change_source: 'MANUAL',
    operator: user?.username || 'unknown',
    change_time: now,
  });

  return c.json({ success: true, data: inserted }, 201);
});

freight.put('/:id', zValidator('json', updateFreightBillSchema), async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const user = c.get('user');

  const existing = await db('freight_bills').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Freight bill not found' }, 404);
  }

  const now = new Date().toISOString();
  const freightFee = body.freight_fee !== undefined ? Number(body.freight_fee) : Number(existing.freight_fee || 0);
  const customsFee = body.customs_fee !== undefined ? Number(body.customs_fee) : Number(existing.customs_fee || 0);
  const otherFee = body.other_fee !== undefined ? Number(body.other_fee) : Number(existing.other_fee || 0);
  const totalAmount = Math.round((freightFee + customsFee + otherFee) * 100) / 100;
  const exchangeRate = body.exchange_rate !== undefined ? Number(body.exchange_rate) : Number(existing.exchange_rate || 1);
  const totalAmountCny = Math.round(totalAmount * exchangeRate * 100) / 100;

  const updates: Record<string, any> = {
    ...body,
    total_amount: totalAmount,
    total_amount_cny: totalAmountCny,
    update_time: now,
  };

  if (body.freight_fee !== undefined) updates.freight_fee = freightFee;
  if (body.customs_fee !== undefined) updates.customs_fee = customsFee;
  if (body.other_fee !== undefined) updates.other_fee = otherFee;
  if (body.exchange_rate !== undefined) updates.exchange_rate = exchangeRate;

  const logEntries: any[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'update_time') continue;
    const oldValue = existing[key] != null ? String(existing[key]) : null;
    const newValue = value != null ? String(value) : null;
    if (oldValue !== newValue) {
      logEntries.push({
        record_type: 'freight_bill',
        record_id: existing.id,
        transfer_no: existing.transfer_no,
        field_name: `freight_bill.${key}`,
        old_value: oldValue,
        new_value: newValue,
        change_source: 'MANUAL',
        operator: user?.username || 'unknown',
        change_time: now,
      });
    }
  }

  await db('freight_bills').where({ id }).update(updates);
  if (logEntries.length > 0) {
    await db('change_logs').insert(logEntries);
  }

  const updated = await db('freight_bills')
    .leftJoin('transfer_orders', 'freight_bills.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'freight_bills.*',
      'transfer_orders.inbound_order_no',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse'
    )
    .where('freight_bills.id', id)
    .first();

  return c.json({ success: true, data: updated });
});

freight.put('/:id/confirm', async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');

  try {
    const result = await db.transaction(async (trx) => {
      const existing = await trx('freight_bills').where({ id }).first();
      if (!existing) {
        throw new Error('NOT_FOUND');
      }
      if (existing.bill_status !== 'PENDING') {
        throw new Error('NOT_PENDING');
      }

      const now = new Date().toISOString();

      await trx('freight_bills').where({ id }).update({
        bill_status: 'CONFIRMED',
        confirm_time: now,
        confirmer: user?.username || 'system',
        update_time: now,
      });

      await trx('change_logs').insert({
        record_type: 'freight_bill',
        record_id: existing.id,
        transfer_no: existing.transfer_no,
        field_name: 'freight_bill.status',
        old_value: existing.bill_status,
        new_value: 'CONFIRMED',
        change_source: 'MANUAL',
        operator: user?.username || 'system',
        change_time: now,
      });

      await allocateFreight(existing.transfer_no, user, trx);

      return await trx('freight_bills')
        .leftJoin('transfer_orders', 'freight_bills.transfer_no', 'transfer_orders.transfer_no')
        .select(
          'freight_bills.*',
          'transfer_orders.inbound_order_no',
          'transfer_orders.from_warehouse',
          'transfer_orders.to_warehouse'
        )
        .where('freight_bills.id', id)
        .first();
    });

    return c.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return c.json({ success: false, error: 'Freight bill not found' }, 404);
    if (err.message === 'NOT_PENDING') return c.json({ success: false, error: '只有待确认状态的账单可以确认' }, 400);
    return c.json({ success: false, error: `确认失败: ${err.message}` }, 400);
  }
});

freight.put('/:id/reconcile', async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');

  const existing = await db('freight_bills').where({ id }).first();
  if (!existing) {
    return c.json({ success: false, error: 'Freight bill not found' }, 404);
  }

  if (existing.bill_status !== 'CONFIRMED') {
    return c.json({ success: false, error: '只有已确认状态的账单可以对账' }, 400);
  }

  const now = new Date().toISOString();

  await db('freight_bills').where({ id }).update({
    bill_status: 'RECONCILED',
    update_time: now,
  });

  await db('transfer_orders')
    .where({ transfer_no: existing.transfer_no })
    .update({
      is_reconciled: true,
      update_time: now,
    });

  await db('change_logs').insert([
    {
      record_type: 'freight_bill',
      record_id: existing.id,
      transfer_no: existing.transfer_no,
      field_name: 'freight_bill.status',
      old_value: existing.bill_status,
      new_value: 'RECONCILED',
      change_source: 'MANUAL',
      operator: user?.username || 'unknown',
      change_time: now,
    },
    {
      record_type: 'freight_bill',
      record_id: existing.id,
      transfer_no: existing.transfer_no,
      field_name: 'transfer_order.is_reconciled',
      old_value: 'false',
      new_value: 'true',
      change_source: 'MANUAL',
      operator: user?.username || 'unknown',
      change_time: now,
    },
  ]);

  const updated = await db('freight_bills')
    .leftJoin('transfer_orders', 'freight_bills.transfer_no', 'transfer_orders.transfer_no')
    .select(
      'freight_bills.*',
      'transfer_orders.inbound_order_no',
      'transfer_orders.from_warehouse',
      'transfer_orders.to_warehouse'
    )
    .where('freight_bills.id', id)
    .first();

  return c.json({ success: true, data: updated });
});

export default freight;
