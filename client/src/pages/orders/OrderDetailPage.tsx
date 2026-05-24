import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { TransferStatusLabel, TransportTypeLabel } from 'shared/constants';
import type { TransferStatus, TransportType } from 'shared/constants';

interface CartonItem {
  id: number;
  carton_no: string;
  sku_code: string;
  sku_name: string;
  overseas_sku_code: string;
  product_name: string;
  qty: number;
  shelf_qty: number;
}

interface Carton {
  id: number;
  carton_no: string;
  logistics_tracking_no: string;
  logistics_carrier_order_no: string;
  carton_length: number;
  carton_width: number;
  carton_height: number;
  carton_weight: number;
  declared_value: number;
  departure_time: string;
  arrival_port_time: string;
  customs_clearance_time: string;
  last_mile_pickup_time: string;
  logistics_sign_time: string;
  unload_time: string;
  shelf_time: string;
  is_shelf_abnormal: number;
  shelf_abnormal_type: string;
  shelf_abnormal_remark: string;
  carton_items: CartonItem[];
}

interface OrderItem {
  id: number;
  sku_code: string;
  sku_name: string;
  expected_qty: number;
  outbound_qty: number;
  inbound_qty: number;
  shelf_qty: number;
  outbound_diff: number;
  inbound_diff: number;
  total_diff: number;
  diff_reason: string;
  unit_weight: number;
  unit_volume: number;
  freight_cost_total: number;
  freight_cost_per_unit: number;
}

interface TrackingEvent {
  id: number;
  event_time: string;
  event_type: string;
  event_desc: string;
  location: string;
  operator: string;
}

interface DiscrepancyRecord {
  id: number;
  carton_no: string;
  sku_code: string;
  discrepancy_category: string;
  discrepancy_type: string;
  discrepancy_qty: number;
  status: string;
  handler: string;
  resolution: string;
}

interface FreightBill {
  id: number;
  bill_no: string;
  logistics_carrier: string;
  freight_fee: number;
  customs_fee: number;
  other_fee: number;
  total_amount: number;
  currency: string;
  exchange_rate: number;
  total_amount_cny: number;
  bill_date: string;
  bill_status: string;
}

interface ChangeLog {
  id: number;
  record_type: string;
  record_id: number;
  field_name: string;
  old_value: string;
  new_value: string;
  change_source: string;
  operator: string;
  change_time: string;
  reason: string;
}

