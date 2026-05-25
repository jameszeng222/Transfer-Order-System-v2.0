import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import { TransferStatusLabel, TransportTypeLabel } from 'shared/constants';
import type { TransferStatus, TransportType } from 'shared/constants';
import { Button, Card, Badge, Table, EmptyState } from '../../components/ui';
import type { ColumnDef } from '../../components/ui';

interface CartonItem { id: number; carton_no: string; sku_code: string; sku_name: string; overseas_sku_code: string; product_name: string; qty: number; shelf_qty: number; }
interface Carton { id: number; carton_no: string; logistics_tracking_no: string; logistics_carrier_order_no: string; carton_length: number; carton_width: number; carton_height: number; carton_weight: number; declared_value: number; departure_time: string; arrival_port_time: string; customs_clearance_time: string; last_mile_pickup_time: string; logistics_sign_time: string; unload_time: string; shelf_time: string; is_shelf_abnormal: number; shelf_abnormal_type: string; shelf_abnormal_remark: string; carton_items: CartonItem[]; }
interface OrderItem { id: number; sku_code: string; sku_name: string; overseas_sku_code: string; expected_qty: number; outbound_qty: number; inbound_qty: number; shelf_qty: number; outbound_diff: number; inbound_diff: number; total_diff: number; diff_reason: string; unit_weight: number; unit_volume: number; freight_cost_total: number; freight_cost_per_unit: number; }
interface TrackingEvent { id: number; event_time: string; event_type: string; event_desc: string; location: string; operator: string; }
interface ChangeLog { id: number; record_type: string; record_id: number; field_name: string; old_value: string; new_value: string; change_source: string; operator: string; change_time: string; reason: string; }

interface OrderDetail {
  id: number; transfer_no: string; erp_order_no: string; outbound_order_no: string; inbound_order_no: string;
  from_warehouse: string; to_warehouse: string; team: string; source: string; transfer_type: string;
  status: TransferStatus; transport_type: TransportType; total_sku_count: number; total_qty: number;
  total_carton_count: number; logistics_status: string; expected_arrival_date: string; actual_arrival_date: string;
  expected_shelf_date: string; logistics_carrier: string; logistics_tracking_no: string;
  is_customs_declared: number; customs_factory: string; is_inspected: number; timeline_requirement_days: number;
  order_remark: string; last_mile_type: string; last_mile_channel: string; pickup_time: string;
  depart_time: string; arrive_port_time: string; clearance_time: string; last_mile_pickup_time: string;
  delivery_time: string; unload_time: string; shelve_time: string;
  is_logistics_abnormal: number; logistics_abnormal_type: string; logistics_abnormal_remark: string;
  is_shelf_abnormal: number; shelf_abnormal_type: string; shelf_abnormal_remark: string;
  delay_explanation: string; estimated_unit_price: number; estimated_freight: number; total_freight_amount: number;
  freight_currency: string; freight_allocation_method: string; is_reconciled: number; is_paid: number;
  create_time: string; update_time: string; remark: string;
  items: OrderItem[]; cartons: Carton[]; tracking_events: TrackingEvent[]; change_logs: ChangeLog[];
}

const STATUS_BADGE_MAP: Record<string, 'pending' | 'shipped' | 'received' | 'transit' | 'abnormal' | 'shelved' | 'complete'> = {
  PENDING_OUTBOUND: 'pending', OUTBOUNDED: 'shipped', IN_TRANSIT: 'transit',
  RECEIVED: 'received', SHELVED: 'shelved', COMPLETED: 'complete', CANCELLED: 'abnormal',
};

const NEXT_STATUS: Record<string, { label: string; value: TransferStatus }> = {
  PENDING_OUTBOUND: { label: '确认出库', value: 'OUTBOUNDED' },
  OUTBOUNDED: { label: '确认在途', value: 'IN_TRANSIT' },
  IN_TRANSIT: { label: '确认签收', value: 'RECEIVED' },
  RECEIVED: { label: '确认上架', value: 'SHELVED' },
  SHELVED: { label: '确认完成', value: 'COMPLETED' },
};

const TIMELINE_NODES = [
  { key: 'pickup', label: '收件', timeField: 'pickup_time' as const },
  { key: 'depart', label: '离港', timeField: 'depart_time' as const },
  { key: 'arrive_port', label: '到港', timeField: 'arrive_port_time' as const },
  { key: 'clearance', label: '清关', timeField: 'clearance_time' as const },
  { key: 'last_mile', label: '提取', timeField: 'last_mile_pickup_time' as const },
  { key: 'delivery', label: '签收', timeField: 'delivery_time' as const },
  { key: 'unload', label: '卸货', timeField: 'unload_time' as const },
  { key: 'shelve', label: '上架', timeField: 'shelve_time' as const },
];

