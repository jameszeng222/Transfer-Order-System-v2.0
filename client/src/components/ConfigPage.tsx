import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Table } from './ui/Table';
import { FormField } from './ui/FormField';
import { Pagination } from './ui/Pagination';
import { EmptyState } from './ui/EmptyState';

interface ColumnDef {
  key: string;
  title: string;
  type?: 'text' | 'select' | 'number' | 'date' | 'switch' | 'badge';
  options?: { label: string; value: string }[];
  badgeColors?: Record<string, string>;
  required?: boolean;
  width?: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  hideInTable?: boolean;
  hideInForm?: boolean;
}

interface FilterField {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

interface ConfigPageProps {
  title: string;
  apiPath: string;
  columns: ColumnDef[];
  defaultSort?: { key: string; order: 'asc' | 'desc' };
  searchFields?: string[];
  filterFields?: FilterField[];
  permissionPrefix?: string;
  createTitle?: string;
  editTitle?: string;
}

const PAGE_SIZE = 20;

export default function ConfigPage({
  title,
  apiPath,
  columns,
  searchFields = [],
  filterFields = [],
  permissionPrefix,
  createTitle = '新增',
  editTitle = '编辑',
}: ConfigPageProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = !permissionPrefix || hasPermission(`${permissionPrefix}.view`);
  const canManage = !permissionPrefix || hasPermission(`${permissionPrefix}.manage`);

  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<unknown>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (keyword) params.set('keyword', keyword);
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }

      const res = await api.get<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: { total: number };
      }>(`${apiPath}?${params.toString()}`);
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
  }, [apiPath, page, keyword, filters]);

  useEffect(() => {
    if (canView) fetchData();
  }, [canView, fetchData]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({});
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
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    for (const col of columns) {
      if (col.required && !col.hideInForm) {
        const val = formData[col.key];
        if (val === undefined || val === null || val === '' || val === 0) {
          errors[col.key] = `${col.title}不能为空`;
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`${apiPath}/${editing.id}`, formData);
      } else {
        await api.post(apiPath, formData);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setFormErrors({ _submit: err instanceof Error ? err.message : '操作失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (id: unknown) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`${apiPath}/${deletingId}`);
      setConfirmOpen(false);
      setDeletingId(null);
      fetchData();
    } catch {
      setConfirmOpen(false);
    }
  };

  if (!canView) {
    return (
      <EmptyState
        title="无权限"
        description="您没有查看此页面的权限"
      />
    );
  }

  const formColumns = columns.filter((c) => !c.hideInForm);

  const tableColumns: ColumnDef[] = [
    ...columns
      .filter((c) => !c.hideInTable)
      .map((col) => ({
        key: col.key,
        title: col.title,
        width: col.width,
        render: col.render
          ? col.render
          : col.type === 'badge'
            ? (value: unknown) => {
                const strVal = String(value ?? '');
                const label =
                  col.options?.find((o) => o.value === strVal)?.label || strVal;
                const colorClass = col.badgeColors?.[strVal];
                return <Badge color={colorClass}>{label}</Badge>;
              }
            : col.type === 'switch'
              ? (value: unknown) => (
                  <Badge variant={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Badge>
                )
              : undefined,
      })),
    ...(canManage
      ? [
          {
            key: '_actions',
            title: '操作',
            width: '120px',
            render: (_value: unknown, row: Record<string, unknown>) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(row)}
                  className="text-blue-600 hover:text-blue-800 text-sm transition-colors cursor-pointer"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => openDelete(row.id)}
                  className="text-red-500 hover:text-red-700 text-sm transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {canManage && (
          <Button icon={Plus} onClick={openCreate}>
            {createTitle}
          </Button>
        )}
      </div>

      {(searchFields.length > 0 || filterFields.length > 0) && (
        <Card padding="sm">
          <div className="flex flex-wrap items-end gap-3">
            {searchFields.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">搜索</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="关键词搜索"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-9 pl-8 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                  />
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>
            )}
            {filterFields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{f.label}</label>
                <select
                  value={filters[f.key] || ''}
                  onChange={(e) => handleFilterChange(f.key, e.target.value)}
                  className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">全部</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button variant="secondary" onClick={handleSearch}>
              搜索
            </Button>
          </div>
        </Card>
      )}

      <Table columns={tableColumns} data={data} loading={loading} />

      {total > PAGE_SIZE && (
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={total}
          onChange={setPage}
        />
      )}

      <Modal
        open={modalOpen}
        title={editing ? editTitle : createTitle}
        onClose={() => setModalOpen(false)}
        width="md"
      >
        <div className="space-y-4">
          {formColumns.map((col) => (
            <FormField
              key={col.key}
              label={col.title}
              name={col.key}
              type={col.type === 'badge' ? 'select' : col.type || 'text'}
              value={formData[col.key]}
              onChange={handleFormChange}
              error={formErrors[col.key]}
              required={col.required}
              options={col.options}
            />
          ))}
          {formErrors._submit && (
            <p className="text-sm text-red-500">{formErrors._submit}</p>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              取消
            </Button>
            <Button loading={submitting} onClick={handleSubmit}>
              确定
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        title="确认删除"
        onClose={() => setConfirmOpen(false)}
        width="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          确定要删除此记录吗？此操作不可恢复。
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(false)}
          >
            取消
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            删除
          </Button>
        </div>
      </Modal>
    </div>
  );
}
