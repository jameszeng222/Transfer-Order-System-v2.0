import * as XLSX from 'xlsx';
import { db } from '../db/index.js';

const OUTBOUND_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  'SKU编码': 'sku_code',
  '实际出库数量': 'outbound_qty',
  '出库时间': 'outbound_time',
  '出库单号': 'outbound_order_no',
};

const INBOUND_RETURN_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  'SKU编码': 'sku_code',
  '实际入库数量': 'inbound_qty',
  '入库时间': 'inbound_time',
};

const LOGISTICS_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  '物流商': 'logistics_carrier',
  '物流单号': 'logistics_tracking_no',
  '提货时间': 'pickup_time',
  '离港时间': 'depart_time',
  '到港时间': 'arrive_port_time',
  '清关时间': 'clearance_time',
  '尾程提取时间': 'last_mile_pickup_time',
  '签收时间': 'delivery_time',
  '是否报关': 'is_customs_declared',
  '报关工厂': 'customs_factory',
  '是否查验': 'is_inspected',
  '尾程类型': 'last_mile_type',
  '尾程渠道': 'last_mile_channel',
};

const LOGISTICS_EVENT_TYPE_MAP: Record<string, string> = {
  '已发货': 'SHIPPED',
  '已到港口': 'ARRIVED_PORT',
  '清关中': 'CLEARING',
  '清关完成': 'CLEARED',
  '已提柜': 'PICKED_UP',
  '派送中': 'DELIVERING',
  '已签收': 'SIGNED',
  '异常': 'ABNORMAL',
};

const LOGISTICS_EVENT_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  '事件时间': 'event_time',
  '事件类型': 'event_type',
  '事件描述': 'event_desc',
  '位置': 'location',
};

const COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  'ERP单号': 'erp_order_no',
  '出库单号': 'outbound_order_no',
  '来源仓': 'from_warehouse',
  '目的仓': 'to_warehouse',
  '业务团队': 'team',
  '数据来源': 'source',
  '调拨类型': 'transfer_type',
  '运输类型': 'transport_type',
  '箱号': 'carton_no',
  '物流跟踪号': 'logistics_tracking_no',
  '物流商': 'logistics_carrier',
  'SKU编码': 'sku_code',
  'SKU名称': 'sku_name',
  '应调拨数量': 'expected_qty',
  '海外仓SKU': 'overseas_sku_code',
  '品名': 'product_name',
  '是否报关': 'is_customs_declared',
  '报关工厂': 'customs_factory',
  '是否查验': 'is_inspected',
  '时效要求(天)': 'timeline_requirement_days',
  '订单备注': 'order_remark',
  '尾程类型': 'last_mile_type',
  '尾程渠道': 'last_mile_channel',
  '预估单价': 'estimated_unit_price',
  '运费币种': 'freight_currency',
  '运费分摊方式': 'freight_allocation_method',
  '备注': 'remark',
};

const TRANSPORT_TYPE_MAP: Record<string, string> = {
  '海运': 'SEA',
  '空运': 'AIR',
  '铁路': 'RAIL',
  '卡航': 'TRUCK',
  '卡车': 'TRUCK',
};

const SOURCE_MAP: Record<string, string> = {
  '万邑通API': 'API_WANYITONG',
  '亚马逊': 'API_AMAZON',
  '手工创建': 'MANUAL',
  '其他': 'OTHER',
};

const TRANSFER_TYPE_MAP: Record<string, string> = {
  '国内→海外': 'DOMESTIC_TO_OVERSEAS',
  '海外→海外': 'OVERSEAS_TO_OVERSEAS',
  '退货返架': 'RETURN_TO_SHELF',
  'FBA出库': 'FBA_OUTBOUND',
};

const BOOLEAN_MAP: Record<string, boolean> = {
  '是': true,
  '否': false,
};

const REQUIRED_FIELDS = ['inbound_order_no', 'from_warehouse', 'to_warehouse', 'transport_type', 'carton_no', 'sku_code', 'expected_qty'];

const ORDER_LEVEL_FIELDS = [
  'erp_order_no', 'outbound_order_no', 'from_warehouse', 'to_warehouse',
  'team', 'source', 'transfer_type', 'transport_type',
  'logistics_tracking_no', 'logistics_carrier',
  'is_customs_declared', 'customs_factory', 'is_inspected',
  'timeline_requirement_days', 'order_remark',
  'last_mile_type', 'last_mile_channel',
  'estimated_unit_price', 'freight_currency', 'freight_allocation_method', 'remark',
];