const SLA_ITEMS = [
  { label: '3天内上架', value: '待判断', status: 'pending' as const },
  { label: '11天内完成', value: '待判断', status: 'pending' as const },
  { label: '7天内完成', value: '不适用', status: 'na' as const },
  { label: '4天内完成', value: '不适用', status: 'na' as const },
];

function formatShortDate(val: string | null | undefined): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function OrderDetailPage() {
  const [searchParams] = useSearchParams();
  const transferNo = searchParams.get('transferNo') || '';
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchOrder = useCallback((tn: string) => {
    if (!tn) { setLoading(false); return; }
    setLoading(true);
    setErrorMsg('');
    api.post<{ success: boolean; data: OrderDetail }>(`/orders/xquery`, { transferNo: tn })
      .then((res) => { if (res.success) setOrder(res.data); else { setOrder(null); setErrorMsg('数据返回异常'); } })
      .catch((err) => { setOrder(null); setErrorMsg(err.message || '请求失败'); })
      .finally(() => { setLoading(false); });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (transferNo) fetchOrder(transferNo);
  }, [transferNo, fetchOrder]);

  const handleStatusChange = async (newStatus: TransferStatus) => {
    if (!transferNo || !order) return;
    const label = NEXT_STATUS[order.status]?.label || newStatus;
    if (!confirm(`确认执行「${label}」操作？`)) return;
    setActionLoading(true);
    try {
      const res = await api.put<{ success: boolean; data: OrderDetail; error?: string }>(`/orders/status`, { transferNo, status: newStatus });
      if (res.success) await fetchOrder(transferNo!);
      else alert(res.error || '操作失败');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败';
      alert(msg);
    } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><span className="text-sm text-text-tertiary">加载中...</span></div>;
  if (!order) return <EmptyState title="调拨单不存在" description={errorMsg || (transferNo ? '' : '未指定调拨单号')} action={<Button variant="ghost" onClick={() => navigate('/orders')}>返回列表</Button>} />;

  const nextStatus = NEXT_STATUS[order.status];

  const timelineData = TIMELINE_NODES.map((node) => {
    const timeVal = order[node.timeField];
    return { ...node, time: formatShortDate(timeVal), hasTime: !!timeVal };
  });

  let currentIdx = -1;
  for (let i = timelineData.length - 1; i >= 0; i--) {
    if (timelineData[i].hasTime) { currentIdx = i; break; }
  }

  const metaGroups = [
    {
      title: '单据信息',
      items: [
        { label: '入库单号', value: order.inbound_order_no || '--' },
        { label: '调拨单号', value: order.transfer_no },
        { label: '出库单号', value: order.outbound_order_no || '--' },
        { label: 'ERP订单号', value: order.erp_order_no || '--' },
      ],
    },
    {
      title: '仓配信息',
      items: [
        { label: '发货仓', value: order.from_warehouse },
        { label: '目的仓', value: order.to_warehouse },
        { label: '团队', value: order.team || '--' },
        { label: '来源', value: order.source || '--' },
      ],
    },
    {
      title: '物流信息',
      items: [
        { label: '运输类型', value: order.transport_type ? TransportTypeLabel[order.transport_type as TransportType] || order.transport_type : '--' },
        { label: '物流商', value: order.logistics_carrier || '--' },
        { label: '跟踪号', value: order.logistics_tracking_no || '--' },
        { label: '时效要求', value: order.timeline_requirement_days ? `${order.timeline_requirement_days}天` : '--' },
      ],
    },
    {
      title: '时间节点',
      items: [
        { label: '收件日期', value: order.pickup_time ? `${formatShortDate(order.pickup_time)}` : '--' },
        { label: '预计签收', value: order.expected_arrival_date ? formatShortDate(order.expected_arrival_date) : '--' },
        { label: '预计上架', value: order.expected_shelf_date ? formatShortDate(order.expected_shelf_date) : '--' },
        { label: '实际到货', value: order.actual_arrival_date ? formatShortDate(order.actual_arrival_date) : '--' },
      ],
    },
    {
      title: '报关/尾程',
      items: [
        { label: '报关', value: order.is_customs_declared ? `是 · ${order.customs_factory || ''}` : '否' },
        { label: '查验', value: order.is_inspected ? '是' : '否' },
        { label: '尾程类型', value: order.last_mile_type || '--' },
        { label: '尾程渠道', value: order.last_mile_channel || '--' },
      ],
    },
  ];

  const skuColumns: ColumnDef[] = [
    { key: 'sku_code', title: '系统SKU', render: (_, row) => <span className="font-medium text-text-primary">{row.sku_code as string}</span> },
    { key: 'overseas_sku_code', title: '海外仓SKU', render: (_, row) => <span className="text-text-tertiary">{(row.overseas_sku_code as string) || '--'}</span> },
    { key: 'sku_name', title: '品名', render: (_, row) => (row.sku_name as string) || '--' },
    { key: 'expected_qty', title: '计划数量' },
    { key: 'outbound_qty', title: '实际发货' },
    { key: 'shelf_qty', title: '上架数量', render: (_, row) => (row.shelf_qty as number) ?? '—' },
    { key: 'total_diff', title: '上架差异', render: (_, row) => (row.total_diff as number) ?? '—' },
    { key: 'freight_cost_per_unit', title: '运费成本/件', render: (_, row) => {
      const val = row.freight_cost_per_unit as number;
      return val != null ? <span className="text-text-tertiary">¥{val.toFixed(2)}</span> : <span className="text-text-tertiary">待分摊</span>;
    }},
  ];

  const freightSkuColumns: ColumnDef[] = [
    { key: 'sku_code', title: 'SKU', render: (_, row) => <span className="font-medium">{row.sku_code as string}</span> },
    { key: 'outbound_qty', title: '数量' },
    { key: 'freight_cost_total', title: '分摊总运费', render: (_, row) => `¥${((row.freight_cost_total as number) || 0).toLocaleString()}` },
    { key: 'freight_cost_per_unit', title: '单件运费成本', render: (_, row) => {
      const val = row.freight_cost_per_unit as number;
      return val != null ? <span className="font-semibold text-accent">¥{val.toFixed(2)}</span> : '--';
    }},
  ];

  const getCartonStatus = (ct: Carton): 'pending' | 'shipped' | 'transit' | 'received' | 'shelved' | 'complete' | 'abnormal' => {
    if (ct.shelf_time) return 'shelved';
    if (ct.logistics_sign_time) return 'received';
    if (ct.is_shelf_abnormal) return 'abnormal';
    return 'transit';
  };

  const getCartonStatusLabel = (ct: Carton): string => {
    if (ct.shelf_time) return '已上架';
    if (ct.logistics_sign_time) return '已签收';
    if (ct.is_shelf_abnormal) return '上架异常';
    return '在途';
  };

  const deviation = order.estimated_freight && order.total_freight_amount && order.estimated_freight > 0
    ? ((order.total_freight_amount - order.estimated_freight) / order.estimated_freight * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-bg-card border-b border-border">
        <div className="px-7 pt-5 pb-4 flex items-center gap-4">
          <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate('/orders')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-text-primary">{order.inbound_order_no || order.transfer_no}</span>
              <Badge variant={STATUS_BADGE_MAP[order.status] || 'pending'}>{TransferStatusLabel[order.status]}</Badge>
            </div>
            <div className="text-xs text-text-tertiary mt-1">调拨单号：{order.transfer_no}</div>
          </div>
          <div className="flex gap-2 shrink-0">
            {nextStatus && <Button onClick={() => handleStatusChange(nextStatus.value)} loading={actionLoading}>{nextStatus.label}</Button>}
            {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
              <Button variant="danger" onClick={() => handleStatusChange('CANCELLED')} loading={actionLoading}>取消</Button>
            )}
          </div>
        </div>
        <div className="px-7 pb-5 grid grid-cols-5 gap-6">
          {metaGroups.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2.5">{group.title}</div>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-text-tertiary shrink-0">{item.label}</span>
                    <span className="text-[13px] font-medium text-text-primary text-right truncate">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-7 space-y-4">
        <Card title="物流节点" actions={<Button variant="secondary" size="sm">导入物流节点</Button>}>
          <div className="px-5 py-4 flex items-center overflow-x-auto">
            {timelineData.map((node, idx) => (
              <div key={node.key} className="flex items-center">
                <div className="flex flex-col items-center min-w-[72px]">
                  <div className={`w-2.5 h-2.5 rounded-full mb-1.5 z-[2] ${
                    idx < currentIdx ? 'bg-green' :
                    idx === currentIdx ? 'bg-accent shadow-[0_0_0_3px_var(--accent-light)]' :
                    'bg-border'
                  }`} />
                  <div className="text-[11px] text-text-tertiary text-center">{node.label}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{idx <= currentIdx ? node.time : idx === currentIdx + 1 ? '待提取' : '—'}</div>
                </div>
                {idx < timelineData.length - 1 && (
                  <div className={`flex-1 h-0.5 min-w-[20px] ${idx < currentIdx ? 'bg-green' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="SLA达标判断">
          <div className="grid grid-cols-4 gap-2 px-5 py-4">
            {SLA_ITEMS.map((item) => (
              <div key={item.label} className="text-center p-2.5 rounded-md bg-bg">
                <div className="text-[10px] text-text-tertiary mb-1">{item.label}</div>
                <div className={`text-sm font-semibold ${item.status === 'na' ? 'text-text-tertiary' : 'text-text-tertiary'}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="SKU明细" actions={<Button variant="secondary" size="sm">编辑</Button>}>
          <Table columns={skuColumns} data={order.items as unknown as Record<string, unknown>[]} />
        </Card>

        <Card title="箱明细" actions={
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm">导入箱规</Button>
            <Button variant="secondary" size="sm">导入物流跟踪号</Button>
          </div>
        }>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 px-5 py-4">
            {order.cartons.map((ct) => (
              <div key={ct.carton_no} className="border border-border rounded-lg px-4 py-3.5 hover:shadow-sm hover:border-accent transition-all">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[13px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>{ct.carton_no}</span>
                  <Badge variant={getCartonStatus(ct)}>{getCartonStatusLabel(ct)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <span className="text-text-tertiary">物流跟踪号</span>
                  <span className="text-text-secondary text-right">{ct.logistics_tracking_no || '—'}</span>
                  <span className="text-text-tertiary">箱规</span>
                  <span className="text-text-secondary text-right">{ct.carton_length ? `${ct.carton_length}×${ct.carton_width}×${ct.carton_height}cm` : '—'}</span>
                  <span className="text-text-tertiary">申报货值</span>
                  <span className="text-text-secondary text-right">{ct.declared_value ? `¥${ct.declared_value.toLocaleString()}` : '—'}</span>
                  <span className="text-text-tertiary">签收-上架</span>
                  <span className="text-text-secondary text-right">{ct.shelf_time ? '已上架' : '未上架'}</span>
                </div>
              </div>
            ))}
            {order.cartons.length === 0 && (
              <div className="col-span-full text-center py-8 text-text-tertiary text-sm">暂无箱数据</div>
            )}
          </div>
        </Card>

        <Card title="运费信息" actions={
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm">导入预估单价</Button>
            <Button variant="secondary" size="sm">导入运费账单</Button>
            <Button variant="secondary" size="sm">导入对账状态</Button>
          </div>
        }>
          <div className="grid grid-cols-3 gap-4 px-5 py-4">
            <div className="text-center p-3 bg-bg rounded-lg">
              <div className="text-[11px] text-text-tertiary mb-1">预估运费</div>
              <div className="text-lg font-bold text-orange" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {order.estimated_freight ? `¥${order.estimated_freight.toLocaleString()}` : '—'}
              </div>
              {order.estimated_unit_price && order.total_carton_count ? (
                <div className="text-[11px] text-text-tertiary mt-0.5">¥{order.estimated_unit_price.toLocaleString()}/箱 × {order.total_carton_count}箱</div>
              ) : null}
            </div>
            <div className="text-center p-3 bg-bg rounded-lg">
              <div className="text-[11px] text-text-tertiary mb-1">最终运费</div>
              <div className="text-lg font-bold text-green" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {order.total_freight_amount ? `¥${order.total_freight_amount.toLocaleString()}` : '—'}
              </div>
              {deviation && <div className="text-[11px] text-text-tertiary mt-0.5">偏差 {Number(deviation) >= 0 ? '+' : ''}{deviation}%</div>}
            </div>
            <div className="text-center p-3 bg-bg rounded-lg">
              <div className="text-[11px] text-text-tertiary mb-1">对账/付款</div>
              <div className="text-base font-semibold text-green">
                {order.is_reconciled ? '已对账' : '未对账'} / {order.is_paid ? '已付款' : '未付款'}
              </div>
            </div>
          </div>
          {order.items.length > 0 && (
            <div className="px-5 pb-4">
              <div className="text-xs font-semibold mb-2 text-text-secondary">SKU运费成本（按数量分摊）</div>
              <Table columns={freightSkuColumns} data={order.items as unknown as Record<string, unknown>[]} />
            </div>
          )}
        </Card>

        <Card title="异常状态" actions={<Button variant="secondary" size="sm">编辑</Button>}>
          <div className="px-5 py-4 flex gap-6">
            <div>
              <span className="text-[11px] text-text-tertiary">物流异常</span>
              <div className={`text-[13px] font-medium mt-0.5 ${order.is_logistics_abnormal ? 'text-red' : 'text-green'}`}>
                {order.is_logistics_abnormal ? '是' : '否'}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-text-tertiary">上架异常</span>
              <div className="text-[13px] font-medium mt-0.5 text-text-tertiary">
                {order.is_shelf_abnormal ? '是' : order.status === 'SHELVED' || order.status === 'COMPLETED' ? '否' : '—'}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-text-tertiary">延迟说明</span>
              <div className="text-[13px] font-medium mt-0.5 text-text-tertiary">
                {order.delay_explanation || '—'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
