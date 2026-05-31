import * as XLSX from 'xlsx';
import { db } from '../db/index.js';

const COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  '调拨单号': 'transfer_no_import',
  '出库单号': 'outbound_order_no',
  '创建时间': 'create_time',
  '发货仓库': 'from_warehouse',
  '目标仓库': 'to_warehouse',
  '团队': 'team',
  '包装ID': 'carton_no_hermes',
  'SKU': 'sku_code',
  '产品名称': 'sku_name',
  '海外仓SKU': 'overseas_sku_code',
  '计划数量': 'expected_qty',
  '实发数量': 'outbound_qty',
  '时效要求': 'timeline_requirement_days',
  '物流商': 'logistics_carrier',
  '运输类型': 'transport_type',
  '提货时间': 'pickup_time',
  '是否报关': 'is_customs_declared',
  '报关工厂': 'customs_factory',
  '申报货值': 'declared_value',
  '备注': 'remark',
};

const INBOUND_RETURN_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  '箱号': 'carton_no',
  'SKU': 'sku_code',
  '实际入库数量': 'inbound_qty',
  '入库时间': 'inbound_time',
  '上架数量': 'shelf_qty',
  '上架异常': 'is_shelf_abnormal',
  '上架异常类型': 'shelf_abnormal_type',
  '上架异常备注': 'shelf_abnormal_remark',
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

const LOGISTICS_MERGED_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  '物流商': 'logistics_carrier',
  '物流单号': 'logistics_tracking_no',
  '发货时间': 'pickup_time',
  '离港时间': 'departure_time',
  '到港时间': 'arrival_port_time',
  '清关时间': 'customs_clearance_time',
  '尾程提取时间': 'last_mile_pickup_time',
  '签收时间': 'logistics_sign_time',
  '卸货时间': 'unload_time',
  '上架时间': 'shelf_time',
  '是否报关': 'is_customs_declared',
  '报关工厂': 'customs_factory',
  '是否查验': 'is_inspected',
  '尾程渠道': 'last_mile_channel',
  '事件时间': 'event_time',
  '事件类型': 'event_type',
  '事件描述': 'event_desc',
  '位置': 'location',
  '箱号': 'carton_no',
  '长': 'carton_length',
  '宽': 'carton_width',
  '高': 'carton_height',
  '实重': 'carton_weight',
  '申报货值': 'declared_value',
};

const CARTON_TIME_MAP: Record<string, string> = {
  departure_time: 'departure_time',
  arrival_port_time: 'arrival_port_time',
  customs_clearance_time: 'customs_clearance_time',
  last_mile_pickup_time: 'last_mile_pickup_time',
  logistics_sign_time: 'logistics_sign_time',
  unload_time: 'unload_time',
  shelf_time: 'shelf_time',
};

const CARTON_LIST_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  'SKU': 'sku_code',
  '海外仓SKU': 'overseas_sku_code',
  '箱号': 'carton_no',
  '实发数量': 'outbound_qty',
  '总箱数': 'total_carton_count',
  '长': 'carton_length',
  '宽': 'carton_width',
  '高': 'carton_height',
  '仓库实重': 'carton_weight',
  '渠道实重': 'channel_weight',
  '单价': 'estimated_unit_price',
};

const FREIGHT_COLUMN_MAP: Record<string, string> = {
  '第三方入库单号': 'inbound_order_no',
  '物流商': 'logistics_carrier',
  '运费': 'freight_fee',
  '报关费': 'customs_fee',
  '其他费用': 'other_fee',
  '币种': 'currency',
  '汇率': 'exchange_rate',
  '账单日期': 'bill_date',
  '备注': 'remark',
};

const TRANSPORT_TYPE_MAP: Record<string, string> = {
  '海运': 'SEA',
  '空运': 'AIR',
  '铁路': 'RAIL',
  '卡航': 'TRUCK',
  '卡车': 'TRUCK',
  '快递': 'EXPRESS',
  '快船': 'FAST_SEA',
  '专线': 'SPECIAL',
};

const BOOLEAN_MAP: Record<string, boolean> = {
  '是': true,
  '否': false,
};

const ORDER_LEVEL_FIELDS = [
  'outbound_order_no', 'from_warehouse', 'to_warehouse', 'team',
  'is_customs_declared', 'customs_factory', 'timeline_requirement_days',
  'transport_type', 'logistics_carrier', 'pickup_time',
  'remark', 'create_time',
];

const CARTON_LEVEL_FIELDS = [
  'declared_value',
];