interface RowError {
  row: number;
  message: string;
}

interface ParsedRow {
  _rowIndex: number;
  [key: string]: any;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: RowError[];
  createdOrders: number;
  updatedOrders: number;
}

function mapChineseValue(field: string, value: any): any {
  if (value === undefined || value === null || value === '') return undefined;

  if (field === 'transport_type' && typeof value === 'string') {
    return TRANSPORT_TYPE_MAP[value] || value;
  }
  if (field === 'source' && typeof value === 'string') {
    return SOURCE_MAP[value] || value;
  }
  if (field === 'transfer_type' && typeof value === 'string') {
    return TRANSFER_TYPE_MAP[value] || value;
  }
  if ((field === 'is_customs_declared' || field === 'is_inspected') && typeof value === 'string') {
    return BOOLEAN_MAP[value] ?? value;
  }
  if (field === 'expected_qty') {
    const num = Number(value);
    if (isNaN(num)) return value;
    return Math.round(num);
  }
  if (field === 'timeline_requirement_days') {
    const num = Number(value);
    if (isNaN(num)) return undefined;
    return Math.round(num);
  }
  if (field === 'estimated_unit_price') {
    const num = Number(value);
    if (isNaN(num)) return undefined;
    return num;
  }
  return value;
}

function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: any[][] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length < 2) return { headers: [], rows: [] };
  const headers = data[0].map((h: any) => String(h).trim());
  const rows = data.slice(1).filter((row) => row.some((cell) => cell !== '' && cell !== null && cell !== undefined));
  return { headers, rows };
}

function mapRows(headers: string[], rows: any[][]): ParsedRow[] {
  const fieldHeaders = headers.map((h) => COLUMN_MAP[h] || h);
  return rows.map((row, idx) => {
    const mapped: ParsedRow = { _rowIndex: idx + 2 };
    fieldHeaders.forEach((field, colIdx) => {
      if (field) {
        const raw = row[colIdx];
        mapped[field] = mapChineseValue(field, raw);
      }
    });
    return mapped;
  });
}

function validateRow(row: ParsedRow): string | null {
  for (const field of REQUIRED_FIELDS) {
    if (row[field] === undefined || row[field] === null || row[field] === '') {
      const cnName = Object.entries(COLUMN_MAP).find(([, v]) => v === field)?.[0] || field;
      return `必填字段缺失: ${cnName}`;
    }
  }
  if (row.expected_qty !== undefined && isNaN(Number(row.expected_qty))) {
    return '数量格式错误: 应调拨数量';
  }
  return null;
}

