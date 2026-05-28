import { Hono } from 'hono';
import { db } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';
import {
  importExcel,
  importInboundReturn,
  importLogisticsInfo,
  importLogisticsEvents,
  importLogisticsMerged,
  processFreightImport,
  generateTemplate,
} from '../services/importService.js';

const imports = new Hono();

async function parseUploadFile(c: any): Promise<{ buffer: ArrayBuffer; operator: string } | Response> {
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
    return { buffer, operator };
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

  return { buffer, operator };
}

imports.post('/upload', async (c) => {
  try {
    const parsed = await parseUploadFile(c);
    if (parsed instanceof Response) return parsed;
    const { buffer, operator } = parsed;
    const result = await importExcel(buffer, operator);
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
    const { buffer, operator } = parsed;
    const result = await importInboundReturn(buffer, operator);
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
    const { buffer, operator } = parsed;
    const result = await importLogisticsMerged(buffer, operator);
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
    const { buffer, operator } = parsed;
    const result = await processFreightImport(buffer, operator);
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

  const query = db('change_logs')
    .where('change_source', 'IMPORT')
    .whereIn('field_name', ['IMPORT_CREATE', 'IMPORT_OVERWRITE', 'IMPORT_OUTBOUND', 'IMPORT_INBOUND', 'IMPORT_LOGISTICS', 'IMPORT_LOGISTICS_EVENTS', 'IMPORT_LOGISTICS_MERGED', 'IMPORT_FREIGHT']);

  const totalResult = await query.clone().count('* as count').first();
  const total = Number(totalResult?.count || 0);

  const data = await query
    .clone()
    .orderBy('change_time', 'desc')
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  return c.json({
    success: true,
    data,
    pagination: { total, page, pageSize },
  });
});

export default imports;
