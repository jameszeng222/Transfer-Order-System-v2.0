import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { TransportTypeLabel, TransferStatusLabel, StatusBadgeMap } from 'shared/constants';
import type { TransportType, TransferStatus } from 'shared/constants';
import { StatCard, Card, Badge } from '../../components/ui';

interface DashboardData {
  inTransitTotal: number;
  timeoutCount: number;
  approachingCount: number;
  warehouseDistribution: { warehouse: string; count: number }[];
  transportDistribution: { transport_type: string; count: number }[];
  carrierDistribution: { carrier: string; count: number }[];
  recentTrend: { date: string; count: number }[];
}

interface InProgressOrder {
  transfer_no: string;
  inbound_order_no: string;
  status: TransferStatus;
  from_warehouse: string;
  to_warehouse: string;
  transport_type: string;
  logistics_carrier: string;
  logistics_tracking_no: string;
  total_carton_count: number;
  total_freight_amount: number;
  is_reconciled: number;
  has_basic_info: boolean;
  has_logistics_info: boolean;
  has_carton_specs: boolean;
  has_outbound: boolean;
  has_freight: boolean;
}

const statusSegments = [
  { label: '待出库', count: 12, color: '#6b7280', pct: 9 },
  { label: '已出库', count: 8, color: 'var(--accent)', pct: 6 },
  { label: '在途', count: 15, color: 'var(--orange)', pct: 12 },
  { label: '已到仓', count: 10, color: 'var(--teal)', pct: 8 },
  { label: '已上架', count: 26, color: '#0d9488', pct: 20 },
  { label: '已完成', count: 56, color: 'var(--purple)', pct: 43 },
  { label: '异常', count: 4, color: 'var(--red)', pct: 2 },
];

const alertItems = [
  { text: '入库差异 -5件（A123）', dotColor: 'bg-red', time: '2小时前' },
  { text: '海运超时3天（RK-003）', dotColor: 'bg-orange', time: '5小时前' },
  { text: '上架异常，2件破损', dotColor: 'bg-orange', time: '昨天' },
  { text: '清关延误5天（RK-005）', dotColor: 'bg-red', time: '昨天' },
];

const skuTop5Data = [
  { sku: 'C789', name: '数据线', qty: '2,000', eta: '05-28' },
  { sku: 'A123', name: '手机壳', qty: '1,500', eta: '06-01' },
  { sku: 'B456', name: '充电器', qty: '800', eta: '06-03' },
  { sku: 'D012', name: '保护套', qty: '650', eta: '06-05' },
  { sku: 'E345', name: '耳机', qty: '420', eta: '06-08' },
];