interface RowError {
  row: number;
  message: string;
  inbound_order_no?: string;
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

function hasValue(v: any): boolean {
  return v !== undefined && v !== null && v !== '';
}

function mapChineseValue(field: string, value: any): any {
  if (!hasValue(value)) return undefined;

  if (field === 'transport_type' && typeof value === 'string') {
    return TRANSPORT_TYPE_MAP[value] || value;
  }
  if (field === 'is_customs_declared' && typeof value === 'string') {
    return BOOLEAN_MAP[value] ?? value;
  }
  if (field === 'expected_qty' || field === 'outbound_qty') {
    const num = Number(value);
    if (isNaN(num)) return value;
    return Math.round(num);
  }
  if (field === 'timeline_requirement_days') {
    const num = Number(value);
    if (isNaN(num)) return undefined;
    return Math.round(num);
  }
  if (
    field === 'carton_length' || field === 'carton_width' || field === 'carton_height' ||
    field === 'declared_value'
  ) {
    const num = Number(value);
    if (isNaN(num)) return undefined;
    return num;
  }
  if (field === 'create_time' || field === 'pickup_time') {
    return parseExcelDate(value);
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

async function batchInsert(trx: any, tableName: string, records: any[], batchSize = 500): Promise<void> {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    if (batch.length > 0) {
      await trx(tableName).insert(batch);
    }
  }
}

async function batchUpdateGrouped(trx: any, tableName: string, updates: { id: number; data: Record<string, any> }[]): Promise<void> {
  const groups = new Map<string, { data: Record<string, any>; ids: number[] }>();
  for (const u of updates) {
    const key = JSON.stringify(u.data);
    if (!groups.has(key)) groups.set(key, { data: u.data, ids: [] });
    groups.get(key)!.ids.push(u.id);
  }
  for (const [, group] of groups) {
    await trx(tableName).whereIn('id', group.ids).update(group.data);
  }
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
    const orderData: Record<string, any> = { update_time: new Date().toISOString() };
    for (const field of ORDER_LEVEL_FIELDS) {
      if (hasValue(firstRow[field])) {
        orderData[field] = firstRow[field];
      }
    }

    if (hasValue(orderData.pickup_time)) {
      orderData.status = 'IN_TRANSIT';
    } else if ('pickup_time' in firstRow && !hasValue(firstRow.pickup_time)) {
      if (existingOrder.status === 'PENDING_OUTBOUND') {
        orderData.status = 'OUTBOUNDED';
      }
    }

    await trx('transfer_orders').where({ id: existingOrder.id }).update(orderData);

    await mergeSubRecords(trx, existingOrder.transfer_no, inboundOrderNo, rows);

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
    const transferNo = hasValue(firstRow.transfer_no_import)
      ? String(firstRow.transfer_no_import)
      : await generateTransferNo(trx);

    const orderData: Record<string, any> = {
      transfer_no: transferNo,
      inbound_order_no: inboundOrderNo,
      status: 'PENDING_OUTBOUND',
      total_sku_count: 0,
      total_qty: 0,
      total_carton_count: 0,
      create_time: firstRow.create_time || new Date().toISOString(),
      update_time: new Date().toISOString(),
    };
    for (const field of ORDER_LEVEL_FIELDS) {
      if (field === 'create_time') continue;
      if (hasValue(firstRow[field])) {
        orderData[field] = firstRow[field];
      }
    }
    if (hasValue(orderData.pickup_time)) {
      orderData.status = 'IN_TRANSIT';
    } else if ('pickup_time' in firstRow) {
      orderData.status = 'OUTBOUNDED';
    } else {
      orderData.status = 'PENDING_OUTBOUND';
    }
    const [inserted] = await trx('transfer_orders').insert(orderData).returning('*');

    await createSubRecords(trx, transferNo, inboundOrderNo, rows);

    await recalcOrderStats(trx, transferNo);

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

async function recalcOrderStats(trx: any, transferNo: string): Promise<void> {
  const allCartons = await trx('transfer_cartons').where({ transfer_no: transferNo });
  const allItems = await trx('transfer_order_items').where({ transfer_no: transferNo });
  const totalQty = allItems.reduce((sum: number, item: any) => sum + (Number(item.expected_qty) || 0), 0);
  const skuSet = new Set(allItems.map((i: any) => i.sku_code));

  await trx('transfer_orders').where({ transfer_no: transferNo }).update({
    total_sku_count: skuSet.size,
    total_qty: totalQty,
    total_carton_count: allCartons.length,
    update_time: new Date().toISOString(),
  });
}

async function createSubRecords(
  trx: any,
  transferNo: string,
  inboundOrderNo: string,
  rows: ParsedRow[],
): Promise<void> {
  const rowsWithCarton = rows.filter((r) => hasValue(r.carton_no));
  const rowsWithSku = rows.filter((r) => hasValue(r.sku_code));

  const cartonGroups: Record<string, ParsedRow[]> = {};
  for (const row of rowsWithCarton) {
    const key = String(row.carton_no);
    if (!cartonGroups[key]) cartonGroups[key] = [];
    cartonGroups[key].push(row);
  }

  const allCartons: any[] = [];
  const allCartonItems: any[] = [];

  for (const [cartonNo, cartonRows] of Object.entries(cartonGroups)) {
    const firstCartonRow = cartonRows[0];
    const cartonData: Record<string, any> = {
      transfer_no: transferNo,
      inbound_order_no: inboundOrderNo,
      carton_no: cartonNo,
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
    };
    for (const field of CARTON_LEVEL_FIELDS) {
      if (hasValue(firstCartonRow[field])) {
        cartonData[field] = firstCartonRow[field];
      }
    }
    if (hasValue(firstCartonRow.logistics_tracking_no)) {
      cartonData.logistics_tracking_no = firstCartonRow.logistics_tracking_no;
    }
    allCartons.push(cartonData);

    for (const row of cartonRows) {
      if (!hasValue(row.sku_code)) continue;
      allCartonItems.push({
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

  await batchInsert(trx, 'transfer_cartons', allCartons);
  await batchInsert(trx, 'transfer_carton_items', allCartonItems);

  const skuGroups: Record<string, ParsedRow[]> = {};
  for (const row of rowsWithSku) {
    const key = String(row.sku_code);
    if (!skuGroups[key]) skuGroups[key] = [];
    skuGroups[key].push(row);
  }

  const allOrderItems: any[] = [];
  for (const [skuCode, skuRows] of Object.entries(skuGroups)) {
    const totalExpectedQty = skuRows.reduce((sum, r) => sum + (Number(r.expected_qty) || 0), 0);
    const totalOutboundQty = skuRows.reduce((sum, r) => sum + (Number(r.outbound_qty) || 0), 0);
    const firstSkuRow = skuRows[0];
    allOrderItems.push({
      transfer_no: transferNo,
      inbound_order_no: inboundOrderNo,
      sku_code: skuCode,
      sku_name: firstSkuRow.sku_name || null,
      overseas_sku_code: firstSkuRow.overseas_sku_code || null,
      expected_qty: totalExpectedQty,
      outbound_qty: totalOutboundQty,
      inbound_qty: 0,
      shelf_qty: 0,
    });
  }
  await batchInsert(trx, 'transfer_order_items', allOrderItems);
}

async function mergeSubRecords(
  trx: any,
  transferNo: string,
  inboundOrderNo: string,
  rows: ParsedRow[],
): Promise<void> {
  const rowsWithCarton = rows.filter((r) => hasValue(r.carton_no));
  const rowsWithSku = rows.filter((r) => hasValue(r.sku_code));

  const cartonGroups: Record<string, ParsedRow[]> = {};
  for (const row of rowsWithCarton) {
    const key = String(row.carton_no);
    if (!cartonGroups[key]) cartonGroups[key] = [];
    cartonGroups[key].push(row);
  }

  const cartonNos = Object.keys(cartonGroups);
  const existingCartons = cartonNos.length > 0
    ? await trx('transfer_cartons').where({ transfer_no: transferNo }).whereIn('carton_no', cartonNos)
    : [];
  const existingCartonMap: Map<string, any> = new Map(existingCartons.map((c: any) => [c.carton_no, c]));

  const newCartons: any[] = [];
  const cartonUpdateList: { id: number; data: Record<string, any> }[] = [];
  const allCartonItems: any[] = [];

  for (const [cartonNo, cartonRows] of Object.entries(cartonGroups)) {
    const firstCartonRow = cartonRows[0];
    const existingCarton = existingCartonMap.get(cartonNo);

    if (existingCarton) {
      const cartonUpdates: Record<string, any> = { update_time: new Date().toISOString() };
      for (const field of CARTON_LEVEL_FIELDS) {
        if (hasValue(firstCartonRow[field])) {
          cartonUpdates[field] = firstCartonRow[field];
        }
      }
      if (hasValue(firstCartonRow.logistics_tracking_no)) {
        cartonUpdates.logistics_tracking_no = firstCartonRow.logistics_tracking_no;
      }
      if (Object.keys(cartonUpdates).length > 1) {
        cartonUpdateList.push({ id: existingCarton.id, data: cartonUpdates });
      }
    } else {
      const cartonData: Record<string, any> = {
        transfer_no: transferNo,
        inbound_order_no: inboundOrderNo,
        carton_no: cartonNo,
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
      };
      for (const field of CARTON_LEVEL_FIELDS) {
        if (hasValue(firstCartonRow[field])) {
          cartonData[field] = firstCartonRow[field];
        }
      }
      if (hasValue(firstCartonRow.logistics_tracking_no)) {
        cartonData.logistics_tracking_no = firstCartonRow.logistics_tracking_no;
      }
      newCartons.push(cartonData);
    }

    for (const row of cartonRows) {
      if (!hasValue(row.sku_code)) continue;
      allCartonItems.push({
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

  if (cartonNos.length > 0) {
    await trx('transfer_carton_items')
      .where({ transfer_no: transferNo })
      .whereIn('carton_no', cartonNos)
      .del();
  }

  await batchInsert(trx, 'transfer_cartons', newCartons);
  await batchUpdateGrouped(trx, 'transfer_cartons', cartonUpdateList);
  await batchInsert(trx, 'transfer_carton_items', allCartonItems);

  const skuGroups: Record<string, ParsedRow[]> = {};
  for (const row of rowsWithSku) {
    const key = String(row.sku_code);
    if (!skuGroups[key]) skuGroups[key] = [];
    skuGroups[key].push(row);
  }

  const skuCodes = Object.keys(skuGroups);
  const existingItems = skuCodes.length > 0
    ? await trx('transfer_order_items').where({ transfer_no: transferNo }).whereIn('sku_code', skuCodes)
    : [];
  const existingItemMap: Map<string, any> = new Map(existingItems.map((i: any) => [i.sku_code, i]));

  const newOrderItems: any[] = [];
  const itemUpdateList: { id: number; data: Record<string, any> }[] = [];

  for (const [skuCode, skuRows] of Object.entries(skuGroups)) {
    const totalExpectedQty = skuRows.reduce((sum, r) => sum + (Number(r.expected_qty) || 0), 0);
    const totalOutboundQty = skuRows.reduce((sum, r) => sum + (Number(r.outbound_qty) || 0), 0);
    const firstSkuRow = skuRows[0];
    const existingItem = existingItemMap.get(skuCode);

    if (existingItem) {
      const itemUpdates: Record<string, any> = {};
      if (hasValue(firstSkuRow.sku_name)) {
        itemUpdates.sku_name = firstSkuRow.sku_name;
      }
      if (hasValue(firstSkuRow.overseas_sku_code)) {
        itemUpdates.overseas_sku_code = firstSkuRow.overseas_sku_code;
      }
      if (totalExpectedQty > 0) {
        itemUpdates.expected_qty = totalExpectedQty;
      }
      if (totalOutboundQty > 0) {
        itemUpdates.outbound_qty = totalOutboundQty;
      }
      if (Object.keys(itemUpdates).length > 0) {
        itemUpdateList.push({ id: existingItem.id, data: itemUpdates });
      }
    } else {
      newOrderItems.push({
        transfer_no: transferNo,
        inbound_order_no: inboundOrderNo,
        sku_code: skuCode,
        sku_name: firstSkuRow.sku_name || null,
        overseas_sku_code: firstSkuRow.overseas_sku_code || null,
        expected_qty: totalExpectedQty,
        outbound_qty: totalOutboundQty,
        inbound_qty: 0,
        shelf_qty: 0,
      });
    }
  }

  await batchInsert(trx, 'transfer_order_items', newOrderItems);
  await batchUpdateGrouped(trx, 'transfer_order_items', itemUpdateList);

  await recalcOrderStats(trx, transferNo);
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
    if (!hasValue(row.inbound_order_no)) {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号', inbound_order_no: undefined });
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
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 导入失败: ${err.message}`, inbound_order_no: inboundOrderNo });
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
  if (!hasValue(value)) return undefined;
  if (typeof value === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = epoch.getTime() + value * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString();
    return undefined;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
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
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号/SKU编码/实际入库数量', inbound_order_no: row.inbound_order_no || undefined });
    } else if (isNaN(Number(row.inbound_qty))) {
      errors.push({ row: row._rowIndex, message: `入库单号 ${row.inbound_order_no} 数量格式错误: 实际入库数量`, inbound_order_no: String(row.inbound_order_no) });
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
    const inboundOrderNos = Object.keys(orderGroups);
    if (inboundOrderNos.length === 0) return;

    const orders = await trx('transfer_orders').whereIn('inbound_order_no', inboundOrderNos);
    const orderMap: Map<string, any> = new Map(orders.map((o: any) => [o.inbound_order_no, o]));

    const transferNos = orders.map((o: any) => o.transfer_no);
    const allItems = transferNos.length > 0
      ? await trx('transfer_order_items').whereIn('transfer_no', transferNos)
      : [];
    const itemMap = new Map<string, any>();
    for (const item of allItems) {
      itemMap.set(`${item.transfer_no}:${item.sku_code}`, item);
    }

    const itemUpdateList: { id: number; data: Record<string, any> }[] = [];
    const discrepancyRecords: any[] = [];
    const orderUpdateList: { id: number; data: Record<string, any> }[] = [];
    const changeLogRecords: any[] = [];

    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const order = orderMap.get(inboundOrderNo);
        if (!order) {
          for (const row of groupRows) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 未找到对应调拨单`, inbound_order_no: inboundOrderNo });
          }
          continue;
        }

        const orderUpdates: Record<string, any> = { update_time: new Date().toISOString() };
        let hasInboundQty = false;
        let hasShelfQty = false;

        for (const row of groupRows) {
          const itemKey = `${order.transfer_no}:${String(row.sku_code)}`;
          const item = itemMap.get(itemKey);
          if (!item) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} SKU ${row.sku_code} 在调拨单 ${order.transfer_no} 中不存在`, inbound_order_no: inboundOrderNo });
            continue;
          }

          const inboundQty = row.inbound_qty;
          const inboundDiff = inboundQty - (item.outbound_qty || 0);
          const totalDiff = inboundQty - item.expected_qty;

          const itemData: Record<string, any> = {
            inbound_qty: inboundQty,
            inbound_diff: inboundDiff,
            total_diff: totalDiff,
          };

          if (hasValue(row.shelf_qty)) {
            const shelfQty = Math.round(Number(row.shelf_qty));
            if (!isNaN(shelfQty)) {
              itemData.shelf_qty = shelfQty;
              hasShelfQty = true;
            }
          }

          itemUpdateList.push({ id: item.id, data: itemData });

          if (inboundQty > 0) hasInboundQty = true;

          if (totalDiff !== 0) {
            discrepancyRecords.push({
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

        if (hasValue(groupRows[0].inbound_time)) {
          const parsed = parseExcelDate(groupRows[0].inbound_time);
          if (parsed) orderUpdates.logistics_sign_time = parsed;
        }

        if (hasInboundQty && order.status === 'IN_TRANSIT') {
          orderUpdates.status = 'RECEIVED';
          if (!orderUpdates.logistics_sign_time) {
            orderUpdates.logistics_sign_time = new Date().toISOString();
          }
        }

        if (hasShelfQty && (order.status === 'RECEIVED' || order.status === 'IN_TRANSIT')) {
          orderUpdates.status = 'SHELVED';
          orderUpdates.shelf_time = new Date().toISOString();
        }

        if (hasValue(groupRows[0].is_shelf_abnormal)) {
          orderUpdates.is_shelf_abnormal = BOOLEAN_MAP[String(groupRows[0].is_shelf_abnormal)] ?? groupRows[0].is_shelf_abnormal;
        }
        if (hasValue(groupRows[0].shelf_abnormal_type)) {
          orderUpdates.shelf_abnormal_type = String(groupRows[0].shelf_abnormal_type);
        }
        if (hasValue(groupRows[0].shelf_abnormal_remark)) {
          orderUpdates.shelf_abnormal_remark = String(groupRows[0].shelf_abnormal_remark);
        }

        orderUpdateList.push({ id: order.id, data: orderUpdates });

        changeLogRecords.push({
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
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 入库回传失败: ${err.message}`, inbound_order_no: inboundOrderNo });
        }
      }
    }

    await batchUpdateGrouped(trx, 'transfer_order_items', itemUpdateList);
    await batchInsert(trx, 'discrepancy_records', discrepancyRecords);
    await batchUpdateGrouped(trx, 'transfer_orders', orderUpdateList);
    await batchInsert(trx, 'change_logs', changeLogRecords);
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

function calcDaysDiff(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000 * 100) / 100;
}

function computeCartonTimeStats(carton: any, orderUpdates: Record<string, any>): Record<string, any> {
  const stats: Record<string, any> = {};
  const unload = orderUpdates.unload_time || carton.unload_time;
  const shelf = orderUpdates.shelf_time || carton.shelf_time;

  const u2s = calcDaysDiff(unload, shelf);
  if (u2s !== null) stats.unload_to_shelf_days = u2s;
  return stats;
}

function computeExpectedDates(
  order: any,
  orderUpdates: Record<string, any>,
): void {
  const pickupTime = orderUpdates.pickup_time || order.pickup_time;
  const timelineDays = orderUpdates.timeline_requirement_days ?? order.timeline_requirement_days;
  if (pickupTime && timelineDays && !orderUpdates.expected_arrival_date) {
    const pickupDate = new Date(pickupTime);
    const arrivalDate = new Date(pickupDate.getTime() + Number(timelineDays) * 86400000);
    orderUpdates.expected_arrival_date = arrivalDate.toISOString().slice(0, 10);
    orderUpdates.expected_shelf_date = new Date(arrivalDate.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  }
}

export async function importLogisticsMerged(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);
  if (headers.length === 0 || rows.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }], createdOrders: 0, updatedOrders: 0 };
  }