async function generateTransferNo(trx: any): Promise<string> {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
  const prefix = `TO-${dateStr}-`;

  const lastOrder = await trx('transfer_orders')
    .where('transfer_no', 'like', `${prefix}%`)
    .orderBy('transfer_no', 'desc')
    .first();

  let seq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.transfer_no.substring(prefix.length), 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function processOrderGroup(
  trx: any,
  inboundOrderNo: string,
  rows: ParsedRow[],
  operator: string,
): Promise<'created' | 'updated'> {
  const firstRow = rows[0];
  const existingOrder = await trx('transfer_orders')
    .where({ inbound_order_no: inboundOrderNo })
    .first();

  if (existingOrder) {
    await trx('transfer_carton_items').where({ inbound_order_no: inboundOrderNo }).del();
    await trx('transfer_cartons').where({ inbound_order_no: inboundOrderNo }).del();
    await trx('transfer_order_items').where({ inbound_order_no: inboundOrderNo }).del();

    const orderData: Record<string, any> = { update_time: new Date().toISOString() };
    for (const field of ORDER_LEVEL_FIELDS) {
      if (firstRow[field] !== undefined && firstRow[field] !== null && firstRow[field] !== '') {
        orderData[field] = firstRow[field];
      }
    }
    await trx('transfer_orders').where({ id: existingOrder.id }).update(orderData);

    await createSubRecords(trx, existingOrder.transfer_no, inboundOrderNo, rows);

    await trx('change_logs').insert({
      record_type: 'transfer_order',
      record_id: existingOrder.id,
      transfer_no: existingOrder.transfer_no,
      field_name: 'IMPORT_OVERWRITE',
      old_value: '',
      new_value: `${rows.length} rows`,
      change_source: 'IMPORT',
      operator,
      reason: '导入覆盖更新',
    });

    return 'updated';
  } else {
    const transferNo = await generateTransferNo(trx);

    const orderData: Record<string, any> = {
      transfer_no: transferNo,
      inbound_order_no: inboundOrderNo,
      status: 'PENDING_OUTBOUND',
      total_sku_count: 0,
      total_qty: 0,
      total_carton_count: 0,
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
    };
    for (const field of ORDER_LEVEL_FIELDS) {
      if (firstRow[field] !== undefined && firstRow[field] !== null && firstRow[field] !== '') {
        orderData[field] = firstRow[field];
      }
    }
    const [inserted] = await trx('transfer_orders').insert(orderData).returning('*');

    await createSubRecords(trx, transferNo, inboundOrderNo, rows);

    const skuSet = new Set(rows.map((r) => r.sku_code));
    const cartonSet = new Set(rows.map((r) => r.carton_no));
    const totalQty = rows.reduce((sum, r) => sum + (Number(r.expected_qty) || 0), 0);

    await trx('transfer_orders').where({ id: inserted.id }).update({
      total_sku_count: skuSet.size,
      total_qty: totalQty,
      total_carton_count: cartonSet.size,
      update_time: new Date().toISOString(),
    });

    await trx('change_logs').insert({
      record_type: 'transfer_order',
      record_id: inserted.id,
      transfer_no: transferNo,
      field_name: 'IMPORT_CREATE',
      old_value: '',
      new_value: `${rows.length} rows`,
      change_source: 'IMPORT',
      operator,
      reason: '导入创建',
    });

    return 'created';
  }
}

async function createSubRecords(
  trx: any,
  transferNo: string,
  inboundOrderNo: string,
  rows: ParsedRow[],
): Promise<void> {
  const cartonGroups: Record<string, ParsedRow[]> = {};
  for (const row of rows) {
    const key = row.carton_no;
    if (!cartonGroups[key]) cartonGroups[key] = [];
    cartonGroups[key].push(row);
  }

  for (const [cartonNo, cartonRows] of Object.entries(cartonGroups)) {
    const firstCartonRow = cartonRows[0];
    await trx('transfer_cartons').insert({
      transfer_no: transferNo,
      inbound_order_no: inboundOrderNo,
      carton_no: cartonNo,
      logistics_tracking_no: firstCartonRow.logistics_tracking_no || null,
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
    });

    for (const row of cartonRows) {
      await trx('transfer_carton_items').insert({
        carton_no: cartonNo,
        transfer_no: transferNo,
        inbound_order_no: inboundOrderNo,
        sku_code: row.sku_code,
        sku_name: row.sku_name || null,
        overseas_sku_code: row.overseas_sku_code || null,
        product_name: row.product_name || null,
        qty: Number(row.expected_qty) || 0,
      });
    }
  }

  const skuGroups: Record<string, ParsedRow[]> = {};
  for (const row of rows) {
    const key = row.sku_code;
    if (!skuGroups[key]) skuGroups[key] = [];
    skuGroups[key].push(row);
  }

  for (const [skuCode, skuRows] of Object.entries(skuGroups)) {
    const totalExpectedQty = skuRows.reduce((sum, r) => sum + (Number(r.expected_qty) || 0), 0);
    const firstSkuRow = skuRows[0];
    await trx('transfer_order_items').insert({
      transfer_no: transferNo,
      inbound_order_no: inboundOrderNo,
      sku_code: skuCode,
      sku_name: firstSkuRow.sku_name || null,
      expected_qty: totalExpectedQty,
      outbound_qty: 0,
      inbound_qty: 0,
      shelf_qty: 0,
    });
  }

  if (await trx('transfer_orders').where({ transfer_no: transferNo }).first()) {
    const skuSet = new Set(rows.map((r) => r.sku_code));
    const cartonSet = new Set(rows.map((r) => r.carton_no));
    const totalQty = rows.reduce((sum, r) => sum + (Number(r.expected_qty) || 0), 0);

    await trx('transfer_orders').where({ transfer_no: transferNo }).update({
      total_sku_count: skuSet.size,
      total_qty: totalQty,
      total_carton_count: cartonSet.size,
      update_time: new Date().toISOString(),
    });
  }
}

export async function importExcel(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);

  if (headers.length === 0 || rows.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }],
      createdOrders: 0,
      updatedOrders: 0,
    };
  }

  const parsedRows = mapRows(headers, rows);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    const err = validateRow(row);
    if (err) {
      errors.push({ row: row._rowIndex, message: err });
    } else {
      validRows.push(row);
    }
  }

  const orderGroups: Record<string, ParsedRow[]> = {};
  for (const row of validRows) {
    const key = row.inbound_order_no;
    if (!orderGroups[key]) orderGroups[key] = [];
    orderGroups[key].push(row);
  }

  let createdOrders = 0;
  let updatedOrders = 0;
  const orderErrors: RowError[] = [];

  await db.transaction(async (trx) => {
    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const result = await processOrderGroup(trx, inboundOrderNo, groupRows, operator);
        if (result === 'created') createdOrders++;
        else updatedOrders++;
      } catch (err: any) {
        for (const row of groupRows) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 导入失败: ${err.message}` });
        }
      }
    }
  });

  const allErrors = [...errors, ...orderErrors];
  const successCount = validRows.length - orderErrors.reduce((sum, e) => {
    const row = validRows.find((r) => r._rowIndex === e.row);
    return row ? sum + 1 : sum;
  }, 0);

  return {
    total: parsedRows.length,
    success: successCount,
    failed: allErrors.length,
    errors: allErrors,
    createdOrders,
    updatedOrders,
  };
}

function parseExcelDate(value: any): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
      return d.toISOString();
    }
    return undefined;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function mapRowsWithColumnMap(headers: string[], rows: any[][], columnMap: Record<string, string>): ParsedRow[] {
  const fieldHeaders = headers.map((h) => columnMap[h] || h);
  return rows.map((row, idx) => {
    const mapped: ParsedRow = { _rowIndex: idx + 2 };
    fieldHeaders.forEach((field, colIdx) => {
      if (field) {
        mapped[field] = row[colIdx];
      }
    });
    return mapped;
  });
}

export async function importOutboundReturn(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);
  if (headers.length === 0 || rows.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }], createdOrders: 0, updatedOrders: 0 };
  }

  const parsedRows = mapRowsWithColumnMap(headers, rows, OUTBOUND_COLUMN_MAP);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    if (!row.inbound_order_no || !row.sku_code || row.outbound_qty === undefined || row.outbound_qty === '') {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号/SKU编码/实际出库数量' });
    } else if (isNaN(Number(row.outbound_qty))) {
      errors.push({ row: row._rowIndex, message: '数量格式错误: 实际出库数量' });
    } else {
      row.outbound_qty = Math.round(Number(row.outbound_qty));
      validRows.push(row);
    }
  }

  const orderGroups: Record<string, ParsedRow[]> = {};
  for (const row of validRows) {
    const key = String(row.inbound_order_no);
    if (!orderGroups[key]) orderGroups[key] = [];
    orderGroups[key].push(row);
  }

  let updatedOrders = 0;
  const orderErrors: RowError[] = [];

  await db.transaction(async (trx) => {
    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const order = await trx('transfer_orders').where({ inbound_order_no: inboundOrderNo }).first();
        if (!order) {
          for (const row of groupRows) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 未找到对应调拨单` });
          }
          continue;
        }

        const orderUpdates: Record<string, any> = { update_time: new Date().toISOString() };
        if (groupRows[0].outbound_order_no) {
          orderUpdates.outbound_order_no = String(groupRows[0].outbound_order_no);
        }

        let hasOutboundQty = false;
        for (const row of groupRows) {
          const item = await trx('transfer_order_items')
            .where({ transfer_no: order.transfer_no, sku_code: String(row.sku_code) })
            .first();
          if (!item) {
            orderErrors.push({ row: row._rowIndex, message: `SKU ${row.sku_code} 在调拨单 ${order.transfer_no} 中不存在` });
            continue;
          }

          const outboundQty = row.outbound_qty;
          const outboundDiff = outboundQty - item.expected_qty;

          await trx('transfer_order_items').where({ id: item.id }).update({
            outbound_qty: outboundQty,
            outbound_diff: outboundDiff,
          });

          if (outboundQty > 0) hasOutboundQty = true;

          if (outboundDiff !== 0) {
            await trx('discrepancy_records').insert({
              transfer_no: order.transfer_no,
              sku_code: String(row.sku_code),
              discrepancy_category: 'QUANTITY_DIFF',
              discrepancy_type: outboundDiff < 0 ? 'SHORT_SHIPMENT' : 'OVER_SHIPMENT',
              discrepancy_qty: Math.abs(outboundDiff),
              status: 'PENDING',
              create_time: new Date().toISOString(),
              update_time: new Date().toISOString(),
            });
          }
        }

        if (hasOutboundQty && order.status === 'PENDING_OUTBOUND') {
          orderUpdates.status = 'OUTBOUNDED';
          if (!order.pickup_time && groupRows[0].outbound_time) {
            orderUpdates.pickup_time = parseExcelDate(groupRows[0].outbound_time) || new Date().toISOString();
          }
        }

        await trx('transfer_orders').where({ id: order.id }).update(orderUpdates);

        await trx('change_logs').insert({
          record_type: 'transfer_order',
          record_id: order.id,
          transfer_no: order.transfer_no,
          field_name: 'IMPORT_OUTBOUND',
          old_value: '',
          new_value: `${groupRows.length} rows`,
          change_source: 'IMPORT',
          operator,
          reason: '出库回传导入',
        });

        updatedOrders++;
      } catch (err: any) {
        for (const row of groupRows) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 出库回传失败: ${err.message}` });
        }
      }
    }
  });

  const allErrors = [...errors, ...orderErrors];
  const successCount = validRows.length - orderErrors.length;

  return {
    total: parsedRows.length,
    success: successCount,
    failed: allErrors.length,
    errors: allErrors,
    createdOrders: 0,
    updatedOrders,
  };
}

export async function importInboundReturn(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);
  if (headers.length === 0 || rows.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }], createdOrders: 0, updatedOrders: 0 };
  }

  const parsedRows = mapRowsWithColumnMap(headers, rows, INBOUND_RETURN_COLUMN_MAP);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    if (!row.inbound_order_no || !row.sku_code || row.inbound_qty === undefined || row.inbound_qty === '') {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号/SKU编码/实际入库数量' });
    } else if (isNaN(Number(row.inbound_qty))) {
      errors.push({ row: row._rowIndex, message: '数量格式错误: 实际入库数量' });
    } else {
      row.inbound_qty = Math.round(Number(row.inbound_qty));
      validRows.push(row);
    }
  }

  const orderGroups: Record<string, ParsedRow[]> = {};
  for (const row of validRows) {
    const key = String(row.inbound_order_no);
    if (!orderGroups[key]) orderGroups[key] = [];
    orderGroups[key].push(row);
  }

  let updatedOrders = 0;
  const orderErrors: RowError[] = [];

  await db.transaction(async (trx) => {
    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const order = await trx('transfer_orders').where({ inbound_order_no: inboundOrderNo }).first();
        if (!order) {
          for (const row of groupRows) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 未找到对应调拨单` });
          }
          continue;
        }

        const orderUpdates: Record<string, any> = { update_time: new Date().toISOString() };
        let hasInboundQty = false;

        for (const row of groupRows) {
          const item = await trx('transfer_order_items')
            .where({ transfer_no: order.transfer_no, sku_code: String(row.sku_code) })
            .first();
          if (!item) {
            orderErrors.push({ row: row._rowIndex, message: `SKU ${row.sku_code} 在调拨单 ${order.transfer_no} 中不存在` });
            continue;
          }

          const inboundQty = row.inbound_qty;
          const inboundDiff = inboundQty - (item.outbound_qty || 0);
          const totalDiff = inboundQty - item.expected_qty;

          await trx('transfer_order_items').where({ id: item.id }).update({
            inbound_qty: inboundQty,
            inbound_diff: inboundDiff,
            total_diff: totalDiff,
          });

          if (inboundQty > 0) hasInboundQty = true;

          if (totalDiff !== 0) {
            await trx('discrepancy_records').insert({
              transfer_no: order.transfer_no,
              sku_code: String(row.sku_code),
              discrepancy_category: 'QUANTITY_DIFF',
              discrepancy_type: totalDiff < 0 ? 'SHORT_SHIPMENT' : 'OVER_SHIPMENT',
              discrepancy_qty: Math.abs(totalDiff),
              status: 'PENDING',
              create_time: new Date().toISOString(),
              update_time: new Date().toISOString(),
            });
          }
        }

        if (hasInboundQty && order.status === 'IN_TRANSIT') {
          orderUpdates.status = 'RECEIVED';
          orderUpdates.delivery_time = new Date().toISOString();
        }

        await trx('transfer_orders').where({ id: order.id }).update(orderUpdates);

        await trx('change_logs').insert({
          record_type: 'transfer_order',
          record_id: order.id,
          transfer_no: order.transfer_no,
          field_name: 'IMPORT_INBOUND',
          old_value: '',
          new_value: `${groupRows.length} rows`,
          change_source: 'IMPORT',
          operator,
          reason: '入库回传导入',
        });

        updatedOrders++;
      } catch (err: any) {
        for (const row of groupRows) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 入库回传失败: ${err.message}` });
        }
      }
    }
  });

  const allErrors = [...errors, ...orderErrors];
  const successCount = validRows.length - orderErrors.length;

  return {
    total: parsedRows.length,
    success: successCount,
    failed: allErrors.length,
    errors: allErrors,
    createdOrders: 0,
    updatedOrders,
  };
}

export async function importLogisticsInfo(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);
  if (headers.length === 0 || rows.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }], createdOrders: 0, updatedOrders: 0 };
  }

  const parsedRows = mapRowsWithColumnMap(headers, rows, LOGISTICS_COLUMN_MAP);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    if (!row.inbound_order_no) {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号' });
    } else {
      validRows.push(row);
    }
  }

  const orderGroups: Record<string, ParsedRow[]> = {};
  for (const row of validRows) {
    const key = String(row.inbound_order_no);
    if (!orderGroups[key]) orderGroups[key] = [];
    orderGroups[key].push(row);
  }

  let updatedOrders = 0;
  const orderErrors: RowError[] = [];

  const LOGISTICS_FIELDS = [
    'logistics_carrier', 'logistics_tracking_no',
    'pickup_time', 'depart_time', 'arrive_port_time', 'clearance_time',
    'last_mile_pickup_time', 'delivery_time',
    'is_customs_declared', 'customs_factory', 'is_inspected',
    'last_mile_type', 'last_mile_channel',
  ];

  await db.transaction(async (trx) => {
    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const order = await trx('transfer_orders').where({ inbound_order_no: inboundOrderNo }).first();
        if (!order) {
          for (const row of groupRows) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 未找到对应调拨单` });
          }
          continue;
        }

        const firstRow = groupRows[0];
        const orderUpdates: Record<string, any> = { update_time: new Date().toISOString() };

        for (const field of LOGISTICS_FIELDS) {
          if (firstRow[field] !== undefined && firstRow[field] !== null && firstRow[field] !== '') {
            if (field === 'is_customs_declared' || field === 'is_inspected') {
              orderUpdates[field] = BOOLEAN_MAP[String(firstRow[field])] ?? firstRow[field];
            } else if (field.endsWith('_time')) {
              const parsed = parseExcelDate(firstRow[field]);
              if (parsed) orderUpdates[field] = parsed;
            } else {
              orderUpdates[field] = firstRow[field];
            }
          }
        }

        if (order.status === 'OUTBOUNDED' && orderUpdates.pickup_time) {
          orderUpdates.status = 'IN_TRANSIT';
        }
        if (order.status === 'IN_TRANSIT' && orderUpdates.delivery_time) {
          orderUpdates.status = 'RECEIVED';
        }

        await trx('transfer_orders').where({ id: order.id }).update(orderUpdates);

        await trx('change_logs').insert({
          record_type: 'transfer_order',
          record_id: order.id,
          transfer_no: order.transfer_no,
          field_name: 'IMPORT_LOGISTICS',
          old_value: '',
          new_value: `${groupRows.length} rows`,
          change_source: 'IMPORT',
          operator,
          reason: '物流信息导入',
        });

        updatedOrders++;
      } catch (err: any) {
        for (const row of groupRows) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 物流信息导入失败: ${err.message}` });
        }
      }
    }
  });

  const allErrors = [...errors, ...orderErrors];
  const successCount = validRows.length - orderErrors.length;

  return {
    total: parsedRows.length,
    success: successCount,
    failed: allErrors.length,
    errors: allErrors,
    createdOrders: 0,
    updatedOrders,
  };
}

export async function importLogisticsEvents(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);
  if (headers.length === 0 || rows.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }], createdOrders: 0, updatedOrders: 0 };
  }

  const parsedRows = mapRowsWithColumnMap(headers, rows, LOGISTICS_EVENT_COLUMN_MAP);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    if (!row.inbound_order_no || !row.event_time || !row.event_type) {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号/事件时间/事件类型' });
    } else {
      if (typeof row.event_type === 'string' && LOGISTICS_EVENT_TYPE_MAP[row.event_type]) {
        row.event_type = LOGISTICS_EVENT_TYPE_MAP[row.event_type];
      }
      validRows.push(row);
    }
  }

  const orderGroups: Record<string, ParsedRow[]> = {};
  for (const row of validRows) {
    const key = String(row.inbound_order_no);
    if (!orderGroups[key]) orderGroups[key] = [];
    orderGroups[key].push(row);
  }

  let updatedOrders = 0;
  const orderErrors: RowError[] = [];

  await db.transaction(async (trx) => {
    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const order = await trx('transfer_orders').where({ inbound_order_no: inboundOrderNo }).first();
        if (!order) {
          for (const row of groupRows) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 未找到对应调拨单` });
          }
          continue;
        }

        for (const row of groupRows) {
          const eventTime = parseExcelDate(row.event_time) || new Date().toISOString();
          await trx('tracking_events').insert({
            transfer_no: order.transfer_no,
            event_time: eventTime,
            event_type: row.event_type,
            event_desc: row.event_desc || null,
            location: row.location || null,
            operator,
            create_time: new Date().toISOString(),
          });
        }

        await trx('transfer_orders').where({ id: order.id }).update({
          update_time: new Date().toISOString(),
        });

        await trx('change_logs').insert({
          record_type: 'transfer_order',
          record_id: order.id,
          transfer_no: order.transfer_no,
          field_name: 'IMPORT_LOGISTICS_EVENTS',
          old_value: '',
          new_value: `${groupRows.length} events`,
          change_source: 'IMPORT',
          operator,
          reason: '物流事件导入',
        });

        updatedOrders++;
      } catch (err: any) {
        for (const row of groupRows) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 物流事件导入失败: ${err.message}` });
        }
      }
    }
  });

  const allErrors = [...errors, ...orderErrors];
  const successCount = validRows.length - orderErrors.length;

  return {
    total: parsedRows.length,
    success: successCount,
    failed: allErrors.length,
    errors: allErrors,
    createdOrders: 0,
    updatedOrders,
  };
}

export function generateTemplate(type: string): ArrayBuffer {
  const headersByType: Record<string, string[]> = {
    main: [
      '第三方入库单号', 'ERP单号', '出库单号', '来源仓', '目的仓', '业务团队',
      '数据来源', '调拨类型', '运输类型', '箱号', '物流跟踪号', '物流商',
      'SKU编码', 'SKU名称', '应调拨数量', '海外仓SKU', '品名',
      '是否报关', '报关工厂', '是否查验', '时效要求(天)', '订单备注',
      '尾程类型', '尾程渠道', '预估单价', '运费币种', '运费分摊方式', '备注',
    ],
    outbound: [
      '第三方入库单号', 'SKU编码', '实际出库数量', '出库时间', '出库单号',
    ],
    logistics: [
      '第三方入库单号', '物流商', '物流单号', '提货时间', '离港时间',
      '到港时间', '清关时间', '尾程提取时间', '签收时间',
      '是否报关', '报关工厂', '是否查验', '尾程类型', '尾程渠道',
    ],
    inbound: [
      '第三方入库单号', 'SKU编码', '实际入库数量', '入库时间',
    ],
    'logistics-events': [
      '第三方入库单号', '事件时间', '事件类型', '事件描述', '位置',
    ],
  };

  const headers = headersByType[type] || headersByType['main'];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '导入模板');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
