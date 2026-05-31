import { Hono } from 'hono';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';
import {
  importExcel,
  importInboundReturn,
  importLogisticsMerged,
  processFreightImport,
  generateTemplate,
} from '../services/importService.js';

const imports = new Hono();

async function parseUploadFile(c: any): Promise<{ buffer: ArrayBuffer; operator: string; filename: string } | Response> {
  const hasPermission = await requirePermission(c, 'import.execute');
  if (!hasPermission) {
    return c.json({ success: false, error: 'Forbidden: missing import.execute permission' }, 403);
  }

  const contentType = c.req.header('Content-Type') || '';

  if (contentType.includes('application/json')) {
    const body = await c.req.json();
    const { filename, data } = body;
    if (!data) {
      return c.json({ success: false, error: '请上传文件，字段名为 data' }, 400);
    }
    const fname = filename || 'upload.xlsx';
    if (!fname.endsWith('.xlsx') && !fname.endsWith('.xls')) {
      return c.json({ success: false, error: '仅支持 Excel 文件（.xlsx / .xls）' }, 400);
    }
    const buffer = Buffer.from(data, 'base64').buffer as ArrayBuffer;
    const user = c.get('user');
    const operator = user?.username || 'unknown';
    return { buffer, operator, filename: fname };
  }

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: '请上传文件，字段名为 file' }, 400);
  }

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return c.json({ success: false, error: '仅支持 Excel 文件（.xlsx / .xls）' }, 400);
  }

  const buffer = await file.arrayBuffer();
  const user = c.get('user');
  const operator = user?.username || 'unknown';

  return { buffer, operator, filename: file.name };
}

imports.post('/upload', async (c) => {
  try {
    const parsed = await parseUploadFile(c);
    if (parsed instanceof Response) return parsed;
    const { buffer, operator, filename } = parsed;
    const result = await importExcel(buffer, operator);
    await db('change_logs').insert({
      record_type: 'import_history',
      record_id: 0,
      transfer_no: '',
      field_name: result.createdOrders > 0 ? 'IMPORT_CREATE' : 'IMPORT_OVERWRITE',
      old_value: filename,
      new_value: `${result.success}/${result.failed}`,
      change_source: 'IMPORT',
      operator,
      change_time: new Date().toISOString(),
      reason: `调拨单导入: 新建${result.createdOrders}/更新${result.updatedOrders}`,
    });
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[import/upload] Error:', err?.message || err);
    return c.json({ success: false, error: `导入失败: ${err?.message || '未知错误'}` }, 500);
  }
});

imports.post('/inbound', async (c) => {
  try {
    const parsed = await parseUploadFile(c);
    if (parsed instanceof Response) return parsed;
    const { buffer, operator, filename } = parsed;
    const result = await importInboundReturn(buffer, operator);
    await db('change_logs').insert({
      record_type: 'import_history',
      record_id: 0,
      transfer_no: '',
      field_name: 'IMPORT_INBOUND',
      old_value: filename,
      new_value: `${result.success}/${result.failed}`,
      change_source: 'IMPORT',
      operator,
      change_time: new Date().toISOString(),
      reason: `入库回传导入: 成功${result.success}/失败${result.failed}`,
    });
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[import/inbound] Error:', err?.message || err);
    return c.json({ success: false, error: `导入失败: ${err?.message || '未知错误'}` }, 500);
  }
});

imports.post('/logistics', async (c) => {
  try {
    const parsed = await parseUploadFile(c);
    if (parsed instanceof Response) return parsed;
    const { buffer, operator, filename } = parsed;
    const result = await importLogisticsMerged(buffer, operator);
    await db('change_logs').insert({
      record_type: 'import_history',
      record_id: 0,
      transfer_no: '',
      field_name: 'IMPORT_LOGISTICS_MERGED',
      old_value: filename,
      new_value: `${result.success}/${result.failed}`,
      change_source: 'IMPORT',
      operator,
      change_time: new Date().toISOString(),
      reason: `物流信息导入: 成功${result.success}/失败${result.failed}`,
    });
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[import/logistics] Error:', err?.message || err);
    return c.json({ success: false, error: `导入失败: ${err?.message || '未知错误'}` }, 500);
  }
});

imports.post('/freight', async (c) => {
  try {
    const parsed = await parseUploadFile(c);
    if (parsed instanceof Response) return parsed;
    const { buffer, operator, filename } = parsed;
    const result = await processFreightImport(buffer, operator);
    await db('change_logs').insert({
      record_type: 'import_history',
      record_id: 0,
      transfer_no: '',
      field_name: 'IMPORT_FREIGHT',
      old_value: filename,
      new_value: `${result.success}/${result.failed}`,
      change_source: 'IMPORT',
      operator,
      change_time: new Date().toISOString(),
      reason: `运费账单导入: 成功${result.success}/失败${result.failed}`,
    });
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[import/freight] Error:', err?.message || err);
    return c.json({ success: false, error: `导入失败: ${err?.message || '未知错误'}` }, 500);
  }
});

imports.get('/templates/:type', async (c) => {
  const hasPermission = await requirePermission(c, 'import.execute');
  if (!hasPermission) {
    return c.json({ success: false, error: 'Forbidden: missing import.execute permission' }, 403);
  }

  const type = c.req.param('type');
  const validTypes = ['main', 'logistics', 'inbound', 'freight'];
  if (!validTypes.includes(type)) {
    return c.json({ success: false, error: `无效的模板类型，支持: ${validTypes.join(', ')}` }, 400);
  }

  const buffer = generateTemplate(type);
  const typeNames: Record<string, string> = {
    main: '主导入',
    logistics: '物流信息',
    inbound: '入库回传',
    freight: '运费账单',
  };

  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(typeNames[type] + '模板')}.xlsx"`);
  return c.body(buffer);
});

imports.get('/history', async (c) => {
  const hasPermission = await requirePermission(c, 'import.execute');
  if (!hasPermission) {
    return c.json({ success: false, error: 'Forbidden: missing import.execute permission' }, 403);
  }

  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const data = await db('change_logs')
    .where('change_source', 'IMPORT')
    .whereIn('field_name', ['IMPORT_CREATE', 'IMPORT_OVERWRITE', 'IMPORT_INBOUND', 'IMPORT_LOGISTICS_MERGED', 'IMPORT_FREIGHT'])
    .orderBy('change_time', 'desc')
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  const totalResult = await db('change_logs')
    .where('change_source', 'IMPORT')
    .whereIn('field_name', ['IMPORT_CREATE', 'IMPORT_OVERWRITE', 'IMPORT_INBOUND', 'IMPORT_LOGISTICS_MERGED', 'IMPORT_FREIGHT'])
    .count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const TYPE_LABELS: Record<string, string> = {
    IMPORT_CREATE: '调拨单导入',
    IMPORT_OVERWRITE: '调拨单覆盖',
    IMPORT_INBOUND: '入库回传',
    IMPORT_LOGISTICS_MERGED: '物流信息导入',
    IMPORT_FREIGHT: '运费账单导入',
  };

  const history = data.map((row: any) => ({
    time: row.change_time || null,
    type: TYPE_LABELS[row.field_name] || row.field_name,
    filename: row.old_value || '--',
    success: parseInt(String(row.new_value || '0').split('/')[0]) || 0,
    failed: parseInt(String(row.new_value || '0').split('/')[1]) || 0,
    operator: row.operator || '--',
  }));

  return c.json({
    success: true,
    data: history,
    pagination: { total, page, pageSize },
  });
});

export default imports;
