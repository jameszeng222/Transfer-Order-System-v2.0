import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Truck, AlertTriangle, DollarSign } from 'lucide-react';
import { api } from '../api/client';
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<{ success: boolean; data: DashboardData }>('/tracking/dashboard')
      .then((res) => {
        if (res.success) {
          setDashboard(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const stats = [
    { label: '调拨单总数', value: '--', icon: FileText, color: 'text-blue-600 bg-blue-50' },
    { label: '在途单数', value: dashboard?.inTransitTotal ?? '--', icon: Truck, color: 'text-amber-600 bg-amber-50' },
    { label: '异常单数', value: dashboard?.timeoutCount ?? '--', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: '运费总额', value: '--', icon: DollarSign, color: 'text-green-600 bg-green-50' },
  ];

  const maxWarehouseCount = dashboard
    ? Math.max(...dashboard.warehouseDistribution.map((w) => w.count), 1)
    : 1;
  const maxTransportCount = dashboard
    ? Math.max(...dashboard.transportDistribution.map((t) => t.count), 1)
    : 1;
  const maxTrendCount = dashboard
    ? Math.max(...dashboard.recentTrend.map((t) => t.count), 1)
    : 1;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg border border-gray-200 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{stat.label}</span>
                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${stat.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">在途预警</span>
              <button
                onClick={() => navigate('/tracking')}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                查看全部 →
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">超时预警</span>
                <span className="text-lg font-semibold text-red-600">{dashboard.timeoutCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">即将超时(3天内)</span>
                <span className="text-lg font-semibold text-orange-600">{dashboard.approachingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">在途总数</span>
                <span className="text-lg font-semibold text-blue-600">{dashboard.inTransitTotal}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">按目的仓分布</div>
            <div className="space-y-2">
              {dashboard.warehouseDistribution.slice(0, 5).map((w) => (
                <div key={w.warehouse} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-20 shrink-0 truncate" title={w.warehouse}>{w.warehouse}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${(w.count / maxWarehouseCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-6 text-right">{w.count}</span>
                </div>
              ))}
              {dashboard.warehouseDistribution.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">暂无数据</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-sm font-medium text-gray-700 mb-4">近7天签收趋势</div>
            <div className="flex items-end gap-1 h-24">
              {dashboard.recentTrend.map((t) => (
                <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{t.count}</span>
                  <div
                    className="w-full bg-emerald-400 rounded-t transition-all"
                    style={{
                      height: maxTrendCount > 0 ? `${Math.max((t.count / maxTrendCount) * 100, t.count > 0 ? 8 : 2)}%` : '2%',
                    }}
                  />
                  <span className="text-xs text-gray-400">{t.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {dashboard && dashboard.transportDistribution.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="text-sm font-medium text-gray-700 mb-4">按运输类型分布</div>
          <div className="flex gap-6">
            {dashboard.transportDistribution.map((t) => (
              <div key={t.transport_type} className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {TransportTypeLabel[t.transport_type as TransportType] || t.transport_type}
                </span>
                <span className="text-lg font-semibold text-gray-900">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!dashboard && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 text-center py-12">
            数据看板功能开发中，敬请期待
          </p>
        </div>
      )}
    </div>
  );
}
