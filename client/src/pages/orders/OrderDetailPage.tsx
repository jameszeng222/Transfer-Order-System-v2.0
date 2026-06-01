import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Download, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { TransferStatusLabel, TransportTypeLabel, StatusBadgeMap } from 'shared/constants';
import type { TransferStatus, TransportType } from 'shared/constants';
import { Button, Card, Badge, Table, EmptyState, Modal, FormField } from '../../components/ui';
import type { ColumnDef } from '../../components/ui';
import { useExportStore } from '../../store/exportStore';

interface CartonItem { id: number; carton_no: string; sku_code: string; sku_name: string; overseas_sku_code: string; product_name: string; qty: number; shelf_qty: number; }
interface Carton { id: number; carton_no: string; logistics_tracking_no: string; logistics_carrier_order_no: string; carton_length: number; carton_width: number; carton_height: number; carton_weight: number; declared_value: number; departure_time: string; arrival_port_time: string; customs_clearance_time: string; last_mile_pickup_time: string; logistics_sign_time: string; unload_time: string; shelf_time: string; is_shelf_abnormal: number; shelf_abnormal_type: string; shelf_abnormal_remark: string; carton_items: CartonItem[]; }
interface OrderItem { id: number; sku_code: string; sku_name: string; overseas_sku_code: string; expected_qty: number; outbound_qty: number; inbound_qty: number; shelf_qty: number; shelf_shortage: number; outbound_diff: number; inbound_diff: number; total_diff: number; diff_reason: string; unit_weight: number; unit_volume: number; freight_cost_total: number; freight_cost_per_unit: number; }
interface TrackingEvent { id: number; event_time: string; event_type: string; event_desc: string; location: string; operator: string; }
interface ChangeLog { id: number; record_type: string; record_id: number; field_name: string; old_value: string; new_value: string; change_source: string; operator: string; change_time: string; reason: string; }

interface OrderDetail {
  id: number; transfer_no: string; outbound_order_no: string; inbound_order_no: string;
  from_warehouse: string; to_warehouse: string; team: string; transfer_type: string;
  status: TransferStatus; transport_type: TransportType; total_sku_count: number; total_qty: number;
  total_carton_count: number; logistics_status: string; expected_arrival_date: string; actual_arrival_date: string;
  expected_shelf_date: string; logistics_carrier: string; logistics_tracking_no: string;
  is_customs_declared: number; customs_factory: string; is_inspected: number; timeline_requirement_days: number;
  remark: string; last_mile_channel: string; pickup_time: string;
  departure_time: string; arrival_port_time: string; customs_clearance_time: string; last_mile_pickup_time: string;
  logistics_sign_time: string; unload_time: string; shelf_time: string;
  is_logistics_abnormal: number; logistics_abnormal_type: string; logistics_abnormal_remark: string;
  is_shelf_abnormal: number; shelf_abnormal_type: string; shelf_abnormal_remark: string;
  delay_explanation: string; estimated_unit_price: number; estimated_freight: number; total_freight_amount: number;
  freight_currency: string; freight_allocation_method: string; is_reconciled: number; is_paid: number;
  create_time: string; update_time: string;
  items: OrderItem[]; cartons: Carton[]; tracking_events: TrackingEvent[]; change_logs: ChangeLog[];
}

const NEXT_STATUS: Record<string, { label: string; value: TransferStatus }> = {
  PENDING_OUTBOUND: { label: '确认出库', value: 'OUTBOUNDED' },
  OUTBOUNDED: { label: '确认在途', value: 'IN_TRANSIT' },
  IN_TRANSIT: { label: '确认签收', value: 'RECEIVED' },
  RECEIVED: { label: '确认上架', value: 'SHELVED' },
  PARTIAL_SHELVED: { label: '确认全部上架', value: 'SHELVED' },
  SHELVED: { label: '确认完成', value: 'COMPLETED' },
};