  const parsedRows = mapRowsWithColumnMap(headers, rows, LOGISTICS_MERGED_COLUMN_MAP);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    if (!row.inbound_order_no) {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号', inbound_order_no: undefined });
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
    'pickup_time', 'departure_time', 'arrival_port_time', 'customs_clearance_time',
    'last_mile_pickup_time', 'logistics_sign_time', 'unload_time', 'shelf_time',
    'is_customs_declared', 'customs_factory', 'is_inspected',
    'last_mile_channel',
  ];

  await db.transaction(async (trx) => {
    const inboundOrderNos = Object.keys(orderGroups);
    if (inboundOrderNos.length === 0) return;

    const orders = await trx('transfer_orders').whereIn('inbound_order_no', inboundOrderNos);
    const orderMap: Map<string, any> = new Map(orders.map((o: any) => [o.inbound_order_no, o]));
    const transferNos = orders.map((o: any) => o.transfer_no);

    const allCartons = await trx('transfer_cartons').whereIn('transfer_no', transferNos);
    const cartonMap: Map<string, any[]> = new Map();
    for (const ctn of allCartons) {
      if (!cartonMap.has(ctn.transfer_no)) cartonMap.set(ctn.transfer_no, []);
      cartonMap.get(ctn.transfer_no)!.push(ctn);
    }

    const orderUpdateList: { id: number; data: Record<string, any> }[] = [];
    const cartonUpdateList: { id: number; data: Record<string, any> }[] = [];
    const allTrackingEvents: any[] = [];
    const changeLogRecords: any[] = [];

    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const order = orderMap.get(inboundOrderNo);
        if (!order) {
          for (const row of groupRows) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 未找到对应调拨单`, inbound_order_no: inboundOrderNo });
          }
          continue;
        }

        const firstRow = groupRows[0];
        const orderUpdates: Record<string, any> = { update_time: new Date().toISOString() };

        for (const field of LOGISTICS_FIELDS) {
          if (hasValue(firstRow[field])) {
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
        if (order.status === 'IN_TRANSIT' && orderUpdates.logistics_sign_time) {
          orderUpdates.status = 'RECEIVED';
        }

        computeExpectedDates(order, orderUpdates);

        orderUpdateList.push({ id: order.id, data: orderUpdates });

        const orderCartons = cartonMap.get(order.transfer_no) || [];
        const rowsWithCarton = groupRows.filter((r) => r.carton_no);
        const rowsWithoutCarton = groupRows.filter((r) => !r.carton_no);
        const cartonNoSet = new Set(rowsWithCarton.map((r) => String(r.carton_no)));

        for (const ctn of orderCartons) {
          const isTargeted = cartonNoSet.has(ctn.carton_no);
          const isAllMode = rowsWithoutCarton.length > 0 && cartonNoSet.size === 0;
          if (!isTargeted && !isAllMode) continue;

          const ctnUpdates: Record<string, any> = { update_time: new Date().toISOString() };

          for (const [orderField, cartonField] of Object.entries(CARTON_TIME_MAP)) {
            const val = orderUpdates[orderField];
            if (val !== undefined && val !== null) {
              ctnUpdates[cartonField] = val;
            }
          }

          if (isTargeted) {
            const targetRows = groupRows.filter((r) => String(r.carton_no) === ctn.carton_no);
            const specRow = targetRows[0];
            if (hasValue(specRow.carton_length)) ctnUpdates.carton_length = Number(specRow.carton_length);
            if (hasValue(specRow.carton_width)) ctnUpdates.carton_width = Number(specRow.carton_width);
            if (hasValue(specRow.carton_height)) ctnUpdates.carton_height = Number(specRow.carton_height);
            if (hasValue(specRow.carton_weight)) ctnUpdates.carton_weight = Number(specRow.carton_weight);
            if (hasValue(specRow.declared_value)) ctnUpdates.declared_value = Number(specRow.declared_value);
          }

          Object.assign(ctnUpdates, computeCartonTimeStats(ctn, orderUpdates));

          if (Object.keys(ctnUpdates).length > 1) {
            cartonUpdateList.push({ id: ctn.id, data: ctnUpdates });
          }
        }

        for (const row of groupRows) {
          if (row.event_time && row.event_type) {
            let eventType = row.event_type;
            if (typeof eventType === 'string' && LOGISTICS_EVENT_TYPE_MAP[eventType]) {
              eventType = LOGISTICS_EVENT_TYPE_MAP[eventType];
            }
            const eventTime = parseExcelDate(row.event_time) || new Date().toISOString();
            allTrackingEvents.push({
              transfer_no: order.transfer_no,
              event_time: eventTime,
              event_type: eventType,
              event_desc: row.event_desc || null,
              location: row.location || null,
              operator,
              create_time: new Date().toISOString(),
            });
          }
        }

        changeLogRecords.push({
          record_type: 'transfer_order',
          record_id: order.id,
          transfer_no: order.transfer_no,
          field_name: 'IMPORT_LOGISTICS_MERGED',
          old_value: '',
          new_value: `${groupRows.length} rows`,
          change_source: 'IMPORT',
          operator,
          reason: '物流信息导入',
        });

        updatedOrders++;
      } catch (err: any) {
        for (const row of groupRows) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 物流信息导入失败: ${err.message}`, inbound_order_no: inboundOrderNo });
        }
      }
    }

    await batchUpdateGrouped(trx, 'transfer_orders', orderUpdateList);
    await batchUpdateGrouped(trx, 'transfer_cartons', cartonUpdateList);
    await batchInsert(trx, 'tracking_events', allTrackingEvents);
    await batchInsert(trx, 'change_logs', changeLogRecords);
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

