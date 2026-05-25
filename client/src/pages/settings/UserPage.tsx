import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { FormField } from '../../components/ui/FormField';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';

interface Team {
  id: number;
  team_code: string;
  team_name: string;
}

interface Role {
  id: number;
  role_code: string;
  role_name: string;
}

const PAGE_SIZE = 20;

export default function UserPage() {
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

  const [teams, setTeams] = useState<Team[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    api.get<{ success: boolean; data: Team[] }>('/teams?pageSize=100')
      .then((res) => { if (res.success) setTeams(res.data || []); })
      .catch(() => {});
    api.get<{ success: boolean; data: Role[] }>('/roles?pageSize=100')
      .then((res) => { if (res.success) setRoles(res.data || []); })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (keyword) params.set('keyword', keyword);
      const res = await api.get<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: { total: number };
      }>(`/users?${params.toString()}`);
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
    setFormData({});
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setFormData({ ...row, password: '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFormChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.username) errors.username = '用户名不能为空';
    if (!formData.name) errors.name = '姓名不能为空';
    if (!editing && !formData.password) errors.password = '密码不能为空';
    if (!formData.role_id) errors.role_id = '角色不能为空';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const submitData = { ...formData };
      if (editing && !submitData.password) {
        delete submitData.password;
      }
      delete (submitData as Record<string, unknown>).password_hash;
      if (editing) {
        await api.put(`/users/${editing.id}`, submitData);
      } else {
        await api.post('/users', submitData);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setFormErrors({ _submit: err instanceof Error ? err.message : '操作失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (id: unknown) => { setDeletingId(id); setConfirmOpen(true); };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/users/${deletingId}`);
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

  const teamOptions = teams.map((t) => ({ label: t.team_name, value: String(t.id) }));
  const roleOptions = roles.map((r) => ({ label: r.role_name, value: String(r.id) }));

  const getTeamName = (id: unknown) => {
    const team = teams.find((t) => String(t.id) === String(id));
    return team?.team_name || String(id || '--');
  };

  const getRoleName = (id: unknown) => {
    const role = roles.find((r) => String(r.id) === String(id));
    return role?.role_name || String(id || '--');
  };

  const tableColumns = [
    { key: 'username', title: '用户名' },
    { key: 'name', title: '姓名' },
    { key: 'phone', title: '手机号' },
    { key: 'email', title: '邮箱' },
    {
      key: 'team_id', title: '团队',
      render: (value: unknown) => <span className="text-gray-700">{getTeamName(value)}</span>,
    },
    {
      key: 'role_id', title: '角色',
      render: (value: unknown) => <span className="text-gray-700">{getRoleName(value)}</span>,
    },
    {
      key: 'is_active', title: '状态',
      render: (value: unknown) => {
        const strVal = String(value ?? '');
        const isActive = strVal === '1' || strVal === 'true';
        return <Badge variant={isActive ? 'received' : 'abnormal'}>{isActive ? '启用' : '停用'}</Badge>;
      },
    },
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
        <h1 className="text-lg font-semibold text-gray-900">用户管理</h1>
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

      <Modal open={modalOpen} title={editing ? '编辑用户' : '新增用户'} onClose={() => setModalOpen(false)} width="md">
        <div className="space-y-4">
          <FormField label="用户名" name="username" value={formData.username} onChange={handleFormChange} error={formErrors.username} required />
          <FormField label="姓名" name="name" value={formData.name} onChange={handleFormChange} error={formErrors.name} required />
          <FormField label="手机号" name="phone" value={formData.phone} onChange={handleFormChange} />
          <FormField label="邮箱" name="email" value={formData.email} onChange={handleFormChange} />
          <FormField label="团队" name="team_id" type="select" value={formData.team_id} onChange={handleFormChange} options={teamOptions} placeholder="请选择团队" />
          <FormField label="角色" name="role_id" type="select" value={formData.role_id} onChange={handleFormChange} error={formErrors.role_id} options={roleOptions} required placeholder="请选择角色" />
          <FormField
            label="密码" name="password" type="password" value={formData.password}
            onChange={handleFormChange} error={formErrors.password}
            required={!editing}
            placeholder={editing ? '不修改请留空' : undefined}
          />
          <FormField label="状态" name="is_active" type="select" value={formData.is_active ?? '1'} onChange={handleFormChange}
            options={[{ label: '启用', value: '1' }, { label: '停用', value: '0' }]} />
          {formErrors._submit && <p className="text-sm text-red-500">{formErrors._submit}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
            <Button loading={submitting} onClick={handleSubmit}>确定</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmOpen} title="确认删除" onClose={() => setConfirmOpen(false)} width="sm">
        <p className="text-sm text-gray-600 mb-4">确定要删除此用户吗？此操作不可恢复。</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>取消</Button>
          <Button variant="danger" onClick={handleDelete}>删除</Button>
        </div>
      </Modal>
    </div>
  );
}
