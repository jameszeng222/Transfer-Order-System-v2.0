import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Upload, Download } from 'lucide-react';
import { api, API_BASE } from '../../api/client';
import { TransferStatusLabel, TransportTypeLabel, StatusBadgeMap } from 'shared/constants';
import type { TransferStatus, TransportType } from 'shared/constants';
import { Button, Card, FormField, Table, Badge, Pagination, TimeFilterPanel } from '../../components/ui';
import type { ColumnDef } from '../../components/ui';

interface OrderRow {
  transfer_no: string;
  inbound_order_no: string;
  from_warehouse: string;
  to_warehouse: string;
  team: string;
  status: TransferStatus;
  transport_type: TransportType;
  total_sku_count: number;
  total_qty: number;
  total_carton_count: number;
  logistics_carrier: string;
  is_logistics_abnormal: number;
  is_shelf_abnormal: number;
  is_reconciled: number;
  is_timeout_warning: boolean;
  create_time: string;
  pickup_time: string;
  logistics_sign_time: string;
  shelf_time: string;
  expected_arrival_date: string;
  expected_shelf_date: string;
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

const STATUS_OPTIONS: TransferStatus[] = [
  'PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED', 'CANCELLED',
];

const ABNORMAL_OPTIONS = [
  { label: '仅物流异常', value: 'logistics' },
  { label: '仅上架异常', value: 'shelf' },
  { label: '仅超时', value: 'timeout' },
];

const DEFAULT_FILTERS = {
  keyword: '',
  status: '',
  from_warehouse: '',
  to_warehouse: '',
  team: '',
  abnormal: '',
  logistics_carrier: '',
};

const NEXT_STATUS_LABELS: Record<string, string> = {
  OUTBOUNDED: '确认出库',
  IN_TRANSIT: '确认在途',
  RECEIVED: '确认签收',
  SHELVED: '确认上架',
  COMPLETED: '确认完成',
  CANCELLED: '取消',
};

const STATUS_FLOW: Record<string, string[]> = {
  PENDING_OUTBOUND: ['OUTBOUNDED', 'CANCELLED'],
  OUTBOUNDED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['SHELVED', 'CANCELLED'],
  SHELVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const DEFAULT_TIME_FILTERS = {
  createTimeRange: { start: '', end: '' },
  departureTimeRange: { start: '', end: '' },
  pickupTimeRange: { start: '', end: '' },
  logisticsSignTimeRange: { start: '', end: '' },
  shelfTimeRange: { start: '', end: '' },
};

export default function OrderListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [carriers, setCarriers] = useState<{ id: number; carrier_name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: number; team_name: string }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [timeFilters, setTimeFilters] = useState({ ...DEFAULT_TIME_FILTERS });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ success: boolean; data: Warehouse[] }>('/warehouses?pageSize=100')
      .then((res) => { if (res.success && Array.isArray(res.data)) setWarehouses(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ success: boolean; data: { id: number; carrier_name: string }[] }>('/carriers?pageSize=100')
      .then((res) => { if (res.success && Array.isArray(res.data)) setCarriers(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ success: boolean; data: { id: number; team_name: string }[] }>('/teams?pageSize=100')
      .then((res) => { if (res.success && Array.isArray(res.data)) setTeams(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.status) params.set('status', filters.status);
    if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.team) params.set('team', filters.team);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);
    if (filters.logistics_carrier) params.set('logistics_carrier', filters.logistics_carrier);
    if (timeFilters.createTimeRange.start) params.set('create_time_start', timeFilters.createTimeRange.start);
    if (timeFilters.createTimeRange.end) params.set('create_time_end', timeFilters.createTimeRange.end);
    if (timeFilters.departureTimeRange.start) params.set('departure_time_start', timeFilters.departureTimeRange.start);
    if (timeFilters.departureTimeRange.end) params.set('departure_time_end', timeFilters.departureTimeRange.end);
    if (timeFilters.pickupTimeRange.start) params.set('pickup_time_start', timeFilters.pickupTimeRange.start);
    if (timeFilters.pickupTimeRange.end) params.set('pickup_time_end', timeFilters.pickupTimeRange.end);
    if (timeFilters.logisticsSignTimeRange.start) params.set('logistics_sign_time_start', timeFilters.logisticsSignTimeRange.start);
    if (timeFilters.logisticsSignTimeRange.end) params.set('logistics_sign_time_end', timeFilters.logisticsSignTimeRange.end);
    if (timeFilters.shelfTimeRange.start) params.set('shelf_time_start', timeFilters.shelfTimeRange.start);
    if (timeFilters.shelfTimeRange.end) params.set('shelf_time_end', timeFilters.shelfTimeRange.end);

    api.get<{
      success: boolean;
      data: OrderRow[];
      pagination: { total: number; page: number; pageSize: number };
    }>(`/orders?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setData(res.data || []);
          setTotal(res.pagination?.total || 0);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setData([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, pageSize, filters, refreshKey, timeFilters]);

  const handleFilterChange = (name: string, value: unknown) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  };

  const handleSearch = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setSelectedKeys(new Set());
  }, []);

  const handleReset = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setTimeFilters({ ...DEFAULT_TIME_FILTERS });
    setPage(1);
    setSelectedKeys(new Set());
  }, []);

  const handleExport = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.status) params.set('status', filters.status);
    if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.team) params.set('team', filters.team);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);
    if (selectedKeys.size > 0) params.set('transfer_nos', Array.from(selectedKeys).join(','));
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/orders/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '调拨单列表.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filters, selectedKeys]);

  const handleStatusChange = async (transferNo: string, newStatus: TransferStatus) => {
    const label = NEXT_STATUS_LABELS[newStatus] || newStatus;
    if (!confirm(`确认执行「${label}」操作？`)) return;
    try {
      const res = await api.put<{ success: boolean; error?: string }>('/orders/status', { transferNo, status: newStatus });
      if (res.success) setRefreshKey(k => k + 1);
      else alert(res.error || '操作失败');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleBatchStatusChange = async (newStatus: TransferStatus) => {
    const label = NEXT_STATUS_LABELS[newStatus] || newStatus;
    if (!confirm(`确认对 ${selectedKeys.size} 个调拨单执行「${label}」操作？`)) return;
    setBatchLoading(true);
    try {
      const res = await api.put<{ success: boolean; error?: string }>('/orders/batch-status', { transferNos: Array.from(selectedKeys), status: newStatus });
      if (res.success) { setSelectedKeys(new Set()); setRefreshKey(k => k + 1); }
      else alert(res.error || '操作失败');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally { setBatchLoading(false); }
  };

  const selectedOrders = data.filter(r => selectedKeys.has(r.transfer_no));

  const getBatchActions = (orders: OrderRow[]) => {
    if (orders.length === 0) return [];
    const allStatuses = new Set(orders.map(o => o.status));
    const commonNext = new Set<string>();
    let first = true;
    for (const s of allStatuses) {
      const next = STATUS_FLOW[s] || [];
      if (first) { next.forEach(n => commonNext.add(n)); first = false; }
      else { for (const n of commonNext) { if (!next.includes(n)) commonNext.delete(n); } }
    }
    return Array.from(commonNext).map(s => ({ value: s, label: NEXT_STATUS_LABELS[s] || s }));
  };

  const columns: ColumnDef[] = [
    {
      key: 'inbound_order_no',
      title: '第三方入库单号',
      render: (_, row) => (
        <span
          className="font-medium text-accent cursor-pointer hover:text-accent-hover transition-colors"
          onClick={() => navigate(`/orders/detail?transferNo=${row.transfer_no as string}`)}
        >
          {(row.inbound_order_no as string) || '--'}
        </span>
      ),
    },
    { key: 'transfer_no', title: '调拨单号' },
    {
      key: 'logistics_carrier',
      title: '物流商',
      render: (_, row) => (row.logistics_carrier as string) || '--',
    },
    { key: 'from_warehouse', title: '发货仓' },
    { key: 'to_warehouse', title: '目的仓' },
    { key: 'team', title: '团队', render: (_, row) => (row.team as string) || '--' },
    {
      key: 'transport_type',
      title: '运输',
      render: (_, row) => {
        const t = row.transport_type as TransportType;
        return t ? (TransportTypeLabel[t] || t) : '--';
      },
    },
    { key: 'total_carton_count', title: '箱数' },
    { key: 'total_qty', title: '计划数量' },
    {
      key: 'create_time',
      title: '创建时间',
      render: (_, row) => {
        const val = row.create_time as string;
        if (!val) return <span className="text-text-tertiary">—</span>;
        const d = new Date(val);
        if (isNaN(d.getTime())) return <span className="text-text-tertiary">—</span>;
        return <span className="text-xs tabular-nums">{d.toLocaleDateString('zh-CN')}</span>;
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (_, row) => (
        <span className="inline-flex items-center gap-1.5">
          <Badge variant={StatusBadgeMap[row.status as TransferStatus] || 'pending'}>
            {TransferStatusLabel[row.status as TransferStatus] || (row.status as string)}
          </Badge>
          {row.is_timeout_warning ? <Badge variant="abnormal">超时</Badge> : null}
        </span>
      ),
    },
    {
      key: 'is_logistics_abnormal',
      title: '异常',
      render: (_, row) => {
        const hasLogistics = row.is_logistics_abnormal as number;
        const hasShelf = row.is_shelf_abnormal as number;
        return (
          <div className="flex gap-1">
            {hasLogistics ? <Badge variant="abnormal">物流异常</Badge> : null}
            {hasShelf ? <Badge variant="abnormal">上架异常</Badge> : null}
            {!hasLogistics && !hasShelf ? <span className="text-text-tertiary">—</span> : null}
          </div>
        );
      },
    },
    {
      key: 'expected_shelf_date',
      title: '预计上架',
      render: (_, row) => {
        const val = row.expected_shelf_date as string;
        if (!val) return <span className="text-text-tertiary">—</span>;
        const d = new Date(val);
        if (isNaN(d.getTime())) return <span className="text-text-tertiary">—</span>;
        const now = new Date();
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const str = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (diffDays < 0) return <span className="text-red font-medium">{str} ⚠</span>;
        if (diffDays <= 3) return <span className="text-orange">{str}</span>;
        return <span>{str}</span>;
      },
    },
    {
      key: 'shelf_time',
      title: '上架时间',
      render: (_, row) => {
        const val = row.shelf_time as string;
        if (!val) return <span className="text-text-tertiary">—</span>;
        const d = new Date(val);
        if (isNaN(d.getTime())) return <span className="text-text-tertiary">—</span>;
        return <span className="text-xs tabular-nums">{d.toLocaleDateString('zh-CN')}</span>;
      },
    },
    {
      key: '_actions',
      title: '操作',
      width: '80px',
      render: (_, row) => {
        const status = row.status as TransferStatus;
        const allowedNext = STATUS_FLOW[status] || [];
        if (allowedNext.length === 0) return null;
        const key = row.transfer_no as string;
        const isOpen = openMenuKey === key;
        return (
          <div className="relative">
            <button className="text-xs text-accent hover:text-accent-hover" onClick={() => setOpenMenuKey(isOpen ? null : key)}>操作 ▾</button>
            {isOpen && (
              <>
                <div className="fixed inset-0 z-[5]" onClick={() => setOpenMenuKey(null)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1 z-10 min-w-[100px]">
                  {allowedNext.map(s => (
                    <button key={s} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover" onClick={() => { setOpenMenuKey(null); handleStatusChange(row.transfer_no as string, s as TransferStatus); }}>
                      {NEXT_STATUS_LABELS[s] || s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="primary" icon={Upload} onClick={() => navigate('/imports')}>导入调拨单</Button>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            name="keyword"
            type="text"
            value={filters.keyword}
            onChange={handleFilterChange}
            placeholder="搜索入库单号/调拨单号/SKU"
            className="w-[220px]"
          />
          <FormField
            name="status"
            type="select"
            value={filters.status}
            onChange={handleFilterChange}
            placeholder="全部状态"
            options={STATUS_OPTIONS.map((s) => ({ label: TransferStatusLabel[s], value: s }))}
            className="w-[130px]"
          />
          <FormField
            name="from_warehouse"
            type="select"
            value={filters.from_warehouse}
            onChange={handleFilterChange}
            placeholder="全部发货仓"
            options={warehouses.map((w) => ({ label: w.warehouse_name, value: w.warehouse_name }))}
            className="w-[140px]"
          />
          <FormField
            name="to_warehouse"
            type="select"
            value={filters.to_warehouse}
            onChange={handleFilterChange}
            placeholder="全部目的仓"
            options={warehouses.map((w) => ({ label: w.warehouse_name, value: w.warehouse_name }))}
            className="w-[140px]"
          />
          <FormField
            name="team"
            type="select"
            value={filters.team}
            onChange={handleFilterChange}
            placeholder="全部团队"
            options={teams.map(t => ({ label: t.team_name, value: t.team_name }))}
            className="w-[130px]"
          />
          <FormField
            name="abnormal"
            type="select"
            value={filters.abnormal}
            onChange={handleFilterChange}
            placeholder="异常筛选"
            options={ABNORMAL_OPTIONS}
            className="w-[130px]"
          />
          <FormField
            name="logistics_carrier"
            type="select"
            value={filters.logistics_carrier}
            onChange={handleFilterChange}
            placeholder="全部物流商"
            options={carriers.map(c => ({ label: c.carrier_name, value: c.carrier_name }))}
            className="w-[140px]"
          />
          <Button icon={Search} onClick={handleSearch}>搜索</Button>
          <Button variant="ghost" icon={RotateCcw} onClick={handleReset}>重置</Button>
          <TimeFilterPanel filters={timeFilters} onChange={setTimeFilters} />
        </div>
      </Card>

      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-xs text-blue-700">已选择 {selectedKeys.size} 项</span>
          {getBatchActions(selectedOrders).map(action => (
            <Button key={action.value} size="sm" onClick={() => handleBatchStatusChange(action.value as TransferStatus)} loading={batchLoading}>
              {action.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set())}>取消选择</Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[13px] text-text-tertiary">
          共 <span className="text-text-primary font-semibold">{total}</span> 条调拨单
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>导出Excel</Button>
      </div>

      <Card>
        <Table columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} selectable rowKey="transfer_no" selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
      </Card>

      <Pagination current={page} pageSize={pageSize} total={total} onChange={setPage} />
    </div>
  );
}