const slaData: { type: TransportType; pct: number; barColor: string }[] = [
  { type: 'SEA', pct: 78, barColor: 'bg-orange' },
  { type: 'AIR', pct: 95, barColor: 'bg-green' },
  { type: 'RAIL', pct: 82, barColor: 'bg-green' },
  { type: 'TRUCK', pct: 88, barColor: 'bg-green' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [inProgressOrders, setInProgressOrders] = useState<InProgressOrder[]>([]);
  const [inProgressTotal, setInProgressTotal] = useState(0);
  const [inProgressPage, setInProgressPage] = useState(1);
  const inProgressPageSize = 10;

  useEffect(() => {
    api.get<{ success: boolean; data: DashboardData }>('/tracking/dashboard')
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(inProgressPage), pageSize: String(inProgressPageSize) });
    api.get<{ success: boolean; data: InProgressOrder[]; pagination: { total: number } }>(`/orders/in-progress?${params.toString()}`)
      .then((res) => {
        if (res.success) {
          setInProgressOrders(res.data || []);
          setInProgressTotal(res.pagination?.total || 0);
        }
      })
      .catch(() => {});
  }, [inProgressPage]);

  const inTransitCount = data?.inTransitTotal ?? 15;
  const abnormalCount = data?.timeoutCount ?? 4;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="本月调拨单" value="127" trend={{ value: '12% vs 上月', direction: 'up' }} />
        <StatCard label="在途" value={inTransitCount} color="orange" sub="23箱·4,950件" />
        <StatCard label="已上架完成" value="89" color="green" trend={{ value: '8% vs 上月', direction: 'up' }} />
        <StatCard label="异常调拨" value={abnormalCount} color="red" sub="物流3·上架1" />
        <StatCard label="本月预估运费" value="¥128K" color="purple" sub="最终¥95K·偏差+34%" />
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4">
        <div className="space-y-4">
          <Card title="物流状态分布">
            <div className="px-5 py-4">
              <div className="h-2 bg-bg-hover rounded-full overflow-hidden flex mb-3">
                {statusSegments.map((seg) => (
                  <div key={seg.label} className="h-full transition-all duration-300" style={{ width: `${seg.pct}%`, background: seg.color }} title={`${seg.label} ${seg.count}`} />
                ))}
              </div>
              <div className="flex gap-4 text-[11px] text-text-tertiary flex-wrap">
                {statusSegments.map((seg) => (
                  <span key={seg.label} style={{ color: seg.color }}>● {seg.label} {seg.count}</span>
                ))}
              </div>
            </div>
          </Card>

          <Card title="SLA达标情况">
            <div className="px-5 py-4">
              <div className="flex gap-6 mb-4">
                <div>
                  <div className="text-2xl font-bold text-green" style={{ fontFamily: "'DM Sans', sans-serif" }}>87%</div>
                  <div className="text-[11px] text-text-tertiary">整体达标率</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green" style={{ fontFamily: "'DM Sans', sans-serif" }}>92%</div>
                  <div className="text-[11px] text-text-tertiary">3天内上架率</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange" style={{ fontFamily: "'DM Sans', sans-serif" }}>78%</div>
                  <div className="text-[11px] text-text-tertiary">海运11天达标率</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {slaData.map((item) => (
                  <div key={item.type} className="flex items-center gap-2 text-xs">
                    <span className="w-[60px] text-text-tertiary">{TransportTypeLabel[item.type]}</span>
                    <div className="flex-1 h-1.5 bg-bg-hover rounded-full">
                      <div className={`h-full rounded-full ${item.barColor}`} style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className="w-[30px] text-right font-semibold">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="物流商分布">
            <div className="px-5 py-4">
              <div className="flex gap-5 text-xs flex-wrap">
                {(data?.carrierDistribution || []).map((item) => (
                  <div key={item.carrier} className="text-center">
                    <div className="text-xl font-bold text-accent" style={{ fontFamily: "'DM Sans', sans-serif" }}>{item.count}</div>
                    <div className="text-text-tertiary text-[11px]">{item.carrier}</div>
                  </div>
                ))}
                {(!data?.carrierDistribution || data.carrierDistribution.length === 0) && (
                  <div className="text-text-tertiary text-[11px]">暂无数据</div>
                )}
              </div>
            </div>
          </Card>

          <Card title="目的仓库分布">
            <div className="px-5 py-4">
              <div className="flex gap-5 text-xs flex-wrap">
                {(data?.warehouseDistribution || []).map((item) => (
                  <div key={item.warehouse} className="text-center">
                    <div className="text-xl font-bold text-orange" style={{ fontFamily: "'DM Sans', sans-serif" }}>{item.count}</div>
                    <div className="text-text-tertiary text-[11px]">{item.warehouse}</div>
                  </div>
                ))}
                {(!data?.warehouseDistribution || data.warehouseDistribution.length === 0) && (
                  <div className="text-text-tertiary text-[11px]">暂无数据</div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="异常预警" actions={<Badge variant="abnormal">4条</Badge>}>
            <div>
              {alertItems.map((item, idx) => (
                <div key={idx} className="px-5 py-3 border-b border-border-light last:border-b-0 flex items-center gap-3 text-[13px] text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer" onClick={() => navigate('/tracking')}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dotColor}`} />
                  <span>{item.text}</span>
                  <span className="text-[11px] text-text-tertiary ml-auto shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="SKU在途TOP5">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">SKU</th>
                    <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">品名</th>
                    <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">在途</th>
                    <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">最早到仓</th>
                  </tr>
                </thead>
                <tbody>
                  {skuTop5Data.map((row, idx) => (
                    <tr key={row.sku} className={`hover:bg-bg-hover cursor-pointer ${idx < skuTop5Data.length - 1 ? 'border-b border-border-light' : ''}`}>
                      <td className="px-4 py-2.5 text-text-secondary"><span className="font-medium text-text-primary">{row.sku}</span></td>
                      <td className="px-4 py-2.5 text-text-secondary">{row.name}</td>
                      <td className="px-4 py-2.5 text-text-secondary"><span className="font-semibold">{row.qty}</span></td>
                      <td className="px-4 py-2.5 text-text-secondary"><span className="text-orange">{row.eta}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="运费概览">
            <div className="px-5 py-4">
              <div className="flex justify-between mb-3">
                <div>
                  <div className="text-[11px] text-text-tertiary">预估运费</div>
                  <div className="text-lg font-bold text-orange" style={{ fontFamily: "'DM Sans', sans-serif" }}>¥128,000</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-text-tertiary">最终运费</div>
                  <div className="text-lg font-bold text-green" style={{ fontFamily: "'DM Sans', sans-serif" }}>¥95,000</div>
                </div>
              </div>
              <div className="text-[11px] text-text-tertiary">
                偏差率 <span className="text-orange font-semibold">+34%</span> · 待对账 <span className="font-semibold">12</span> · 待付款 <span className="font-semibold">5</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card title={`进行中调拨单（未录入完整）${inProgressTotal > 0 ? ` · ${inProgressTotal}条` : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">入库单号</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">状态</th>
                <th className="px-4 py-2.5 text-center font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">基础信息</th>
                <th className="px-4 py-2.5 text-center font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">物流信息</th>
                <th className="px-4 py-2.5 text-center font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">箱规</th>
                <th className="px-4 py-2.5 text-center font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">出库回传</th>
                <th className="px-4 py-2.5 text-center font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg">运费</th>
              </tr>
            </thead>
            <tbody>
              {inProgressOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-tertiary text-[13px]">暂无未录入完整的调拨单</td>
                </tr>
              ) : (
                inProgressOrders.map((order) => (
                  <tr key={order.transfer_no} className="hover:bg-bg-hover border-b border-border-light last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span
                        className="text-accent cursor-pointer hover:underline font-medium"
                        onClick={() => navigate(`/orders/detail?transferNo=${order.transfer_no}`)}
                      >
                        {order.inbound_order_no}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={StatusBadgeMap[order.status] || 'pending'}>
                        {TransferStatusLabel[order.status] || order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">{order.has_basic_info ? <span className="text-green">✓</span> : <span className="text-red">✗</span>}</td>
                    <td className="px-4 py-2.5 text-center">{order.has_logistics_info ? <span className="text-green">✓</span> : <span className="text-red">✗</span>}</td>
                    <td className="px-4 py-2.5 text-center">{order.has_carton_specs ? <span className="text-green">✓</span> : <span className="text-red">✗</span>}</td>
                    <td className="px-4 py-2.5 text-center">{order.has_outbound ? <span className="text-green">✓</span> : <span className="text-red">✗</span>}</td>
                    <td className="px-4 py-2.5 text-center">{order.has_freight ? <span className="text-green">✓</span> : <span className="text-red">✗</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {inProgressTotal > inProgressPageSize && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-light">
            <span className="text-[11px] text-text-tertiary">共 {inProgressTotal} 条</span>
            <div className="flex items-center gap-2">
              <button
                className="px-2.5 py-1 text-xs border border-border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-hover"
                disabled={inProgressPage <= 1}
                onClick={() => setInProgressPage(p => p - 1)}
              >上一页</button>
              <span className="text-xs text-text-secondary">{inProgressPage} / {Math.ceil(inProgressTotal / inProgressPageSize)}</span>
              <button
                className="px-2.5 py-1 text-xs border border-border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-hover"
                disabled={inProgressPage >= Math.ceil(inProgressTotal / inProgressPageSize)}
                onClick={() => setInProgressPage(p => p + 1)}
              >下一页</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
