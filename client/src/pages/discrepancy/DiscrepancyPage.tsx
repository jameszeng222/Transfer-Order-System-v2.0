import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
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

interface Stats {
  pending: number;
  processing: number;
  closed: number;
}

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, 'warning' | 'primary' | 'success'> = {
  PENDING: 'warning',
  PROCESSING: 'primary',
  CLOSED: 'success',
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

const RESOLUTION_OPTIONS = [
  { label: '补发', value: 'RESHIP' },
  { label: '退款', value: 'REFUND' },
  { label: '调整库存', value: 'ADJUST' },
  { label: '忽略', value: 'IGNORE' },
  { label: '其他', value: 'OTHER' },
];

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

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveRow, setResolveRow] = useState<Record<string, unknown> | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolutionRemark, setResolutionRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

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
  }, [page, filters]);

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

  if (!canView) {
    return <EmptyState title="无权限" description="您没有查看此页面的权限" />;
  }

  const tableColumns = [
    { key: 'transfer_no', title: '调拨单号' },
    { key: 'inbound_order_no', title: '入库单号' },
    {
      key: 'from_warehouse', title: '来源仓 → 目的仓',
      render: (_value: unknown, row: Record<string, unknown>) => (
        <span className="text-gray-700">{String(row.from_warehouse)} → {String(row.to_warehouse)}</span>
      ),
    },
    {
      key: 'discrepancy_category', title: '异常分类',
      render: (value: unknown) => (
        <Badge variant="warning">{CATEGORY_LABEL[String(value)] || String(value)}</Badge>
      ),
    },
    { key: 'discrepancy_type', title: '异常类型' },
    { key: 'discrepancy_qty', title: '异常数量' },
    {
      key: 'status', title: '状态',
      render: (value: unknown) => (
        <Badge variant={STATUS_VARIANT[String(value)] || 'default'}>
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
      <h1 className="text-lg font-semibold text-gray-900">异常管理</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="待确认" value={stats.pending} icon={AlertTriangle} color="amber" />
        <StatCard title="处理中" value={stats.processing} icon={Clock} color="blue" />
        <StatCard title="已关闭" value={stats.closed} icon={CheckCircle2} color="green" />
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
    </div>
  );
}
