import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ShieldCheck, Search, RotateCcw } from 'lucide-react';
import { api } from '../../api/client';
const API_BASE = import.meta.env.VITE_API_URL || '/api';
import { TransportTypeLabel } from 'shared/constants';
import type { TransportType } from 'shared/constants';
import { StatCard, Card, FormField, Table, Pagination, Button, Badge } from '../../components/ui';
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
  carton_no: string;
  system_sku: string;
  overseas_sku: string;
  qty: number;
  from_warehouse: string;
  to_warehouse: string;
  transport_type: TransportType;
  logistics_carrier: string;
  logistics_tracking_no: string;
  sla_days: number;
  pickup_time: string;
  expected_arrival: string;
  remaining_days: number | null;
  is_timeout: boolean;
  is_logistics_abnormal: number;
  logistics_abnormal_type: string;
  latest_event: string;
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

const TRANSPORT_OPTIONS: TransportType[] = ['SEA', 'AIR', 'RAIL', 'TRUCK'];

const ABNORMAL_OPTIONS = [
  { label: '物流异常', value: 'logistics' },
  { label: '超时', value: 'timeout' },
];

const DEFAULT_FILTERS = {
  keyword: '',
  from_warehouse: '',
  to_warehouse: '',
  transport_type: '',
  abnormal: '',
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
  const [slaCheckResult, setSlaCheckResult] = useState<{ checkedCount: number; newTimeoutCount: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

  useEffect(() => {
    api.get<{ success: boolean; data: Warehouse[] }>('/warehouses?pageSize=100')
      .then((res) => { if (res.success && Array.isArray(res.data)) setWarehouses(res.data); })
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
    if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.transport_type) params.set('transport_type', filters.transport_type);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);

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
  }, [page, pageSize, filters, refreshKey]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleFilterChange = (name: string, value: unknown) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  };

  const handleSearch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.transport_type) params.set('transport_type', filters.transport_type);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/tracking/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '在途明细.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filters]);

  const handleSlaCheck = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: { checkedCount: number; newTimeoutCount: number } }>('/tracking/sla-check');
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
      title: '入库单+箱号',
      render: (_, row) => (
        <div>
          <span
            className="font-medium text-accent cursor-pointer hover:text-accent-hover transition-colors"
            onClick={() => navigate(`/orders/${row.transfer_no as string}`)}
          >
            {(row.inbound_order_no as string) || '--'}
          </span>
          {(row.carton_no as string) && (
            <div className="text-[11px] text-text-tertiary">{row.carton_no as string}</div>
          )}
        </div>
      ),
    },
    { key: 'system_sku', title: '系统SKU', render: (_, row) => (row.system_sku as string) || '--' },
    { key: 'overseas_sku', title: '海外仓SKU', render: (_, row) => (row.overseas_sku as string) || '--' },
    { key: 'qty', title: '数量' },
    { key: 'from_warehouse', title: '发货仓' },
    { key: 'to_warehouse', title: '目的仓' },
    {
      key: 'transport_type',
      title: '运输',
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
      title: '收件日期',
      render: (_, row) => (
        <span className="tabular-nums">{formatDate(row.pickup_time as string)}</span>
      ),
    },
    {
      key: 'expected_arrival',
      title: '预计签收',
      render: (_, row) => {
        const val = row.expected_arrival as string;
        if (!val) return <span className="text-text-tertiary">—</span>;
        const d = new Date(val);
        if (isNaN(d.getTime())) return <span className="text-text-tertiary">—</span>;
        const now = new Date();
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const str = formatDate(val);
        if (diffDays < 0) return <span className="text-red font-medium">{str} ⚠</span>;
        if (diffDays <= 3) return <span className="text-orange">{str}</span>;
        return <span>{str}</span>;
      },
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
            name="from_warehouse"
            type="select"
            value={filters.from_warehouse}
            onChange={handleFilterChange}
            placeholder="全部发货仓"
            options={warehouses.map((w) => ({ label: w.warehouse_name, value: w.warehouse_code }))}
            className="w-[140px]"
          />
          <FormField
            name="to_warehouse"
            type="select"
            value={filters.to_warehouse}
            onChange={handleFilterChange}
            placeholder="全部目的仓"
            options={warehouses.map((w) => ({ label: w.warehouse_name, value: w.warehouse_code }))}
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
          <Button icon={Search} onClick={handleSearch}>搜索</Button>
          <Button variant="ghost" icon={RotateCcw} onClick={handleReset}>重置</Button>
        </div>
      </Card>

      <Card>
        <Table columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} />
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
