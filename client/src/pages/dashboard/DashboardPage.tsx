import { FileText, Truck, AlertTriangle, DollarSign } from 'lucide-react';

const stats = [
  { label: '调拨单总数', value: '--', icon: FileText, color: 'text-blue-600 bg-blue-50' },
  { label: '在途单数', value: '--', icon: Truck, color: 'text-amber-600 bg-amber-50' },
  { label: '异常单数', value: '--', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  { label: '运费总额', value: '--', icon: DollarSign, color: 'text-green-600 bg-green-50' },
];

export default function DashboardPage() {
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

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-500 text-center py-12">
          数据看板功能开发中，敬请期待
        </p>
      </div>
    </div>
  );
}
