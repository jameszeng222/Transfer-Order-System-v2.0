import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Upload, Plus, Download } from 'lucide-react';
import { api } from '../../api/client';
const API_BASE = import.meta.env.VITE_API_URL || '/api';
import { TransferStatusLabel, TransportTypeLabel } from 'shared/constants';
import type { TransferStatus, TransportType } from 'shared/constants';
import { Button, Card, FormField, Table, Badge, Pagination } from '../../components/ui';
import type { ColumnDef } from '../../components/ui';

interface OrderRow {
  transfer_no: string;
  inbound_order_no: string;
  from_warehouse: string;
  to_warehouse: string;
  team: string;
  source: string;
  status: TransferStatus;
  transport_type: TransportType;
  total_sku_count: number;
  total_qty: number;
  total_carton_count: number;
  logistics_carrier: string;
  is_logistics_abnormal: number;
  is_shelf_abnormal: number;
  is_reconciled: number;
  create_time: string;
  pickup_time: string;
  delivery_time: string;
  shelve_time: string;
  expected_arrival_date: string;
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

const STATUS_BADGE_MAP: Record<string, 'pending' | 'shipped' | 'received' | 'transit' | 'abnormal' | 'shelved' | 'complete'> = {
  PENDING_OUTBOUND: 'pending',
  OUTBOUNDED: 'shipped',
  IN_TRANSIT: 'transit',
  RECEIVED: 'received',
  SHELVED: 'shelved',
  COMPLETED: 'complete',
  CANCELLED: 'abnormal',
};

const STATUS_OPTIONS: TransferStatus[] = [
  'PENDING_OUTBOUND', 'OUTBOUNDED', 'IN_TRANSIT', 'RECEIVED', 'SHELVED', 'COMPLETED', 'CANCELLED',
];

const SOURCE_OPTIONS = [
  { label: '万邑通API', value: 'API_WANYITONG' },
  { label: '亚马逊', value: 'API_AMAZON' },
  { label: '手工创建', value: 'MANUAL' },
  { label: '其他', value: 'OTHER' },
];

const TEAM_OPTIONS = [
  { label: '北美组', value: 'NA' },
  { label: '欧洲组', value: 'EU' },
  { label: '亚太组', value: 'APAC' },
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
  source: '',
  team: '',
  abnormal: '',
};

export default function OrderListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

  useEffect(() => {
    api.get<{ success: boolean; data: Warehouse[] }>('/warehouses?pageSize=100')
      .then((res) => { if (res.success && Array.isArray(res.data)) setWarehouses(res.data); })
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
    if (filters.source) params.set('source', filters.source);
    if (filters.team) params.set('team', filters.team);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);

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
  }, [page, pageSize, filters, refreshKey]);

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
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.status) params.set('status', filters.status);
    if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.source) params.set('source', filters.source);
    if (filters.team) params.set('team', filters.team);
    if (filters.abnormal) params.set('abnormal', filters.abnormal);
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
  }, [filters]);

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
      key: 'source',
      title: '来源',
      render: (_, row) => {
        const src = row.source as string;
        if (src === 'API_WANYITONG') return <Badge variant="shipped">万邑通</Badge>;
        if (src === 'API_AMAZON') return <Badge variant="received">亚马逊</Badge>;
        if (src === 'MANUAL') return <Badge variant="pending">手工</Badge>;
        return <Badge variant="pending">{src || '--'}</Badge>;
      },
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
      key: 'status',
      title: '状态',
      render: (_, row) => (
        <Badge variant={STATUS_BADGE_MAP[row.status as string] || 'pending'}>
          {TransferStatusLabel[row.status as TransferStatus] || (row.status as string)}
        </Badge>
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
      key: 'expected_arrival_date',
      title: '预计签收',
      render: (_, row) => {
        const val = row.expected_arrival_date as string;
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
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="primary" icon={Upload} onClick={() => navigate('/imports')}>导入调拨单</Button>
        <Button variant="secondary" icon={Plus} onClick={() => navigate('/orders/new')}>手工创建</Button>
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
            name="source"
            type="select"
            value={filters.source}
            onChange={handleFilterChange}
            placeholder="全部来源"
            options={SOURCE_OPTIONS}
            className="w-[130px]"
          />
          <FormField
            name="team"
            type="select"
            value={filters.team}
            onChange={handleFilterChange}
            placeholder="全部团队"
            options={TEAM_OPTIONS}
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
          <Button icon={Search} onClick={handleSearch}>搜索</Button>
          <Button variant="ghost" icon={RotateCcw} onClick={handleReset}>重置</Button>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-[13px] text-text-tertiary">
          共 <span className="text-text-primary font-semibold">{total}</span> 条调拨单
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>导出Excel</Button>
      </div>

      <Card>
        <Table columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} />
      </Card>

      <Pagination current={page} pageSize={pageSize} total={total} onChange={setPage} />
    </div>
  );
}