const TIMELINE_NODES = [
  { key: 'pickup', label: '发货', timeField: 'pickup_time' as const },
  { key: 'depart', label: '离港', timeField: 'departure_time' as const },
  { key: 'arrive_port', label: '到港', timeField: 'arrival_port_time' as const },
  { key: 'clearance', label: '清关', timeField: 'customs_clearance_time' as const },
  { key: 'last_mile', label: '提取', timeField: 'last_mile_pickup_time' as const },
  { key: 'delivery', label: '签收', timeField: 'logistics_sign_time' as const },
  { key: 'unload', label: '卸货', timeField: 'unload_time' as const },
  { key: 'shelve', label: '上架', timeField: 'shelf_time' as const },
];

const SLA_ITEMS = [
  { label: '3天内上架', value: '待判断', status: 'pending' as const },
  { label: '11天内完成', value: '待判断', status: 'pending' as const },
  { label: '7天内完成', value: '不适用', status: 'na' as const },
  { label: '4天内完成', value: '不适用', status: 'na' as const },
];

const DISCREPANCY_CATEGORY_OPTIONS = [
  { label: '数量差异', value: 'QUANTITY_DIFF' },
  { label: '质量问题', value: 'QUALITY_ISSUE' },
  { label: '物流异常', value: 'LOGISTICS_ABNORMAL' },
  { label: '上架异常', value: 'SHELF_ABNORMAL' },
];

const DISCREPANCY_TYPE_MAP: Record<string, { label: string; value: string }[]> = {
  QUANTITY_DIFF: [
    { label: '少件', value: 'SHORTAGE' },
    { label: '多件', value: 'EXCESS' },
    { label: '错件', value: 'WRONG_ITEM' },
  ],
  QUALITY_ISSUE: [
    { label: '破损', value: 'DAMAGED' },
    { label: '变质', value: 'DETERIORATED' },
    { label: '包装损坏', value: 'PACKAGING_DAMAGED' },
  ],
  LOGISTICS_ABNORMAL: [
    { label: '丢失', value: 'LOST' },
    { label: '延迟', value: 'DELAYED' },
    { label: '错发', value: 'MIS_SHIPPED' },
  ],
  SHELF_ABNORMAL: [
    { label: '上架短缺', value: 'SHELF_SHORTAGE' },
    { label: '上架错位', value: 'SHELF_MISPLACED' },
  ],
};

interface DiscrepancyForm {
  transfer_no: string;
  sku_code: string;
  sku_name: string;
  discrepancy_category: string;
  discrepancy_type: string;
  discrepancy_qty: number | string;
  remark: string;
}

