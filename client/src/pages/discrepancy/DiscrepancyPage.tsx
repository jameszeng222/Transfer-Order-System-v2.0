import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, CheckCircle2, Plus } from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { FormField } from '../../components/ui/FormField';
import { Pagination } from '../../components/ui/Pagination';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import TimeFilterPanel from '../../components/ui/TimeFilterPanel';

interface Stats {
  pending: number;
  processing: number;
  closed: number;
}

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, 'transit' | 'shipped' | 'received'> = {
  PENDING: 'transit',
  PROCESSING: 'shipped',
  CLOSED: 'received',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待确认',
  PROCESSING: '处理中',
  CLOSED: '已关闭',
};

const CATEGORY_OPTIONS = [
  { label: '物流异常', value: 'LOGISTICS' },
  { label: '上架异常', value: 'SHELF' },
  { label: '数量差异', value: 'QUANTITY' },
  { label: '破损', value: 'DAMAGE' },
  { label: '其他', value: 'OTHER' },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

const NEW_DISCREPANCY_CATEGORY_OPTIONS = [
  { label: '数量差异', value: 'QUANTITY_DIFF' },
  { label: '质量问题', value: 'QUALITY_ISSUE' },
  { label: '物流异常', value: 'LOGISTICS_ABNORMAL' },
  { label: '上架异常', value: 'SHELF_ABNORMAL' },
];

const DISCREPANCY_TYPE_MAP: Record<string, { label: string; value: string }[]> = {
  QUANTITY_DIFF: [
    { label: '少件', value: 'SHORTAGE' },
    { label: '多件', value: 'EXCESS' },
    { label: '错件', value: 'WRONG_ITEM' },
  ],
  QUALITY_ISSUE: [
    { label: '破损', value: 'DAMAGED' },
    { label: '变质', value: 'DETERIORATED' },
    { label: '包装损坏', value: 'PACKAGING_DAMAGED' },
  ],
  LOGISTICS_ABNORMAL: [
    { label: '丢失', value: 'LOST' },
    { label: '延迟', value: 'DELAYED' },
    { label: '错发', value: 'MIS_SHIPPED' },
  ],
  SHELF_ABNORMAL: [
    { label: '上架短缺', value: 'SHELF_SHORTAGE' },
    { label: '上架错位', value: 'SHELF_MISPLACED' },
  ],
};

const RESOLUTION_OPTIONS = [
  { label: '补发', value: 'RESHIP' },
  { label: '退款', value: 'REFUND' },
  { label: '调整库存', value: 'ADJUST' },
  { label: '忽略', value: 'IGNORE' },
  { label: '其他', value: 'OTHER' },
];

const DEFAULT_TIME_FILTERS = {
  createTimeRange: { start: '', end: '' },
  departTimeRange: { start: '', end: '' },
  pickupTimeRange: { start: '', end: '' },
  deliveryTimeRange: { start: '', end: '' },
  shelveTimeRange: { start: '', end: '' },
};

function formatDateTime(val: string | null | undefined): string {
  if (!val) return '--';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '--';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

interface NewDiscrepancyForm {
  transfer_no: string;
  sku_code: string;
  sku_name: string;
  discrepancy_category: string;
  discrepancy_type: string;
  discrepancy_qty: number | string;
  remark: string;
}

const DEFAULT_NEW_FORM: NewDiscrepancyForm = {
  transfer_no: '',
  sku_code: '',
  sku_name: '',
  discrepancy_category: '',
  discrepancy_type: '',
  discrepancy_qty: '',
  remark: '',
};

export default function DiscrepancyPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('discrepancy.view');
  const canManage = hasPermission('discrepancy.manage');

  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({ pending: 0, processing: 0, closed: 0 });

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [timeFilters, setTimeFilters] = useState({ ...DEFAULT_TIME_FILTERS });

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveRow, setResolveRow] = useState<Record<string, unknown> | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolutionRemark, setResolutionRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<NewDiscrepancyForm>({ ...DEFAULT_NEW_FORM });
  const [newSubmitting, setNewSubmitting] = useState(false);
  const [newError, setNewError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Stats }>('/discrepancies/stats');
      if (res.success && res.data) setStats(res.data);
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      if (timeFilters.createTimeRange.start) params.set('create_time_start', timeFilters.createTimeRange.start);
      if (timeFilters.createTimeRange.end) params.set('create_time_end', timeFilters.createTimeRange.end);
      if (timeFilters.departTimeRange.start) params.set('depart_time_start', timeFilters.departTimeRange.start);
      if (timeFilters.departTimeRange.end) params.set('depart_time_end', timeFilters.departTimeRange.end);
      if (timeFilters.pickupTimeRange.start) params.set('pickup_time_start', timeFilters.pickupTimeRange.start);
      if (timeFilters.pickupTimeRange.end) params.set('pickup_time_end', timeFilters.pickupTimeRange.end);
      if (timeFilters.deliveryTimeRange.start) params.set('delivery_time_start', timeFilters.deliveryTimeRange.start);
      if (timeFilters.deliveryTimeRange.end) params.set('delivery_time_end', timeFilters.deliveryTimeRange.end);
      if (timeFilters.shelveTimeRange.start) params.set('shelve_time_start', timeFilters.shelveTimeRange.start);
      if (timeFilters.shelveTimeRange.end) params.set('shelve_time_end', timeFilters.shelveTimeRange.end);
      const res = await api.get<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: { total: number };
      }>(`/discrepancies?${params.toString()}`);
      if (res.success) {
        setData(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters, timeFilters]);

  useEffect(() => {
    if (canView) { fetchData(); fetchStats(); }
  }, [canView, fetchData, fetchStats]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSearch = () => { setPage(1); fetchData(); };

  const openResolve = (row: Record<string, unknown>) => {
    setResolveRow(row);
    setResolution('');
    setResolutionRemark('');
    setFormError('');
    setResolveOpen(true);
  };

  const handleResolve = async () => {
    if (!resolution) { setFormError('请选择处理方式'); return; }
    if (!resolveRow) return;
    setSubmitting(true);
    try {
      await api.put(`/discrepancies/${resolveRow.id}`, {
        ...resolveRow,
        resolution,
        resolution_remark: resolutionRemark,
        status: 'PROCESSING',
      });
      setResolveOpen(false);
      fetchData();
      fetchStats();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewFormChange = (name: string, value: unknown) => {
    setNewForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'discrepancy_category') {
        updated.discrepancy_type = '';
      }
      return updated;
    });
    setNewError('');
  };

  const handleNewSubmit = async () => {
    if (!newForm.transfer_no) { setNewError('请输入调拨单号'); return; }
    if (!newForm.sku_code) { setNewError('请输入SKU编码'); return; }
    if (!newForm.discrepancy_category) { setNewError('请选择异常分类'); return; }
    if (!newForm.discrepancy_type) { setNewError('请选择异常类型'); return; }
    setNewSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; error?: string }>('/discrepancies', {
        ...newForm,
        source: 'MANUAL',
      });
      if (res.success) {
        setNewOpen(false);
        setNewForm({ ...DEFAULT_NEW_FORM });
        fetchData();
        fetchStats();
      } else {
        setNewError(res.error || '创建失败');
      }
    } catch (err) {
      setNewError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setNewSubmitting(false);
    }
  };

  if (!canView) {
    return <EmptyState title="无权限" description="您没有查看此页面的权限" />;
  }

  const tableColumns = [
    { key: 'transfer_no', title: '调拨单号' },
    { key: 'sku_code', title: '系统SKU' },
    { key: 'sku_name', title: '品名', render: (_value: unknown, row: Record<string, unknown>) => (row.sku_name as string) || '--' },
    { key: 'inbound_order_no', title: '入库单号' },
    {
      key: 'from_warehouse', title: '来源仓 → 目的仓',
      render: (_value: unknown, row: Record<string, unknown>) => (
        <span className="text-gray-700">{String(row.from_warehouse)} → {String(row.to_warehouse)}</span>
      ),
    },
    {
      key: 'source', title: '来源',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const source = row.source as string;
        if (source === 'SHELF_SHORTAGE') return <Badge variant="abnormal">上架短缺</Badge>;
        return <Badge variant="pending">手动创建</Badge>;
      },
    },
    {
      key: 'discrepancy_category', title: '异常分类',
      render: (value: unknown) => (
        <Badge variant="transit">{CATEGORY_LABEL[String(value)] || String(value)}</Badge>
      ),
    },
    { key: 'discrepancy_type', title: '异常类型' },
    { key: 'discrepancy_qty', title: '异常数量' },
    {
      key: 'status', title: '状态',
      render: (value: unknown) => (
        <Badge variant={STATUS_VARIANT[String(value)] || 'pending'}>
          {STATUS_LABEL[String(value)] || String(value)}
        </Badge>
      ),
    },
    { key: 'handler', title: '处理人' },
    {
      key: 'create_time', title: '创建时间',
      render: (value: unknown) => <span className="text-gray-700">{formatDateTime(String(value))}</span>,
    },
    ...(canManage ? [{
      key: '_actions', title: '操作', width: '100px',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const status = String(row.status);
        return status !== 'CLOSED' ? (
          <button
            onClick={() => openResolve(row)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors cursor-pointer"
          >
            处理
          </button>
        ) : <span className="text-gray-400 text-sm">--</span>;
      },
    }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">异常管理</h1>
        {canManage && (
          <Button icon={Plus} onClick={() => { setNewForm({ ...DEFAULT_NEW_FORM }); setNewError(''); setNewOpen(true); }}>新建异常</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="待确认" value={stats.pending} icon={AlertTriangle} color="orange" />
        <StatCard label="处理中" value={stats.processing} icon={Clock} color="blue" />
        <StatCard label="已关闭" value={stats.closed} icon={CheckCircle2} color="green" />
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">状态</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="PENDING">待确认</option>
              <option value="PROCESSING">处理中</option>
              <option value="CLOSED">已关闭</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">异常分类</label>
            <select
              value={filters.discrepancy_category || ''}
              onChange={(e) => handleFilterChange('discrepancy_category', e.target.value)}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Button variant="secondary" onClick={handleSearch}>搜索</Button>
          <TimeFilterPanel filters={timeFilters} onChange={setTimeFilters} />
        </div>
      </Card>

      <Table columns={tableColumns} data={data} loading={loading} />

      {total > PAGE_SIZE && <Pagination current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />}

      <Modal open={resolveOpen} title="处理异常" onClose={() => setResolveOpen(false)} width="md">
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>调拨单号：<span className="font-medium text-gray-900">{String(resolveRow?.transfer_no ?? '')}</span></p>
            <p>异常分类：<span className="font-medium text-gray-900">{CATEGORY_LABEL[String(resolveRow?.discrepancy_category)] || String(resolveRow?.discrepancy_category ?? '')}</span></p>
            <p>异常数量：<span className="font-medium text-gray-900">{String(resolveRow?.discrepancy_qty ?? '')}</span></p>
          </div>
          <FormField label="处理方式" name="resolution" type="select" value={resolution} onChange={(_name, value) => { setResolution(String(value)); setFormError(''); }} options={RESOLUTION_OPTIONS} required placeholder="请选择处理方式" />
          <FormField label="处理备注" name="resolution_remark" type="textarea" value={resolutionRemark} onChange={(_name, value) => setResolutionRemark(String(value))} placeholder="请输入处理备注" />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setResolveOpen(false)}>取消</Button>
            <Button loading={submitting} onClick={handleResolve}>提交</Button>
          </div>
        </div>
      </Modal>

      <Modal open={newOpen} title="新建异常" onClose={() => setNewOpen(false)} width="md">
        <div className="space-y-4">
          <FormField label="调拨单号" name="transfer_no" type="text" value={newForm.transfer_no} onChange={handleNewFormChange} required placeholder="请输入调拨单号" />
          <FormField label="SKU编码" name="sku_code" type="text" value={newForm.sku_code} onChange={handleNewFormChange} required placeholder="请输入SKU编码" />
          <FormField label="品名" name="sku_name" type="text" value={newForm.sku_name} onChange={handleNewFormChange} placeholder="请输入品名" />
          <FormField label="异常分类" name="discrepancy_category" type="select" value={newForm.discrepancy_category} onChange={handleNewFormChange} required placeholder="请选择异常分类" options={NEW_DISCREPANCY_CATEGORY_OPTIONS} />
          {newForm.discrepancy_category && DISCREPANCY_TYPE_MAP[newForm.discrepancy_category] && (
            <FormField label="异常类型" name="discrepancy_type" type="select" value={newForm.discrepancy_type} onChange={handleNewFormChange} required placeholder="请选择异常类型" options={DISCREPANCY_TYPE_MAP[newForm.discrepancy_category]} />
          )}
          <FormField label="异常数量" name="discrepancy_qty" type="number" value={newForm.discrepancy_qty} onChange={handleNewFormChange} placeholder="请输入异常数量" />
          <FormField label="备注" name="remark" type="textarea" value={newForm.remark} onChange={handleNewFormChange} placeholder="请输入备注" />
          {newError && <p className="text-sm text-red-500">{newError}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setNewOpen(false)}>取消</Button>
            <Button loading={newSubmitting} onClick={handleNewSubmit}>提交</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
