import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { TransferStatusLabel, TransportTypeLabel } from 'shared/constants';
import type { TransferStatus, TransportType } from 'shared/constants';

interface OrderRow {
  transfer_no: string;
  inbound_order_no: string;
  from_warehouse: string;
  to_warehouse: string;
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
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_OUTBOUND: 'bg-gray-100 text-gray-700',
  OUTBOUNDED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-orange-100 text-orange-700',
  RECEIVED: 'bg-green-100 text-green-700',
  SHELVED: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-indigo-100 text-indigo-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS: TransferStatus[] = [
  'PENDING_OUTBOUND',
  'OUTBOUNDED',
  'IN_TRANSIT',
  'RECEIVED',
  'SHELVED',
  'COMPLETED',
  'CANCELLED',
];

const TRANSPORT_OPTIONS: TransportType[] = ['SEA', 'AIR', 'RAIL', 'TRUCK'];

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

export default function OrderListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [filters, setFilters] = useState({
    keyword: '',
    status: '',
    from_warehouse: '',
    to_warehouse: '',
    transport_type: '',
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filters.keyword) params.set('keyword', filters.keyword);
      if (filters.status) params.set('status', filters.status);
      if (filters.from_warehouse) params.set('from_warehouse', filters.from_warehouse);
      if (filters.to_warehouse) params.set('to_warehouse', filters.to_warehouse);
      if (filters.transport_type) params.set('transport_type', filters.transport_type);

      const res = await api.get<{
        success: boolean;
        data: OrderRow[];
        pagination: { total: number; page: number; pageSize: number };
      }>(`/orders?${params.toString()}`);
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
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleReset = () => {
    setFilters({
      keyword: '',
      status: '',
      from_warehouse: '',
      to_warehouse: '',
      transport_type: '',
    });
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">调拨单列表</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/imports')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            导入调拨单
          </button>
          <button
            disabled
            className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-md cursor-not-allowed"
          >
            手工创建
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">状态</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {TransferStatusLabel[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">来源仓</label>
            <select
              value={filters.from_warehouse}
              onChange={(e) => setFilters((f) => ({ ...f, from_warehouse: e.target.value }))}
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
            <label className="text-xs text-gray-500">搜索</label>
            <input
              type="text"
              placeholder="调拨单号/入库单号"
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-9 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
            />
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">调拨单号</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">入库单号</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">来源仓 → 目的仓</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">运输类型</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SKU/箱/数量</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">物流商</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">异常</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.transfer_no}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-blue-600">{row.transfer_no}</td>
                    <td className="px-4 py-3 text-gray-700">{row.inbound_order_no}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.from_warehouse} → {row.to_warehouse}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.transport_type ? TransportTypeLabel[row.transport_type as TransportType] || row.transport_type : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {TransferStatusLabel[row.status as TransferStatus] || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.total_sku_count}/{row.total_carton_count}/{row.total_qty}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.logistics_carrier || '--'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {row.is_logistics_abnormal ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            物流异常
                          </span>
                        ) : null}
                        {row.is_shelf_abnormal ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            上架异常
                          </span>
                        ) : null}
                        {!row.is_logistics_abnormal && !row.is_shelf_abnormal ? (
                          <span className="text-gray-400">--</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(row.create_time)}</td>
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
    </div>
  );
}
