import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { TransportTypeLabel } from 'shared/constants';
import type { TransportType } from 'shared/constants';

interface DashboardData {
  inTransitTotal: number;
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
  transport_type: TransportType;
  logistics_carrier: string;
  logistics_tracking_no: string;
  pickup_time: string;
  sla_days: number;
  expected_arrival: string;
  remaining_days: number | null;
  is_timeout: boolean;
  is_logistics_abnormal: number;
  logistics_abnormal_type: string;
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

const TRANSPORT_OPTIONS: TransportType[] = ['SEA', 'AIR', 'RAIL', 'TRUCK'];

function formatDate(val: string | null | undefined): string {
  if (!val) return '--';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '--';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

  const [filters, setFilters] = useState({
    to_warehouse: '',
    transport_type: '',
    is_timeout: '',
  });

  useEffect(() => {
    api.get<{ success: boolean; data: Warehouse[] }>('/warehouses?pageSize=100')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setWarehouses(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: DashboardData }>('/tracking/dashboard');
      if (res.success) {
        setDashboard(res.data);
      }
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
      if (filters.transport_type) params.set('transport_type', filters.transport_type);
      if (filters.is_timeout) params.set('is_timeout', filters.is_timeout);

      const res = await api.get<{
        success: boolean;
        data: InTransitRow[];
        pagination: { total: number; page: number; pageSize: number };
      }>(`/tracking/intransit?${params.toString()}`);
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
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleReset = () => {
    setFilters({ to_warehouse: '', transport_type: '', is_timeout: '' });
    setPage(1);
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
    if (filters.transport_type) params.set('transport_type', filters.transport_type);
    if (filters.is_timeout) params.set('is_timeout', filters.is_timeout);

    const token = localStorage.getItem('token');
    const res = await fetch(`/api/tracking/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '在途明细.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSlaCheck = async () => {
    try {
      const res = await api.get<{ success: boolean; data: { checkedCount: number; newTimeoutCount: number } }>('/tracking/sla-check');
      if (res.success) {
        setSlaCheckResult(res.data);
        fetchDashboard();
        fetchData();
      }
    } catch {}
  };

  const totalPages = Math.ceil(total / pageSize);

  const maxWarehouseCount = dashboard
    ? Math.max(...dashboard.warehouseDistribution.map((w) => w.count), 1)
    : 1;
  const maxTransportCount = dashboard
    ? Math.max(...dashboard.transportDistribution.map((t) => t.count), 1)
    : 1;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-gray-900">在途追踪</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5 border-l-4 border-l-blue-500">
          <div className="text-sm text-gray-500 mb-1">在途总数</div>
          <div className="text-2xl font-semibold text-gray-900">{dashboard?.inTransitTotal ?? '--'}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 border-l-4 border-l-red-500">
          <div className="text-sm text-gray-500 mb-1">超时预警</div>
          <div className="text-2xl font-semibold text-red-600">{dashboard?.timeoutCount ?? '--'}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 border-l-4 border-l-orange-500">
          <div className="text-sm text-gray-500 mb-1">即将超时</div>
          <div className="text-2xl font-semibold text-orange-600">{dashboard?.approachingCount ?? '--'}</div>
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-sm font-medium text-gray-700 mb-3">按目的仓分布</div>
            <div className="space-y-2">
              {dashboard.warehouseDistribution.map((w) => (
                <div key={w.warehouse} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24 shrink-0 truncate" title={w.warehouse}>{w.warehouse}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${(w.count / maxWarehouseCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{w.count}</span>
                </div>
              ))}
              {dashboard.warehouseDistribution.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">暂无数据</div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-sm font-medium text-gray-700 mb-3">按运输类型分布</div>
            <div className="space-y-2">
              {dashboard.transportDistribution.map((t) => (
                <div key={t.transport_type} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-16 shrink-0">
                    {TransportTypeLabel[t.transport_type as TransportType] || t.transport_type}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${(t.count / maxTransportCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{t.count}</span>
                </div>
              ))}
              {dashboard.transportDistribution.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">暂无数据</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">目的仓</label>
            <select
              value={filters.to_warehouse}
              onChange={(e) => setFilters((f) => ({ ...f, to_warehouse: e.target.value }))}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.warehouse_code}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">运输类型</label>
            <select
              value={filters.transport_type}
              onChange={(e) => setFilters((f) => ({ ...f, transport_type: e.target.value }))}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {TRANSPORT_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TransportTypeLabel[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">是否超时</label>
            <select
              value={filters.is_timeout}
              onChange={(e) => setFilters((f) => ({ ...f, is_timeout: e.target.value }))}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="true">已超时</option>
              <option value="false">未超时</option>
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="h-9 px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            搜索
          </button>
          <button
            onClick={handleReset}
            className="h-9 px-4 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            重置
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">入库单号</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">来源仓→目的仓</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">运输类型</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">物流商/单号</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">提货时间</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">预计签收</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">剩余天数</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">物流异常</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.transfer_no}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      row.is_timeout ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-700">{row.inbound_order_no}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.from_warehouse} → {row.to_warehouse}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.transport_type ? TransportTypeLabel[row.transport_type as TransportType] || row.transport_type : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{row.logistics_carrier || '--'}</div>
                      <div className="text-xs text-gray-400">{row.logistics_tracking_no || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(row.pickup_time)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(row.expected_arrival)}</td>
                    <td className="px-4 py-3">
                      {row.remaining_days !== null ? (
                        <span className={`font-medium ${row.remaining_days <= 0 ? 'text-red-600' : row.remaining_days <= 3 ? 'text-orange-600' : 'text-gray-700'}`}>
                          {row.remaining_days}天
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.is_logistics_abnormal ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {row.logistics_abnormal_type || '物流异常'}
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/orders/${row.transfer_no}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">
              共 {total} 条，第 {page}/{totalPages} 页
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
        >
          导出Excel
        </button>
        <button
          onClick={handleSlaCheck}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
        >
          SLA检查
        </button>
        {slaCheckResult && (
          <span className="text-sm text-gray-600">
            已检查 {slaCheckResult.checkedCount} 条，新增超时标记 {slaCheckResult.newTimeoutCount} 条
          </span>
        )}
      </div>
    </div>
  );
}
