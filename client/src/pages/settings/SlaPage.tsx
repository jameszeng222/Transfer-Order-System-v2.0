import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { FormField } from '../../components/ui/FormField';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

const PAGE_SIZE = 20;

const columns = [
  { key: 'dest_warehouse_id', title: '目的仓库', type: 'select' as const, required: true },
  { key: 'transport_type', title: '运输方式', type: 'select' as const, required: true, options: [
    { label: '海运', value: 'SEA' }, { label: '空运', value: 'AIR' },
    { label: '铁路', value: 'RAIL' }, { label: '卡车', value: 'TRUCK' },
  ]},
  { key: 'sla_days', title: 'SLA天数', type: 'number' as const, required: true },
  { key: 'shelf_sla_days', title: '上架SLA天数', type: 'number' as const },
];

export default function SlaPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('settings.manage');
  const canManage = hasPermission('settings.manage');

  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<unknown>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    api.get<{ success: boolean; data: Warehouse[] }>('/warehouses?pageSize=100')
      .then((res) => { if (res.success) setWarehouses(res.data || []); })
      .catch(() => {});
  }, []);

  const warehouseOptions = warehouses.map((w) => ({ label: w.warehouse_name, value: String(w.id) }));

  const getWarehouseName = (id: unknown) => {
    const wh = warehouses.find((w) => String(w.id) === String(id));
    return wh?.warehouse_name || String(id || '--');
  };

  const transportLabels: Record<string, string> = { SEA: '海运', AIR: '空运', RAIL: '铁路', TRUCK: '卡车' };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (keyword) params.set('keyword', keyword);
      const res = await api.get<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: { total: number };
      }>(`/sla-rules?${params.toString()}`);
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
  }, [page, keyword]);

  useEffect(() => {
    if (canView) fetchData();
  }, [canView, fetchData]);

  const handleSearch = () => { setPage(1); fetchData(); };

  const openCreate = () => {
    setEditing(null);
    setFormData({ shelf_sla_days: 3 });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setFormData({ ...row });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFormChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.dest_warehouse_id) errors.dest_warehouse_id = '目的仓库不能为空';
    if (!formData.transport_type) errors.transport_type = '运输方式不能为空';
    if (!formData.sla_days || Number(formData.sla_days) <= 0) errors.sla_days = 'SLA天数必须大于0';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/sla-rules/${editing.id}`, formData);
      } else {
        await api.post('/sla-rules', formData);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      if (msg.includes('UNIQUE') || msg.includes('unique') || msg.includes('已存在')) {
        setFormErrors({ _submit: '该仓库+运输方式的SLA规则已存在' });
      } else {
        setFormErrors({ _submit: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (id: unknown) => { setDeletingId(id); setConfirmOpen(true); };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/sla-rules/${deletingId}`);
      setConfirmOpen(false);
      setDeletingId(null);
      fetchData();
    } catch {
      setConfirmOpen(false);
    }
  };

  if (!canView) {
    return <EmptyState title="无权限" description="您没有查看此页面的权限" />;
  }

  const tableColumns = [
    {
      key: 'dest_warehouse_id', title: '目的仓库',
      render: (value: unknown, row: Record<string, unknown>) => (
        <span className="text-gray-700">{(row as Record<string, unknown>).dest_warehouse_name as string || getWarehouseName(value)}</span>
      ),
    },
    {
      key: 'transport_type', title: '运输方式',
      render: (value: unknown) => <span className="text-gray-700">{transportLabels[String(value)] || String(value)}</span>,
    },
    { key: 'sla_days', title: 'SLA天数' },
    { key: 'shelf_sla_days', title: '上架SLA天数' },
    ...(canManage ? [{
      key: '_actions', title: '操作', width: '120px',
      render: (_value: unknown, row: Record<string, unknown>) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(row)} className="text-blue-600 hover:text-blue-800 text-sm transition-colors cursor-pointer"><Pencil size={14} /></button>
          <button onClick={() => openDelete(row.id)} className="text-red-500 hover:text-red-700 text-sm transition-colors cursor-pointer"><Trash2 size={14} /></button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">SLA规则</h1>
        {canManage && <Button icon={Plus} onClick={openCreate}>新增</Button>}
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">搜索</label>
            <div className="relative">
              <input
                type="text" placeholder="关键词搜索" value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-9 pl-8 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <Button variant="secondary" onClick={handleSearch}>搜索</Button>
        </div>
      </Card>

      <Table columns={tableColumns} data={data} loading={loading} />

      {total > PAGE_SIZE && <Pagination current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />}

      <Modal open={modalOpen} title={editing ? '编辑SLA规则' : '新增SLA规则'} onClose={() => setModalOpen(false)} width="md">
        <div className="space-y-4">
          <FormField label="目的仓库" name="dest_warehouse_id" type="select" value={formData.dest_warehouse_id} onChange={handleFormChange} error={formErrors.dest_warehouse_id} options={warehouseOptions} required placeholder="请选择仓库" />
          <FormField label="运输方式" name="transport_type" type="select" value={formData.transport_type} onChange={handleFormChange} error={formErrors.transport_type} options={columns[1].options} required />
          <FormField label="SLA天数" name="sla_days" type="number" value={formData.sla_days} onChange={handleFormChange} error={formErrors.sla_days} required placeholder="请输入天数" />
          <FormField label="上架SLA天数" name="shelf_sla_days" type="number" value={formData.shelf_sla_days} onChange={handleFormChange} placeholder="默认3天" />
          {formErrors._submit && <p className="text-sm text-red-500">{formErrors._submit}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
            <Button loading={submitting} onClick={handleSubmit}>确定</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmOpen} title="确认删除" onClose={() => setConfirmOpen(false)} width="sm">
        <p className="text-sm text-gray-600 mb-4">确定要删除此SLA规则吗？此操作不可恢复。</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>取消</Button>
          <Button variant="danger" onClick={handleDelete}>删除</Button>
        </div>
      </Modal>
    </div>
  );
}