const DEFAULT_FORM: DiscrepancyForm = {
  transfer_no: '',
  sku_code: '',
  sku_name: '',
  discrepancy_category: '',
  discrepancy_type: '',
  discrepancy_qty: '',
  remark: '',
};

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

  const [discrepancyOpen, setDiscrepancyOpen] = useState(false);
  const [discrepancyForm, setDiscrepancyForm] = useState<DiscrepancyForm>({ ...DEFAULT_FORM });
  const [discrepancySubmitting, setDiscrepancySubmitting] = useState(false);
  const [discrepancyError, setDiscrepancyError] = useState('');

  const [confirmShortageOpen, setConfirmShortageOpen] = useState(false);
  const [confirmShortageItem, setConfirmShortageItem] = useState<OrderItem | null>(null);
  const [confirmShortageSubmitting, setConfirmShortageSubmitting] = useState(false);

  const fetchOrder = useCallback((tn: string) => {
    if (!tn) { setLoading(false); return; }
    setLoading(true);
    setErrorMsg('');
    api.post<{ success: boolean; data: OrderDetail }>(`/query/order`, { tn })
      .then((res) => { if (res.success) setOrder(res.data); else { setOrder(null); setErrorMsg('数据返回异常'); } })
      .catch((err) => { setOrder(null); setErrorMsg(err.message || '请求失败'); })
      .finally(() => { setLoading(false); });
  }, []);

  useEffect(() => {
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

  const openDiscrepancyModal = (item?: OrderItem) => {
    setDiscrepancyForm({
      ...DEFAULT_FORM,
      transfer_no: order?.transfer_no || '',
      sku_code: item?.sku_code || '',
      sku_name: item?.sku_name || '',
    });
    setDiscrepancyError('');
    setDiscrepancyOpen(true);
  };

  const handleDiscrepancyFormChange = (name: string, value: unknown) => {
    setDiscrepancyForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'discrepancy_category') {
        updated.discrepancy_type = '';
      }
      return updated;
    });
    setDiscrepancyError('');
  };

  const handleDiscrepancySubmit = async () => {
    if (!discrepancyForm.transfer_no) { setDiscrepancyError('调拨单号不能为空'); return; }
    if (!discrepancyForm.sku_code) { setDiscrepancyError('SKU编码不能为空'); return; }
    if (!discrepancyForm.discrepancy_category) { setDiscrepancyError('请选择异常分类'); return; }
    if (!discrepancyForm.discrepancy_type) { setDiscrepancyError('请选择异常类型'); return; }
    setDiscrepancySubmitting(true);
    try {
      const res = await api.post<{ success: boolean; error?: string }>('/discrepancies', {
        ...discrepancyForm,
        source: 'MANUAL',
      });
      if (res.success) {
        setDiscrepancyOpen(false);
      } else {
        setDiscrepancyError(res.error || '创建失败');
      }
    } catch (err) {
      setDiscrepancyError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setDiscrepancySubmitting(false);
    }
  };

  const handleConfirmShortage = async (item: OrderItem) => {
    if (!order) return;
    setConfirmShortageSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; error?: string }>('/discrepancies', {
        transfer_no: order.transfer_no,
        sku_code: item.sku_code,
        sku_name: item.sku_name,
        discrepancy_category: 'SHELF_ABNORMAL',
        discrepancy_type: 'SHELF_SHORTAGE',
        discrepancy_qty: item.shelf_shortage,
        source: 'SHELF_SHORTAGE',
        remark: `上架短缺：计划${item.expected_qty}，上架${item.shelf_qty}`,
      });
      if (res.success) {
        setConfirmShortageOpen(false);
        setConfirmShortageItem(null);
      } else {
        alert(res.error || '创建失败');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setConfirmShortageSubmitting(false);
    }
  };

  const [nodeEditOpen, setNodeEditOpen] = useState(false);
  const [nodeEditField, setNodeEditField] = useState('');
  const [nodeEditValue, setNodeEditValue] = useState('');
  const [nodeEditSubmitting, setNodeEditSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { startCartonExport } = useExportStore();

  const handleDelete = useCallback(async () => {
    if (!order) return;
    setDeleteLoading(true);
    try {
      const res = await api.delete<{ success: boolean; error?: string }>(`/orders/${order.transfer_no}`);
      if (res.success) {
        navigate('/orders');
      } else {
        alert(res.error || '删除失败');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
    }
  }, [order, navigate]);

  const NODE_STATUS_MAP: Record<string, TransferStatus> = {
    pickup_time: 'IN_TRANSIT',
    logistics_sign_time: 'RECEIVED',
    shelf_time: 'PARTIAL_SHELVED',
  };

  const openNodeEdit = (field: string, currentValue: string) => {
    setNodeEditField(field);
    setNodeEditValue(currentValue ? new Date(currentValue).toISOString().slice(0, 16) : '');
    setNodeEditOpen(true);
  };

  const handleNodeStatusChange = async (field: string) => {
    const targetStatus = NODE_STATUS_MAP[field];
    if (!targetStatus || !transferNo || !order) return;
    const nodeLabel = TIMELINE_NODES.find(n => n.timeField === field)?.label || field;
    const statusLabel = TransferStatusLabel[targetStatus];
    if (!confirm(`确认将状态变更为「${statusLabel}」？\n将自动填充${nodeLabel}时间为当前时间`)) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const res = await api.put<{ success: boolean; error?: string }>('/orders/status', {
        transferNo,
        status: targetStatus,
        timeField: field,
        timeValue: now,
      });
      if (res.success) {
        await fetchOrder(transferNo);
      } else {
        alert(res.error || '状态更新失败');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNodeEditSubmit = async () => {
    if (!transferNo || !order) return;
    setNodeEditSubmitting(true);
    try {
      const res = await api.put<{ success: boolean; error?: string }>('/orders/edit', {
        transferNo,
        [nodeEditField]: nodeEditValue ? new Date(nodeEditValue).toISOString() : null,
      });
      if (res.success) {
        setNodeEditOpen(false);
        await fetchOrder(transferNo);
      } else {
        alert(res.error || '更新失败');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    } finally {
      setNodeEditSubmitting(false);
    }
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
        { label: '第三方入库单号', value: order.inbound_order_no || '--' },
        { label: '调拨单号', value: order.transfer_no },
        { label: '出库单号', value: order.outbound_order_no || '--' },
        { label: '创建时间', value: order.create_time ? new Date(order.create_time).toLocaleString('zh-CN') : '--' },
        { label: '出库时间', value: order.departure_time ? new Date(order.departure_time).toLocaleString('zh-CN') : '--' },
      ],
    },
    {
      title: '仓配信息',
      items: [
        { label: '发货仓库', value: order.from_warehouse },
        { label: '目的仓库', value: order.to_warehouse },
        { label: '团队', value: order.team || '--' },
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
        { label: '发货日期', value: order.pickup_time ? `${formatShortDate(order.pickup_time)}` : '--' },
        { label: '预计上架', value: order.expected_shelf_date ? formatShortDate(order.expected_shelf_date) : (order.expected_arrival_date ? formatShortDate(order.expected_arrival_date) : '--') },
        { label: '预计上架', value: order.expected_shelf_date ? formatShortDate(order.expected_shelf_date) : '--' },
        { label: '实际到货', value: order.actual_arrival_date ? formatShortDate(order.actual_arrival_date) : '--' },
      ],
    },
    {
      title: '报关/尾程',
      items: [
        { label: '报关', value: order.is_customs_declared ? `是 · ${order.customs_factory || ''}` : '否' },
        { label: '查验', value: order.is_inspected ? '是' : '否' },
        { label: '尾程渠道', value: order.last_mile_channel || '--' },
      ],
    },
  ];

  const skuColumns: ColumnDef[] = [
    { key: 'sku_code', title: '系统SKU', render: (_, row) => <span className="font-medium text-text-primary">{row.sku_code as string}</span> },
    { key: 'overseas_sku_code', title: '海外仓SKU', render: (_, row) => <span className="text-text-tertiary">{(row.overseas_sku_code as string) || '--'}</span> },
    { key: 'sku_name', title: '产品名称', render: (_, row) => (row.sku_name as string) || '--' },
    { key: 'expected_qty', title: '计划数量' },
    { key: 'outbound_qty', title: '实际发货' },
    {
      key: 'shelf_qty',
      title: '上架数量',
      render: (_, row) => {
        const shelfQty = row.shelf_qty as number;
        const shelfShortage = (row as unknown as OrderItem).shelf_shortage;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span>{shelfQty ?? '—'}</span>
            {shelfShortage > 0 && <Badge variant="abnormal">上架短缺</Badge>}
          </span>
        );
      },
    },
    { key: 'total_diff', title: '上架差异', render: (_, row) => (row.total_diff as number) ?? '—' },
    { key: 'freight_cost_per_unit', title: '运费成本/件', render: (_, row) => {
      const val = row.freight_cost_per_unit as number;
      return val != null ? <span className="text-text-tertiary">¥{val.toFixed(2)}</span> : <span className="text-text-tertiary">待分摊</span>;
    }},
    {
      key: '_actions',
      title: '操作',
      width: '120px',
      render: (_, row) => {
        const item = row as unknown as OrderItem;
        return (
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-accent hover:text-accent-hover"
              onClick={() => openDiscrepancyModal(item)}
            >
              报异常
            </button>
            {(item.shelf_shortage > 0) && (
              <button
                className="text-xs text-red hover:text-red-600"
                onClick={() => { setConfirmShortageItem(item); setConfirmShortageOpen(true); }}
              >
                确认生成异常单
              </button>
            )}
          </div>
        );
      },
    },
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
      <div className="bg-bg-card border border-border rounded-xl">
        <div className="px-5 pt-4 pb-3 flex items-center gap-4 border-b border-border-light">
          <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate('/orders')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-text-primary">{order.inbound_order_no || order.transfer_no}</span>
              <Badge variant={StatusBadgeMap[order.status] || 'pending'}>{TransferStatusLabel[order.status]}</Badge>
            </div>
            <div className="text-xs text-text-tertiary mt-1">调拨单号：{order.transfer_no}</div>
          </div>
          <div className="flex gap-2 shrink-0">
            {nextStatus && <Button onClick={() => handleStatusChange(nextStatus.value)} loading={actionLoading}>{nextStatus.label}</Button>}
            {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
              <Button variant="danger" onClick={() => handleStatusChange('CANCELLED')} loading={actionLoading}>取消</Button>
            )}
            <Button variant="ghost" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)} className="text-red-500 hover:text-red-600 hover:bg-red-50">删除</Button>
          </div>
        </div>
        <div className="px-5 py-4 grid grid-cols-5 gap-6">
          {metaGroups.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-3">{group.title}</div>
              <div className="space-y-2.5">
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

      <div className="space-y-4">
        <Card title="物流节点" actions={<Button variant="secondary" size="sm">导入物流节点</Button>}>
          <div className="px-5 py-4 flex items-center overflow-x-auto">
            {timelineData.map((node, idx) => {
              const isNextNode = idx === currentIdx + 1;
              const canTriggerStatus = NODE_STATUS_MAP[node.timeField] && !node.hasTime && isNextNode;
              const canEdit = !node.hasTime;
              return (
                <div key={node.key} className="flex items-center">
                  <div
                    className={`flex flex-col items-center min-w-[72px] ${canTriggerStatus ? 'cursor-pointer' : canEdit ? 'cursor-pointer' : node.hasTime ? 'cursor-pointer group' : ''}`}
                    onClick={() => {
                      if (canTriggerStatus) {
                        handleNodeStatusChange(node.timeField);
                      } else if (canEdit) {
                        openNodeEdit(node.timeField, '');
                      } else if (node.hasTime) {
                        openNodeEdit(node.timeField, order[node.timeField] || '');
                      }
                    }}
                    title={canTriggerStatus ? '点击确认到达此节点' : canEdit ? '点击填写时间' : node.hasTime ? '点击编辑时间' : undefined}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full mb-1.5 z-[2] ${
                      idx < currentIdx ? 'bg-green' :
                      idx === currentIdx ? 'bg-accent shadow-[0_0_0_3px_var(--accent-light)]' :
                      isNextNode && canTriggerStatus ? 'bg-accent/40 shadow-[0_0_0_3px_var(--accent-light)]' :
                      'bg-border'
                    }`} />
                    <div className="text-[11px] text-text-tertiary text-center">{node.label}</div>
                    <div className={`text-[10px] mt-0.5 ${
                      node.hasTime ? 'text-text-tertiary group-hover:text-accent transition-colors' :
                      canTriggerStatus ? 'text-accent font-medium' :
                      canEdit ? 'text-accent/60' :
                      'text-text-tertiary'
                    }`}>
                      {node.hasTime ? node.time : canTriggerStatus ? '确认到达' : canEdit ? '填写' : '—'}
                    </div>
                  </div>
                  {idx < timelineData.length - 1 && (
                    <div className={`flex-1 h-0.5 min-w-[20px] ${idx < currentIdx ? 'bg-green' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
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

        <Card title="SKU明细" actions={
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm">编辑</Button>
            <Button variant="secondary" size="sm" icon={AlertTriangle} onClick={() => openDiscrepancyModal()}>报异常</Button>
          </div>
        }>
          <Table columns={skuColumns} data={order.items as unknown as Record<string, unknown>[]} />
        </Card>

        <Card title="箱明细" actions={
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" icon={Download} onClick={() => startCartonExport(order.transfer_no)}>导出箱单</Button>
            <Button variant="secondary" size="sm">导入箱规</Button>
            <Button variant="secondary" size="sm">导入物流跟踪号</Button>
          </div>
        }>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 px-5 py-4 max-h-[480px] overflow-y-auto">
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
                  <span className="text-text-tertiary">重量</span>
                  <span className="text-text-secondary text-right">{ct.carton_weight ? `${ct.carton_weight}kg` : '—'}</span>
                  <span className="text-text-tertiary">签收-上架</span>
                  <span className="text-text-secondary text-right">{ct.shelf_time ? '已上架' : '未上架'}</span>
                </div>
                {ct.carton_items && ct.carton_items.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-border-light">
                    <div className="text-[10px] text-text-tertiary mb-1.5">装箱SKU</div>
                    <div className="space-y-1">
                      {ct.carton_items.map((ci, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-text-secondary truncate max-w-[140px]" title={ci.sku_code}>{ci.sku_code}</span>
                          <span className="text-text-tertiary shrink-0 ml-2">{ci.qty}个</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                {order.is_shelf_abnormal ? '是' : order.status === 'SHELVED' || order.status === 'PARTIAL_SHELVED' || order.status === 'COMPLETED' ? '否' : '—'}
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

        <Card title="操作历史">
          <div className="px-5 py-4 max-h-[320px] overflow-y-auto">
            {order.change_logs && order.change_logs.length > 0 ? (
              <div className="space-y-2">
                {order.change_logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <span className="text-text-tertiary shrink-0 text-xs min-w-[120px]">
                      {log.change_time ? new Date(log.change_time).toLocaleString('zh-CN') : '--'}
                    </span>
                    <span className="shrink-0">
                      <Badge variant={log.change_source === 'API' ? 'complete' as const : log.change_source === 'IMPORT' ? 'transit' as const : 'pending' as const}>
                        {log.change_source === 'API' ? 'API' : log.change_source === 'IMPORT' ? '导入' : '手动'}
                      </Badge>
                    </span>
                    <span className="text-text-secondary">
                      {log.field_name === 'status' ? `状态变更: ${log.old_value} → ${log.new_value}` :
                       log.field_name === 'IMPORT_CREATE' ? '系统导入创建' :
                       log.field_name === 'IMPORT_OVERWRITE' ? '导入覆盖更新' :
                       log.field_name === 'IMPORT_OUTBOUND' ? '导入出库回传' :
                       log.field_name === 'IMPORT_INBOUND' ? '导入入库回传' :
                       log.field_name === 'IMPORT_LOGISTICS' ? '导入物流信息' :
                       log.field_name === 'IMPORT_LOGISTICS_EVENTS' ? '导入物流事件' :
                       log.field_name === 'IMPORT_LOGISTICS_MERGED' ? '导入物流节点' :
                       log.field_name === 'IMPORT_FREIGHT' ? '导入运费账单' :
                       log.field_name === 'CONFLICT_DETECTED' ? `冲突检测: ${log.old_value} → ${log.new_value}` :
                       `${log.field_name}: ${log.old_value || '(空)'} → ${log.new_value || '(空)'}`
                      }
                    </span>
                    {log.operator && <span className="text-text-tertiary text-xs ml-auto">{log.operator}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-text-tertiary text-sm">暂无操作记录</div>
            )}
          </div>
        </Card>
      </div>

      <Modal open={discrepancyOpen} title="报异常" onClose={() => setDiscrepancyOpen(false)} width="md">
        <div className="space-y-4">
          <FormField label="调拨单号" name="transfer_no" type="text" value={discrepancyForm.transfer_no} onChange={handleDiscrepancyFormChange} required placeholder="请输入调拨单号" />
          <FormField label="SKU编码" name="sku_code" type="text" value={discrepancyForm.sku_code} onChange={handleDiscrepancyFormChange} required placeholder="请输入SKU编码" />
          <FormField label="产品名称" name="sku_name" type="text" value={discrepancyForm.sku_name} onChange={handleDiscrepancyFormChange} placeholder="请输入产品名称" />
          <FormField label="异常分类" name="discrepancy_category" type="select" value={discrepancyForm.discrepancy_category} onChange={handleDiscrepancyFormChange} required placeholder="请选择异常分类" options={DISCREPANCY_CATEGORY_OPTIONS} />
          {discrepancyForm.discrepancy_category && DISCREPANCY_TYPE_MAP[discrepancyForm.discrepancy_category] && (
            <FormField label="异常类型" name="discrepancy_type" type="select" value={discrepancyForm.discrepancy_type} onChange={handleDiscrepancyFormChange} required placeholder="请选择异常类型" options={DISCREPANCY_TYPE_MAP[discrepancyForm.discrepancy_category]} />
          )}
          <FormField label="异常数量" name="discrepancy_qty" type="number" value={discrepancyForm.discrepancy_qty} onChange={handleDiscrepancyFormChange} placeholder="请输入异常数量" />
          <FormField label="备注" name="remark" type="textarea" value={discrepancyForm.remark} onChange={handleDiscrepancyFormChange} placeholder="请输入备注" />
          {discrepancyError && <p className="text-sm text-red-500">{discrepancyError}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setDiscrepancyOpen(false)}>取消</Button>
            <Button loading={discrepancySubmitting} onClick={handleDiscrepancySubmit}>提交</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmShortageOpen} title="确认生成异常单" onClose={() => { setConfirmShortageOpen(false); setConfirmShortageItem(null); }} width="sm">
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>SKU：<span className="font-medium text-gray-900">{confirmShortageItem?.sku_code}</span></p>
            <p>产品名称：<span className="font-medium text-gray-900">{confirmShortageItem?.sku_name || '--'}</span></p>
            <p>上架短缺数量：<span className="font-medium text-red">{confirmShortageItem?.shelf_shortage}</span></p>
          </div>
          <p className="text-sm text-gray-500">确认将为该SKU生成上架短缺异常单？</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => { setConfirmShortageOpen(false); setConfirmShortageItem(null); }}>取消</Button>
            <Button loading={confirmShortageSubmitting} onClick={() => confirmShortageItem && handleConfirmShortage(confirmShortageItem)}>确认生成</Button>
          </div>
        </div>
      </Modal>

      <Modal open={nodeEditOpen} title={`编辑${TIMELINE_NODES.find(n => n.timeField === nodeEditField)?.label || '时间节点'}`} onClose={() => setNodeEditOpen(false)} width="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-tertiary mb-1">时间</label>
            <input
              type="datetime-local"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              value={nodeEditValue}
              onChange={e => setNodeEditValue(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setNodeEditOpen(false)}>取消</Button>
            <Button loading={nodeEditSubmitting} onClick={handleNodeEditSubmit}>保存</Button>
          </div>
        </div>
      </Modal>
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="确认删除">
        <div className="space-y-3">
          <p className="text-sm text-text-primary">确定要删除该调拨单吗？此操作不可恢复。</p>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs text-red-700">
                <div className="font-semibold">将同时删除以下关联数据：</div>
                <div className="mt-1 space-y-0.5">
                  <div>• 调拨单主信息（{order?.transfer_no}）</div>
                  <div>• SKU明细（{order?.items?.length || 0}条）</div>
                  <div>• 箱明细（{order?.cartons?.length || 0}箱）</div>
                  <div>• 物流节点、差异记录、操作日志</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border-light">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
            <Button variant="danger" loading={deleteLoading} onClick={handleDelete}>确认删除</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