export async function processFreightImport(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);
  if (headers.length === 0 || rows.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }], createdOrders: 0, updatedOrders: 0 };
  }

  const parsedRows = mapRowsWithColumnMap(headers, rows, FREIGHT_COLUMN_MAP);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    if (!row.inbound_order_no) {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号', inbound_order_no: undefined });
    } else {
      validRows.push(row);
    }
  }

  let createdBills = 0;
  let updatedBills = 0;
  const orderErrors: RowError[] = [];

  await db.transaction(async (trx) => {
    if (validRows.length === 0) return;

    const inboundOrderNos = validRows.map((r) => String(r.inbound_order_no));
    const orders = await trx('transfer_orders').whereIn('inbound_order_no', inboundOrderNos);
    const orderMap: Map<string, any> = new Map(orders.map((o: any) => [o.inbound_order_no, o]));

    const transferNos = orders.map((o: any) => o.transfer_no);
    const existingBills = transferNos.length > 0
      ? await trx('freight_bills').whereIn('transfer_no', transferNos).andWhere({ bill_status: 'PENDING' })
      : [];
    const billMap: Map<string, any> = new Map(existingBills.map((b: any) => [b.transfer_no, b]));

    const newBills: any[] = [];
    const billUpdateList: { id: number; data: Record<string, any> }[] = [];
    const changeLogRecords: any[] = [];

    for (const row of validRows) {
      try {
        const order = orderMap.get(String(row.inbound_order_no));
        if (!order) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${row.inbound_order_no} 未找到对应调拨单`, inbound_order_no: String(row.inbound_order_no) });
          continue;
        }

        const existingBill = billMap.get(order.transfer_no);

        const freightFee = hasValue(row.freight_fee) ? Number(row.freight_fee) : undefined;
        const customsFee = hasValue(row.customs_fee) ? Number(row.customs_fee) : undefined;
        const otherFee = hasValue(row.other_fee) ? Number(row.other_fee) : undefined;
        const currency = hasValue(row.currency) ? String(row.currency) : undefined;
        const exchangeRate = hasValue(row.exchange_rate) ? Number(row.exchange_rate) : undefined;

        if (existingBill) {
          const updates: Record<string, any> = { update_time: new Date().toISOString() };
          if (freightFee !== undefined && !isNaN(freightFee)) updates.freight_fee = freightFee;
          if (customsFee !== undefined && !isNaN(customsFee)) updates.customs_fee = customsFee;
          if (otherFee !== undefined && !isNaN(otherFee)) updates.other_fee = otherFee;
          if (currency !== undefined) updates.currency = currency;
          if (exchangeRate !== undefined && !isNaN(exchangeRate)) updates.exchange_rate = exchangeRate;

          const fFee = updates.freight_fee !== undefined ? Number(updates.freight_fee) : Number(existingBill.freight_fee || 0);
          const cFee = updates.customs_fee !== undefined ? Number(updates.customs_fee) : Number(existingBill.customs_fee || 0);
          const oFee = updates.other_fee !== undefined ? Number(updates.other_fee) : Number(existingBill.other_fee || 0);
          const eRate = updates.exchange_rate !== undefined ? Number(updates.exchange_rate) : Number(existingBill.exchange_rate || 1);

          updates.total_amount = Math.round((fFee + cFee + oFee) * 100) / 100;
          updates.total_amount_cny = Math.round(updates.total_amount * eRate * 100) / 100;

          billUpdateList.push({ id: existingBill.id, data: updates });

          changeLogRecords.push({
            record_type: 'transfer_order',
            record_id: order.id,
            transfer_no: order.transfer_no,
            field_name: 'IMPORT_FREIGHT',
            old_value: '',
            new_value: `updated bill ${existingBill.bill_no}`,
            change_source: 'IMPORT',
            operator,
            reason: '运费账单导入更新',
          });

          updatedBills++;
        } else {
          const fFee = freightFee !== undefined && !isNaN(freightFee) ? freightFee : 0;
          const cFee = customsFee !== undefined && !isNaN(customsFee) ? customsFee : 0;
          const oFee = otherFee !== undefined && !isNaN(otherFee) ? otherFee : 0;
          const eRate = exchangeRate !== undefined && !isNaN(exchangeRate) ? exchangeRate : 1;
          const totalAmount = Math.round((fFee + cFee + oFee) * 100) / 100;
          const totalAmountCny = Math.round(totalAmount * eRate * 100) / 100;

          const today = new Date();
          const dateStr = today.getFullYear().toString() +
            String(today.getMonth() + 1).padStart(2, '0') +
            String(today.getDate()).padStart(2, '0');
          const prefix = `FB-${dateStr}-`;
          const lastBill = await trx('freight_bills')
            .where('bill_no', 'like', `${prefix}%`)
            .orderBy('bill_no', 'desc')
            .first();
          let seq = 1;
          if (lastBill) {
            const lastSeq = parseInt(lastBill.bill_no.substring(prefix.length), 10);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
          }
          const billNo = `${prefix}${String(seq).padStart(4, '0')}`;

          const now = new Date().toISOString();
          newBills.push({
            bill_no: billNo,
            transfer_no: order.transfer_no,
            freight_fee: fFee,
            customs_fee: cFee,
            other_fee: oFee,
            total_amount: totalAmount,
            currency: currency || 'CNY',
            exchange_rate: eRate,
            total_amount_cny: totalAmountCny,
            bill_status: 'PENDING',
            create_time: now,
            update_time: now,
          });

          changeLogRecords.push({
            record_type: 'transfer_order',
            record_id: order.id,
            transfer_no: order.transfer_no,
            field_name: 'IMPORT_FREIGHT',
            old_value: '',
            new_value: `created bill ${billNo}`,
            change_source: 'IMPORT',
            operator,
            reason: '运费账单导入创建',
          });

          createdBills++;
        }
      } catch (err: any) {
        orderErrors.push({ row: row._rowIndex, message: `入库单号 ${row.inbound_order_no} 运费导入失败: ${err.message}`, inbound_order_no: String(row.inbound_order_no) });
      }
    }

    await batchInsert(trx, 'freight_bills', newBills);
    await batchUpdateGrouped(trx, 'freight_bills', billUpdateList);
    await batchInsert(trx, 'change_logs', changeLogRecords);
  });

  const allErrors = [...errors, ...orderErrors];
  const successCount = validRows.length - orderErrors.length;

  return {
    total: parsedRows.length,
    success: successCount,
    failed: allErrors.length,
    errors: allErrors,
    createdOrders: createdBills,
    updatedOrders: updatedBills,
  };
}

export async function importCartonList(buffer: ArrayBuffer, operator: string): Promise<ImportResult> {
  const { headers, rows } = parseExcel(buffer);
  if (headers.length === 0 || rows.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [{ row: 0, message: 'Excel文件为空或无有效数据' }], createdOrders: 0, updatedOrders: 0 };
  }

  const parsedRows = mapRowsWithColumnMap(headers, rows, CARTON_LIST_COLUMN_MAP);
  const errors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (const row of parsedRows) {
    if (!hasValue(row.inbound_order_no)) {
      errors.push({ row: row._rowIndex, message: '必填字段缺失: 第三方入库单号', inbound_order_no: undefined });
    } else if (!hasValue(row.carton_no)) {
      errors.push({ row: row._rowIndex, message: `入库单号 ${row.inbound_order_no} 必填字段缺失: 箱号`, inbound_order_no: String(row.inbound_order_no) });
    } else if (!hasValue(row.sku_code)) {
      errors.push({ row: row._rowIndex, message: `入库单号 ${row.inbound_order_no} 必填字段缺失: SKU`, inbound_order_no: String(row.inbound_order_no) });
    } else {
      if (hasValue(row.outbound_qty)) {
        const num = Number(row.outbound_qty);
        if (isNaN(num)) {
          errors.push({ row: row._rowIndex, message: `入库单号 ${row.inbound_order_no} 实发数量格式错误`, inbound_order_no: String(row.inbound_order_no) });
          continue;
        }
        row.outbound_qty = Math.round(num);
      } else {
        row.outbound_qty = 0;
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
    const inboundOrderNos = Object.keys(orderGroups);
    if (inboundOrderNos.length === 0) return;

    const orders = await trx('transfer_orders').whereIn('inbound_order_no', inboundOrderNos);
    const orderMap: Map<string, any> = new Map(orders.map((o: any) => [o.inbound_order_no, o]));
    const transferNos = orders.map((o: any) => o.transfer_no);

    const allExistingCartons = transferNos.length > 0
      ? await trx('transfer_cartons').whereIn('transfer_no', transferNos)
      : [];
    const existingCartonMap: Map<string, any> = new Map(
      allExistingCartons.map((c: any) => [`${c.transfer_no}:${c.carton_no}`, c])
    );

    const allExistingItems = transferNos.length > 0
      ? await trx('transfer_order_items').whereIn('transfer_no', transferNos)
      : [];
    const existingItemMap: Map<string, any> = new Map(
      allExistingItems.map((i: any) => [`${i.transfer_no}:${i.sku_code}`, i])
    );

    const newCartons: any[] = [];
    const cartonUpdateList: { id: number; data: Record<string, any> }[] = [];
    const allCartonItems: any[] = [];
    const itemUpdateList: { id: number; data: Record<string, any> }[] = [];
    const orderUpdateList: { id: number; data: Record<string, any> }[] = [];
    const changeLogRecords: any[] = [];
    const affectedTransferNos: string[] = [];

    for (const [inboundOrderNo, groupRows] of Object.entries(orderGroups)) {
      try {
        const order = orderMap.get(inboundOrderNo);
        if (!order) {
          for (const row of groupRows) {
            orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 未找到对应调拨单`, inbound_order_no: inboundOrderNo });
          }
          continue;
        }

        affectedTransferNos.push(order.transfer_no);

        const cartonGroups: Record<string, ParsedRow[]> = {};
        for (const row of groupRows) {
          const key = String(row.carton_no);
          if (!cartonGroups[key]) cartonGroups[key] = [];
          cartonGroups[key].push(row);
        }

        for (const [cartonNo, cartonRows] of Object.entries(cartonGroups)) {
          const existingCarton = existingCartonMap.get(`${order.transfer_no}:${cartonNo}`);

          if (existingCarton) {
            const updates: Record<string, any> = { update_time: new Date().toISOString() };
            const firstRow = cartonRows[0];
            if (hasValue(firstRow.carton_length)) updates.carton_length = Number(firstRow.carton_length);
            if (hasValue(firstRow.carton_width)) updates.carton_width = Number(firstRow.carton_width);
            if (hasValue(firstRow.carton_height)) updates.carton_height = Number(firstRow.carton_height);
            if (hasValue(firstRow.carton_weight)) updates.carton_weight = Number(firstRow.carton_weight);
            if (hasValue(firstRow.channel_weight)) updates.channel_weight = Number(firstRow.channel_weight);
            if (Object.keys(updates).length > 1) {
              cartonUpdateList.push({ id: existingCarton.id, data: updates });
            }
          } else {
            const firstRow = cartonRows[0];
            const cartonData: Record<string, any> = {
              transfer_no: order.transfer_no,
              inbound_order_no: inboundOrderNo,
              carton_no: cartonNo,
              create_time: new Date().toISOString(),
              update_time: new Date().toISOString(),
            };
            if (hasValue(firstRow.carton_length)) cartonData.carton_length = Number(firstRow.carton_length);
            if (hasValue(firstRow.carton_width)) cartonData.carton_width = Number(firstRow.carton_width);
            if (hasValue(firstRow.carton_height)) cartonData.carton_height = Number(firstRow.carton_height);
            if (hasValue(firstRow.carton_weight)) cartonData.carton_weight = Number(firstRow.carton_weight);
            if (hasValue(firstRow.channel_weight)) cartonData.channel_weight = Number(firstRow.channel_weight);
            newCartons.push(cartonData);
          }

          for (const row of cartonRows) {
            allCartonItems.push({
              carton_no: cartonNo,
              transfer_no: order.transfer_no,
              inbound_order_no: inboundOrderNo,
              sku_code: String(row.sku_code),
              overseas_sku_code: row.overseas_sku_code || null,
              qty: Number(row.outbound_qty) || 0,
            });
          }
        }

        const skuQtyMap: Record<string, number> = {};
        for (const row of groupRows) {
          const skuKey = String(row.sku_code);
          skuQtyMap[skuKey] = (skuQtyMap[skuKey] || 0) + (Number(row.outbound_qty) || 0);
        }

        for (const [skuCode, totalOutboundQty] of Object.entries(skuQtyMap)) {
          const existingItem = existingItemMap.get(`${order.transfer_no}:${skuCode}`);
          if (existingItem && totalOutboundQty > 0) {
            itemUpdateList.push({ id: existingItem.id, data: { outbound_qty: totalOutboundQty } });
          }
        }

        const firstRowTotalCarton = groupRows.find((r) => hasValue(r.total_carton_count));
        if (firstRowTotalCarton) {
          const totalCartonCount = Number(firstRowTotalCarton.total_carton_count);
          if (!isNaN(totalCartonCount) && totalCartonCount > 0) {
            orderUpdateList.push({ id: order.id, data: { total_carton_count: Math.round(totalCartonCount), update_time: new Date().toISOString() } });
          }
        }

        const firstRowUnitPrice = groupRows.find((r) => hasValue(r.estimated_unit_price));
        if (firstRowUnitPrice) {
          const unitPrice = Number(firstRowUnitPrice.estimated_unit_price);
          if (!isNaN(unitPrice)) {
            orderUpdateList.push({ id: order.id, data: { estimated_unit_price: unitPrice, update_time: new Date().toISOString() } });
          }
        }

        changeLogRecords.push({
          record_type: 'transfer_order',
          record_id: order.id,
          transfer_no: order.transfer_no,
          field_name: 'IMPORT_CARTON',
          old_value: '',
          new_value: `${groupRows.length} rows`,
          change_source: 'IMPORT',
          operator,
          reason: '入库单箱单导入',
        });

        updatedOrders++;
      } catch (err: any) {
        for (const row of groupRows) {
          orderErrors.push({ row: row._rowIndex, message: `入库单号 ${inboundOrderNo} 箱单导入失败: ${err.message}`, inbound_order_no: inboundOrderNo });
        }
      }
    }

    const cartonNos = [...new Set(validRows.map((r) => String(r.carton_no)))];

    if (cartonNos.length > 0 && affectedTransferNos.length > 0) {
      await trx('transfer_carton_items')
        .whereIn('transfer_no', affectedTransferNos)
        .whereIn('carton_no', cartonNos)
        .del();
    }

    await batchInsert(trx, 'transfer_cartons', newCartons);
    await batchUpdateGrouped(trx, 'transfer_cartons', cartonUpdateList);
    await batchInsert(trx, 'transfer_carton_items', allCartonItems);
    await batchUpdateGrouped(trx, 'transfer_order_items', itemUpdateList);
    await batchUpdateGrouped(trx, 'transfer_orders', orderUpdateList);

    for (const tno of affectedTransferNos) {
      await recalcOrderStats(trx, tno);
    }

    await batchInsert(trx, 'change_logs', changeLogRecords);
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
      '第三方入库单号', '调拨单号', '出库单号', '创建时间', '发货仓库', '目标仓库', '团队',
      'SKU', '产品名称', '海外仓SKU', '计划数量', '实发数量',
      '时效要求', '物流商', '运输类型', '提货时间',
      '包装ID', '是否报关', '报关工厂', '申报品名', '申报货值', '备注',
    ],
    logistics: [
      '第三方入库单号', '物流商', '物流单号', '发货时间', '离港时间', '到港时间', '清关时间', '尾程提取时间', '签收时间', '卸货时间', '上架时间', '是否报关', '报关工厂', '是否查验', '尾程类型', '尾程渠道', '事件时间', '事件类型', '事件描述', '位置', '箱号', '长', '宽', '高', '实重', '申报货值',
    ],
    inbound: [
      '第三方入库单号', '箱号', 'SKU', '实际入库数量', '入库时间', '上架数量', '上架异常', '上架异常类型', '上架异常备注',
    ],
    freight: [
      '第三方入库单号', '物流商', '运费', '报关费', '其他费用', '币种', '汇率', '账单日期', '备注',
    ],
    carton: [
      '第三方入库单号', 'SKU', '海外仓SKU', '箱号', '实发数量', '总箱数', '长', '宽', '高', '仓库实重', '渠道实重', '单价',
    ],
  };

  const headers = headersByType[type] || headersByType['main'];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '导入模板');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