interface OrderDetail {
  id: number;
  transfer_no: string;
  erp_order_no: string;
  outbound_order_no: string;
  inbound_order_no: string;
  from_warehouse: string;
  to_warehouse: string;
  team: string;
  source: string;
  transfer_type: string;
  status: TransferStatus;
  transport_type: TransportType;
  total_sku_count: number;
  total_qty: number;
  total_carton_count: number;
  logistics_status: string;
  expected_arrival_date: string;
  actual_arrival_date: string;
  expected_shelf_date: string;
  logistics_carrier: string;
  logistics_tracking_no: string;
  is_customs_declared: number;
  customs_factory: string;
  is_inspected: number;
  timeline_requirement_days: number;
  order_remark: string;
  last_mile_type: string;
  last_mile_channel: string;
  pickup_time: string;
  depart_time: string;
  arrive_port_time: string;
  clearance_time: string;
  last_mile_pickup_time: string;
  delivery_time: string;
  unload_time: string;
  shelve_time: string;
  is_logistics_abnormal: number;
  logistics_abnormal_type: string;
  logistics_abnormal_remark: string;
  is_shelf_abnormal: number;
  shelf_abnormal_type: string;
  shelf_abnormal_remark: string;
  delay_explanation: string;
  estimated_unit_price: number;
  estimated_freight: number;
  total_freight_amount: number;
  freight_currency: string;
  freight_allocation_method: string;
  is_reconciled: number;
  is_paid: number;
  create_time: string;
  update_time: string;
  remark: string;
  items: OrderItem[];
  cartons: Carton[];
  tracking_events: TrackingEvent[];
  discrepancy_records: DiscrepancyRecord[];
  freight_bills: FreightBill[];
  change_logs: ChangeLog[];
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

const NEXT_STATUS: Record<string, { label: string; value: TransferStatus }> = {
  PENDING_OUTBOUND: { label: '确认出库', value: 'OUTBOUNDED' },
  OUTBOUNDED: { label: '确认在途', value: 'IN_TRANSIT' },
  IN_TRANSIT: { label: '确认签收', value: 'RECEIVED' },
  RECEIVED: { label: '确认上架', value: 'SHELVED' },
  SHELVED: { label: '确认完成', value: 'COMPLETED' },
};

const TABS = ['基础信息', '箱级明细', 'SKU汇总', '物流轨迹', '操作历史'] as const;
type TabName = (typeof TABS)[number];

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

function formatMoney(val: number | null | undefined): string {
  if (val == null) return '--';
  return Number(val).toFixed(2);
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start py-2 border-b border-gray-50">
      <span className="w-32 shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{children}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2 pb-2 border-b border-gray-200">{title}</h3>
      <div className="pl-1">{children}</div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { transferNo } = useParams<{ transferNo: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('基础信息');
  const [expandedCartons, setExpandedCartons] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!transferNo) return;
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: OrderDetail }>(`/orders/${transferNo}`);
      if (res.success) {
        setOrder(res.data);
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [transferNo]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStatusChange = async (newStatus: TransferStatus) => {
    if (!transferNo || !order) return;
    const label = NEXT_STATUS[order.status]?.label || newStatus;
    if (!confirm(`确认执行「${label}」操作？`)) return;
    setActionLoading(true);
    try {
      const res = await api.put<{ success: boolean; data: OrderDetail; error?: string }>(
        `/orders/${transferNo}/status`,
        { status: newStatus }
      );
      if (res.success) {
        await fetchOrder();
      } else {
        alert(res.error || '操作失败');
      }
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleCarton = (cartonNo: string) => {
    setExpandedCartons((prev) => {
      const next = new Set(prev);
      if (next.has(cartonNo)) {
        next.delete(cartonNo);
      } else {
        next.add(cartonNo);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-gray-400">加载中...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-gray-400">调拨单不存在</span>
        <button
          onClick={() => navigate('/orders')}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          返回列表
        </button>
      </div>
    );
  }

  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{order.transfer_no}</h1>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}
          >
            {TransferStatusLabel[order.status] || order.status}
          </span>
        </div>

        <div className="flex gap-2">
          {nextStatus && (
            <button
              onClick={() => handleStatusChange(nextStatus.value)}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? '处理中...' : nextStatus.label}
            </button>
          )}
          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === '基础信息' && (
            <div>
              <SectionCard title="基本信息">
                <FieldRow label="调拨单号">{order.transfer_no}</FieldRow>
                <FieldRow label="入库单号">{order.inbound_order_no}</FieldRow>
                <FieldRow label="ERP订单号">{order.erp_order_no || '--'}</FieldRow>
                <FieldRow label="出库单号">{order.outbound_order_no || '--'}</FieldRow>
                <FieldRow label="来源仓">{order.from_warehouse}</FieldRow>
                <FieldRow label="目的仓">{order.to_warehouse}</FieldRow>
                <FieldRow label="团队">{order.team || '--'}</FieldRow>
                <FieldRow label="来源">{order.source || '--'}</FieldRow>
                <FieldRow label="调拨类型">{order.transfer_type || '--'}</FieldRow>
                <FieldRow label="运输类型">
                  {order.transport_type ? TransportTypeLabel[order.transport_type as TransportType] || order.transport_type : '--'}
                </FieldRow>
                <FieldRow label="状态">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                    {TransferStatusLabel[order.status]}
                  </span>
                </FieldRow>
                <FieldRow label="SKU数">{order.total_sku_count}</FieldRow>
                <FieldRow label="总数量">{order.total_qty}</FieldRow>
                <FieldRow label="箱数">{order.total_carton_count}</FieldRow>
                <FieldRow label="创建时间">{formatDateTime(order.create_time)}</FieldRow>
                <FieldRow label="更新时间">{formatDateTime(order.update_time)}</FieldRow>
                <FieldRow label="备注">{order.remark || '--'}</FieldRow>
                <FieldRow label="订单备注">{order.order_remark || '--'}</FieldRow>
              </SectionCard>

              <SectionCard title="物流信息">
                <FieldRow label="物流商">{order.logistics_carrier || '--'}</FieldRow>
                <FieldRow label="物流跟踪号">{order.logistics_tracking_no || '--'}</FieldRow>
                <FieldRow label="物流状态">{order.logistics_status || '--'}</FieldRow>
                <FieldRow label="是否报关">{order.is_customs_declared ? '是' : '否'}</FieldRow>
                <FieldRow label="报关工厂">{order.customs_factory || '--'}</FieldRow>
                <FieldRow label="是否查验">{order.is_inspected ? '是' : '否'}</FieldRow>
                <FieldRow label="时效要求(天)">{order.timeline_requirement_days ?? '--'}</FieldRow>
                <FieldRow label="末程类型">{order.last_mile_type || '--'}</FieldRow>
                <FieldRow label="末程渠道">{order.last_mile_channel || '--'}</FieldRow>
                <FieldRow label="提货时间">{formatDateTime(order.pickup_time)}</FieldRow>
                <FieldRow label="发车时间">{formatDateTime(order.depart_time)}</FieldRow>
                <FieldRow label="到港时间">{formatDateTime(order.arrive_port_time)}</FieldRow>
                <FieldRow label="清关时间">{formatDateTime(order.clearance_time)}</FieldRow>
                <FieldRow label="末程提货时间">{formatDateTime(order.last_mile_pickup_time)}</FieldRow>
                <FieldRow label="签收时间">{formatDateTime(order.delivery_time)}</FieldRow>
                <FieldRow label="卸货时间">{formatDateTime(order.unload_time)}</FieldRow>
                <FieldRow label="上架时间">{formatDateTime(order.shelve_time)}</FieldRow>
                <FieldRow label="预计到货日期">{order.expected_arrival_date || '--'}</FieldRow>
                <FieldRow label="实际到货日期">{order.actual_arrival_date || '--'}</FieldRow>
                <FieldRow label="预计上架日期">{order.expected_shelf_date || '--'}</FieldRow>
              </SectionCard>

              <SectionCard title="异常信息">
                <FieldRow label="物流异常">{order.is_logistics_abnormal ? '是' : '否'}</FieldRow>
                <FieldRow label="物流异常类型">{order.logistics_abnormal_type || '--'}</FieldRow>
                <FieldRow label="物流异常备注">{order.logistics_abnormal_remark || '--'}</FieldRow>
                <FieldRow label="上架异常">{order.is_shelf_abnormal ? '是' : '否'}</FieldRow>
                <FieldRow label="上架异常类型">{order.shelf_abnormal_type || '--'}</FieldRow>
                <FieldRow label="上架异常备注">{order.shelf_abnormal_remark || '--'}</FieldRow>
                <FieldRow label="延迟说明">{order.delay_explanation || '--'}</FieldRow>
              </SectionCard>

              <SectionCard title="运费信息">
                <FieldRow label="预估单价">{formatMoney(order.estimated_unit_price)}</FieldRow>
                <FieldRow label="预估运费">{formatMoney(order.estimated_freight)}</FieldRow>
                <FieldRow label="运费总额">{formatMoney(order.total_freight_amount)}</FieldRow>
                <FieldRow label="运费币种">{order.freight_currency || '--'}</FieldRow>
                <FieldRow label="运费分摊方式">{order.freight_allocation_method || '--'}</FieldRow>
                <FieldRow label="已对账">{order.is_reconciled ? '是' : '否'}</FieldRow>
                <FieldRow label="已付款">{order.is_paid ? '是' : '否'}</FieldRow>
              </SectionCard>
            </div>
          )}

          {activeTab === '箱级明细' && (
            <div>
              {order.cartons.length === 0 ? (
                <p className="text-center py-8 text-gray-400">暂无箱数据</p>
              ) : (
                <div className="space-y-2">
                  {order.cartons.map((ct) => (
                    <div key={ct.carton_no} className="border border-gray-200 rounded-md">
                      <button
                        onClick={() => toggleCarton(ct.carton_no)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-gray-900">{ct.carton_no}</span>
                          <span className="text-gray-500">跟踪号: {ct.logistics_tracking_no || '--'}</span>
                          {ct.is_shelf_abnormal ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              上架异常
                            </span>
                          ) : null}
                        </div>
                        <span className="text-gray-400">{expandedCartons.has(ct.carton_no) ? '▲' : '▼'}</span>
                      </button>
                      {expandedCartons.has(ct.carton_no) && (
                        <div className="px-4 pb-3">
                          <div className="grid grid-cols-4 gap-2 mb-3 text-xs text-gray-500">
                            <span>尺寸: {ct.carton_length}×{ct.carton_width}×{ct.carton_height}</span>
                            <span>重量: {ct.carton_weight ?? '--'}</span>
                            <span>申报价值: {formatMoney(ct.declared_value)}</span>
                            <span>签收时间: {formatDateTime(ct.logistics_sign_time)}</span>
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="text-left px-2 py-1.5 font-medium text-gray-600">SKU</th>
                                <th className="text-left px-2 py-1.5 font-medium text-gray-600">SKU名称</th>
                                <th className="text-left px-2 py-1.5 font-medium text-gray-600">数量</th>
                                <th className="text-left px-2 py-1.5 font-medium text-gray-600">上架数量</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(ct.carton_items || []).map((ci) => (
                                <tr key={ci.id} className="border-t border-gray-100">
                                  <td className="px-2 py-1.5 text-gray-700">{ci.sku_code}</td>
                                  <td className="px-2 py-1.5 text-gray-700">{ci.sku_name || '--'}</td>
                                  <td className="px-2 py-1.5 text-gray-700">{ci.qty}</td>
                                  <td className="px-2 py-1.5 text-gray-700">{ci.shelf_qty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'SKU汇总' && (
            <div>
              {order.items.length === 0 ? (
                <p className="text-center py-8 text-gray-400">暂无SKU数据</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">SKU</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">名称</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">预期</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">出库</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">入库</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">上架</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">出库差异</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">入库差异</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">总差异</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">差异原因</th>
                      <th className="text-right px-3 py-2.5 font-medium text-gray-600">运费</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-medium">{item.sku_code}</td>
                        <td className="px-3 py-2 text-gray-700">{item.sku_name || '--'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.expected_qty}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.outbound_qty}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.inbound_qty}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.shelf_qty}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.outbound_diff ?? '--'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.inbound_diff ?? '--'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.total_diff ?? '--'}</td>
                        <td className="px-3 py-2 text-gray-700">{item.diff_reason || '--'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{formatMoney(item.freight_cost_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === '物流轨迹' && (
            <div>
              {order.tracking_events.length === 0 ? (
                <p className="text-center py-8 text-gray-400">暂无物流轨迹</p>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
                  {order.tracking_events.map((evt, idx) => (
                    <div key={evt.id} className="relative pb-6 last:pb-0">
                      <div
                        className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 ${
                          idx === 0 ? 'bg-blue-500 border-blue-300' : 'bg-white border-gray-300'
                        }`}
                      />
                      <div className="ml-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-900">
                            {evt.event_type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDateTime(evt.event_time)}
                          </span>
                        </div>
                        {evt.event_desc && (
                          <p className="text-sm text-gray-600">{evt.event_desc}</p>
                        )}
                        <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                          {evt.location && <span>📍 {evt.location}</span>}
                          {evt.operator && <span>👤 {evt.operator}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === '操作历史' && (
            <div>
              {order.change_logs.length === 0 ? (
                <p className="text-center py-8 text-gray-400">暂无操作历史</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">时间</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">操作人</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">来源</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">字段</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">旧值</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">新值</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-600">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.change_logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">{formatDateTime(log.change_time)}</td>
                        <td className="px-3 py-2 text-gray-700">{log.operator}</td>
                        <td className="px-3 py-2 text-gray-700">{log.change_source}</td>
                        <td className="px-3 py-2 text-gray-900 font-medium">{log.field_name}</td>
                        <td className="px-3 py-2 text-gray-500">{log.old_value || '--'}</td>
                        <td className="px-3 py-2 text-gray-900">{log.new_value || '--'}</td>
                        <td className="px-3 py-2 text-gray-500">{log.reason || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
