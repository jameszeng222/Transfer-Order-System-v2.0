import { useState, useEffect, useCallback } from 'react';
import { Plus, DollarSign, CheckCircle2, FileCheck, AlertCircle } from 'lucide-react';
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
  confirmed: number;
  reconciled: number;
  total_amount_cny: number;
}

interface Carrier {
  id: number;
  carrier_code: string;
  carrier_name: string;
}

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, 'transit' | 'shipped' | 'received'> = {
  PENDING: 'transit',
  CONFIRMED: 'shipped',
  RECONCILED: 'received',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  RECONCILED: '已对账',
};

export default function FreightPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('freight.view');
  const canManage = hasPermission('freight.manage');

  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({ pending: 0, confirmed: 0, reconciled: 0, total_amount_cny: 0 });

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get<{ success: boolean; data: Carrier[] }>('/carriers?pageSize=100')
      .then((res) => { if (res.success) setCarriers(res.data || []); })
      .catch(() => {});
  }, []);

  const carrierOptions = carriers.map((c) => ({ label: c.carrier_name, value: c.carrier_code }));

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Stats }>('/freight-bills/stats');
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
      }>(`/freight-bills?${params.toString()}`);
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

  const handleFormChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
  };

  const openCreate = () => {
    setFormData({});
    setFormErrors({});
    setCreateOpen(true);
  };

  const validateCreate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.transfer_no) errors.transfer_no = '调拨单号不能为空';
    if (!formData.logistics_carrier) errors.logistics_carrier = '物流商不能为空';
    if (!formData.total_amount) errors.total_amount = '金额不能为空';
    if (!formData.currency) errors.currency = '币种不能为空';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreate()) return;
    setSubmitting(true);
    try {
      await api.post('/freight-bills', formData);
      setCreateOpen(false);
      fetchData();
      fetchStats();
    } catch (err) {
      setFormErrors({ _submit: err instanceof Error ? err.message : '操作失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (id: unknown) => {
    try {
      await api.put(`/freight-bills/${id}`, { bill_status: 'CONFIRMED' });
      fetchData();
      fetchStats();
    } catch {}
  };

  const handleReconcile = async (id: unknown) => {
    try {
      await api.put(`/freight-bills/${id}`, { bill_status: 'RECONCILED' });
      fetchData();
      fetchStats();
    } catch {}
  };

  const handleBatchReconcile = async () => {
    if (selectedIds.size === 0) return;
    try {
      await api.put('/freight-bills/batch-reconcile', { ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      fetchData();
      fetchStats();
    } catch {}
  };

  const toggleSelect = (id: number, status: string) => {
    if (status !== 'CONFIRMED') return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!canView) {
    return <EmptyState title="无权限" description="您没有查看此页面的权限" />;
  }

  const tableColumns = [
    ...(canManage ? [{
      key: '_select', title: '', width: '40px',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const status = String(row.bill_status);
        if (status !== 'CONFIRMED') return null;
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(Number(row.id))}
            onChange={() => toggleSelect(Number(row.id), status)}
            className="rounded border-gray-300"
          />
        );
      },
    }] : []),
    { key: 'bill_no', title: '账单号' },
    { key: 'transfer_no', title: '调拨单号' },
    { key: 'inbound_order_no', title: '入库单号' },
    { key: 'logistics_carrier', title: '物流商' },
    {
      key: 'total_amount', title: '金额',
      render: (value: unknown, row: Record<string, unknown>) => (
        <span className="text-gray-700">{String(value)} {String(row.currency || '')}</span>
      ),
    },
    {
      key: 'total_amount_cny', title: '金额(CNY)',
      render: (value: unknown) => <span className="text-gray-700">{String(value)}</span>,
    },
    {
      key: 'bill_status', title: '状态',
      render: (value: unknown) => (
        <Badge variant={STATUS_VARIANT[String(value)] || 'pending'}>
          {STATUS_LABEL[String(value)] || String(value)}
        </Badge>
      ),
    },
    {
      key: 'bill_date', title: '账单日期',
      render: (value: unknown) => <span className="text-gray-700">{String(value || '--')}</span>,
    },
    ...(canManage ? [{
      key: '_actions', title: '操作', width: '160px',
      render: (_value: unknown, row: Record<string, unknown>) => {
        const status = String(row.bill_status);
        return (
          <div className="flex items-center gap-2">
            {status === 'PENDING' && (
              <button
                onClick={() => handleConfirm(row.id)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors cursor-pointer"
              >
                确认
              </button>
            )}
            {status === 'CONFIRMED' && (
              <button
                onClick={() => handleReconcile(row.id)}
                className="text-green-600 hover:text-green-800 text-sm font-medium transition-colors cursor-pointer"
              >
                对账
              </button>
            )}
            {(status !== 'PENDING' && status !== 'CONFIRMED') && (
              <span className="text-gray-400 text-sm">--</span>
            )}
          </div>
        );
      },
    }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">运费管理</h1>
        <div className="flex gap-2">
          {canManage && selectedIds.size > 0 && (
            <Button variant="secondary" onClick={handleBatchReconcile}>
              批量对账 ({selectedIds.size})
            </Button>
          )}
          {canManage && <Button icon={Plus} onClick={openCreate}>新增账单</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="待确认" value={stats.pending} icon={AlertCircle} color="orange" />
        <StatCard label="已确认" value={stats.confirmed} icon={CheckCircle2} color="blue" />
        <StatCard label="已对账" value={stats.reconciled} icon={FileCheck} color="green" />
        <StatCard label="总金额(CNY)" value={stats.total_amount_cny} icon={DollarSign} color="red" />
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">状态</label>
            <select
              value={filters.bill_status || ''}
              onChange={(e) => handleFilterChange('bill_status', e.target.value)}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="PENDING">待确认</option>
              <option value="CONFIRMED">已确认</option>
              <option value="RECONCILED">已对账</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">物流商</label>
            <select
              value={filters.logistics_carrier || ''}
              onChange={(e) => handleFilterChange('logistics_carrier', e.target.value)}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {carriers.map((c) => <option key={c.id} value={c.carrier_code}>{c.carrier_name}</option>)}
            </select>
          </div>
          <Button variant="secondary" onClick={handleSearch}>搜索</Button>
        </div>
      </Card>

      <Table columns={tableColumns} data={data} loading={loading} />

      {total > PAGE_SIZE && <Pagination current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />}

      <Modal open={createOpen} title="新增账单" onClose={() => setCreateOpen(false)} width="md">
        <div className="space-y-4">
          <FormField label="调拨单号" name="transfer_no" value={formData.transfer_no} onChange={handleFormChange} error={formErrors.transfer_no} required />
          <FormField label="入库单号" name="inbound_order_no" value={formData.inbound_order_no} onChange={handleFormChange} />
          <FormField label="物流商" name="logistics_carrier" type="select" value={formData.logistics_carrier} onChange={handleFormChange} error={formErrors.logistics_carrier} options={carrierOptions} required placeholder="请选择物流商" />
          <FormField label="金额" name="total_amount" type="number" value={formData.total_amount} onChange={handleFormChange} error={formErrors.total_amount} required placeholder="请输入金额" />
          <FormField label="币种" name="currency" type="select" value={formData.currency} onChange={handleFormChange} error={formErrors.currency} options={[
            { label: 'CNY', value: 'CNY' }, { label: 'USD', value: 'USD' },
            { label: 'EUR', value: 'EUR' }, { label: 'GBP', value: 'GBP' },
          ]} required placeholder="请选择币种" />
          <FormField label="账单日期" name="bill_date" type="date" value={formData.bill_date} onChange={handleFormChange} />
          {formErrors._submit && <p className="text-sm text-red-500">{formErrors._submit}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button loading={submitting} onClick={handleCreate}>确定</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
