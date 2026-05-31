import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ShieldCheck, Search, RotateCcw } from 'lucide-react';
import { api, API_BASE } from '../../api/client';
import { TransportTypeLabel, TransferStatusLabel } from 'shared/constants';
import type { TransportType, TransferStatus } from 'shared/constants';
import { StatCard, Card, FormField, Table, Pagination, Button, Badge, TimeFilterPanel } from '../../components/ui';
import type { ColumnDef } from '../../components/ui';

interface DashboardData {
  inTransitTotal: number;
  inTransitCartonCount: number;
  logisticsAbnormalCount: number;
  timeoutCount: number;
  approachingCount: number;
  warehouseDistribution: { warehouse: string; count: number }[];
  transportDistribution: { transport_type: string; count: number }[];
  recentTrend: { date: string; count: number }[];
}

interface InTransitRow {
  id: number;
  transfer_no: string;
  inbound_order_no: string;
  from_warehouse: string;
  to_warehouse: string;
  status: string;
  transport_type: TransportType;
  logistics_carrier: string;
  logistics_tracking_no: string;
  timeline_requirement_days: number;
  sla_days: number;
  pickup_time: string;
  expected_arrival: string;
  expected_shelf_date: string;
  remaining_days: number | null;
  is_timeout: boolean;
  is_logistics_abnormal: number;
  logistics_abnormal_type: string;
  latest_event: string;
  shelf_time: string;
  carton_items: { carton_no: string | null; system_sku: string; overseas_sku: string; qty: number }[];
  carton_outbound_qty: number;
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

const TRANSPORT_OPTIONS: TransportType[] = ['SEA', 'AIR', 'RAIL', 'TRUCK', 'EXPRESS', 'FAST_SEA', 'SPECIAL'];

const STATUS_OPTIONS: TransferStatus[] = [
  'PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED', 'CANCELLED',
];

const ABNORMAL_OPTIONS = [
  { label: '物流异常', value: 'logistics' },
  { label: '超时', value: 'timeout' },
];

const DEFAULT_FILTERS = {
  keyword: '',
  status: '',
  from_warehouse: '',
  to_warehouse: '',
  transport_type: '',
  abnormal: '',
  logistics_carrier: '',
  team: '',
};

const DEFAULT_TIME_FILTERS = {
  createTimeRange: { start: '', end: '' },
  departureTimeRange: { start: '', end: '' },
  pickupTimeRange: { start: '', end: '' },
  logisticsSignTimeRange: { start: '', end: '' },
  shelfTimeRange: { start: '', end: '' },
};

function formatDate(val: string | null | undefined): string {
  if (!val) return '--';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '--';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TrackingPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [data, setData] = useState<InTransitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [carriers, setCarriers] = useState<{ id: number; carrier_name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: number; team_name: string }[]>([]);
  const [slaCheckResult, setSlaCheckResult] = useState<{ checkedCount: number; newTimeoutCount: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [timeFilters, setTimeFilters] = useState({ ...DEFAULT_TIME_FILTERS });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<{ success: boolean; data: Warehouse[] }>('/warehouses?pageSize=100&is_active=true')
      .then((res) => { if (res.success && Array.isArray(res.data)) setWarehouses(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ success: boolean; data: { id: number; carrier_name: string }[] }>('/carriers?pageSize=100&is_active=true')
      .then((res) => { if (res.success && Array.isArray(res.data)) setCarriers(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ success: boolean; data: { id: number; team_name: string }[] }>('/teams?pageSize=100&is_active=true')
      .then((res) => { if (res.success && Array.isArray(res.data)) setTeams(res.data); })
      .catch(() => {});
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: DashboardData }>('/tracking/dashboard');
      if (res.success) setDashboard(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.status) params.set('status', filters.status);
    if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.transport_type) params.set('transport_type', filters.transport_type);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);
    if (filters.logistics_carrier) params.set('logistics_carrier', filters.logistics_carrier);
    if (filters.team) params.set('team', filters.team);
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
      data: InTransitRow[];
      pagination: { total: number; page: number; pageSize: number };
    }>(`/tracking/intransit?${params.toString()}`)
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

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

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
    if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.transport_type) params.set('transport_type', filters.transport_type);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);
    if (filters.logistics_carrier) params.set('logistics_carrier', filters.logistics_carrier);
    if (filters.team) params.set('team', filters.team);
    if (selectedKeys.size > 0) params.set('transfer_nos', Array.from(selectedKeys).join(','));
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/tracking/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text();
        alert('导出失败: ' + (text || res.statusText));
        return;
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        alert('导出数据为空');
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '在途明细.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出失败');
    }
  }, [filters, selectedKeys]);

  const handleSlaCheck = useCallback(async () => {
    try {
      const res = await api.post<{ success: boolean; data: { checkedCount: number; newTimeoutCount: number } }>('/tracking/sla-check', {});
      if (res.success) {
        setSlaCheckResult(res.data);
        fetchDashboard();
        setRefreshKey((k) => k + 1);
      }
    } catch {}
  }, [fetchDashboard]);

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
    {
      key: 'transfer_no',
      title: '调拨单号',
      render: (_, row) => <span>{(row.transfer_no as string) || '--'}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (_, row) => {
        const s = row.status as string;
        if (s === 'OUTBOUNDED') return <Badge variant="shipped">已出库</Badge>;
        if (s === 'IN_TRANSIT') return <Badge variant="transit">在途</Badge>;
        if (s === 'RECEIVED') return <Badge variant="received">已到仓</Badge>;
        if (s === 'SHELVED') return <Badge variant="shelved">已上架</Badge>;
        return <Badge variant="pending">{s}</Badge>;
      },
    },
    {
      key: 'system_sku',
      title: '系统SKU',
      render: (_, row) => {
        const items = row.carton_items as InTransitRow['carton_items'];
        if (!items || items.length === 0) return '--';
        const skus = [...new Set(items.map(i => i.system_sku).filter(Boolean))];
        return <span className="text-xs">{skus.join(', ')}</span>;
      },
    },
    {
      key: 'overseas_sku',
      title: '海外仓SKU',
      render: (_, row) => {
        const items = row.carton_items as InTransitRow['carton_items'];
        if (!items || items.length === 0) return '--';
        const skus = [...new Set(items.map(i => i.overseas_sku).filter(Boolean))];
        return <span className="text-xs">{skus.join(', ')}</span>;
      },
    },
    {
      key: 'outbound_qty',
      title: '实发数量',
      render: (_, row) => {
        return <span>{row.carton_outbound_qty ? String(row.carton_outbound_qty) : '--'}</span>;
      },
    },
    { key: 'from_warehouse', title: '发货仓库' },
    { key: 'to_warehouse', title: '目的仓库' },
    {
      key: 'transport_type',
      title: '运输类型',
      render: (_, row) => {
        const t = row.transport_type as TransportType;
        return t ? (TransportTypeLabel[t] || t) : '--';
      },
    },
    {
      key: 'sla_days',
      title: '时效要求',
      render: (_, row) => {
        const days = row.sla_days as number;
        return days ? `${days}天` : '--';
      },
    },
    {
      key: 'pickup_time',
      title: '发货日期',
      render: (_, row) => (
        <span className="tabular-nums">{formatDate(row.pickup_time as string)}</span>
      ),
    },
    {
      key: 'expected_arrival',
      title: '预计上架',
      render: (_, row) => {
        const val = row.expected_shelf_date as string || row.expected_arrival as string;
        if (!val) return <span className="text-text-tertiary">—</span>;
        const d = new Date(val);
        if (isNaN(d.getTime())) return <span className="text-text-tertiary">—</span>;
        const now = new Date();
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const str = formatDate(val);
        const isPastDue = row.is_timeout;
        return (
          <span className="inline-flex items-center gap-1.5">
            {diffDays < 0 ? <span className="text-red font-medium">{str} ⚠</span> :
             diffDays <= 3 ? <span className="text-orange">{str}</span> :
             <span>{str}</span>}
            {isPastDue ? <Badge variant="abnormal">超时</Badge> : null}
          </span>
        );
      },
    },
    {
      key: 'shelf_time',
      title: '上架时间',
      render: (_, row) => (
        <span className="tabular-nums">{formatDate(row.shelf_time as string)}</span>
      ),
    },
    {
      key: 'latest_event',
      title: '最新节点',
      render: (_, row) => (row.latest_event as string) || '--',
    },
    {
      key: 'is_logistics_abnormal',
      title: '异常',
      render: (_, row) => {
        const abnormal = row.is_logistics_abnormal as number;
        return abnormal
          ? <Badge variant="abnormal">{(row.logistics_abnormal_type as string) || '异常'}</Badge>
          : <span className="text-text-tertiary">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="在途单数" value={dashboard?.inTransitTotal ?? '--'} color="orange" />
        <StatCard label="在途箱数" value={dashboard?.inTransitCartonCount ?? '--'} color="blue" />
        <StatCard label="物流异常" value={dashboard?.logisticsAbnormalCount ?? '--'} color="red" />
        <StatCard label="超时预警" value={dashboard?.timeoutCount ?? '--'} color="orange" />
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            name="keyword"
            type="text"
            value={filters.keyword}
            onChange={handleFilterChange}
            placeholder="搜索入库单号/箱号/SKU"
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
            placeholder="全部发货仓库"
            options={warehouses.map((w) => ({ label: w.warehouse_name, value: w.warehouse_name }))}
            className="w-[140px]"
          />
          <FormField
            name="to_warehouse"
            type="select"
            value={filters.to_warehouse}
            onChange={handleFilterChange}
            placeholder="全部目的仓库"
            options={warehouses.map((w) => ({ label: w.warehouse_name, value: w.warehouse_name }))}
            className="w-[140px]"
          />
          <FormField
            name="transport_type"
            type="select"
            value={filters.transport_type}
            onChange={handleFilterChange}
            placeholder="全部运输类型"
            options={TRANSPORT_OPTIONS.map((t) => ({ label: TransportTypeLabel[t], value: t }))}
            className="w-[140px]"
          />
          <FormField
            name="abnormal"
            type="select"
            value={filters.abnormal}
            onChange={handleFilterChange}
            placeholder="全部异常"
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
          <FormField
            name="team"
            type="select"
            value={filters.team}
            onChange={handleFilterChange}
            placeholder="全部团队"
            options={teams.map(t => ({ label: t.team_name, value: t.team_name }))}
            className="w-[130px]"
          />
          <Button icon={Search} onClick={handleSearch}>搜索</Button>
          <Button variant="ghost" icon={RotateCcw} onClick={handleReset}>重置</Button>
          <TimeFilterPanel filters={timeFilters} onChange={setTimeFilters} />
        </div>
      </Card>

      <Card>
        <Table columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} selectable rowKey="transfer_no" selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
      </Card>

      <Pagination current={page} pageSize={pageSize} total={total} onChange={setPage} />

      <div className="flex items-center gap-3">
        <Button icon={Download} onClick={handleExport}>导出在途明细</Button>
        <Button variant="secondary" icon={ShieldCheck} onClick={handleSlaCheck}>SLA检查</Button>
        {slaCheckResult && (
          <span className="text-xs text-text-tertiary">
            已检查 {slaCheckResult.checkedCount} 条，新增超时 {slaCheckResult.newTimeoutCount} 条
          </span>
        )}
      </div>
    </div>
  );
}
