import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Truck,
  Upload,
  AlertTriangle,
  DollarSign,
  Warehouse,
  Ship,
  Clock,
  Users,
  UserCog,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface MenuItem {
  label: string;
  icon: React.ElementType;
  path: string;
  permission?: string;
}

const menuItems: MenuItem[] = [
  { label: '数据看板', icon: LayoutDashboard, path: '/' },
  { label: '调拨单列表', icon: FileText, path: '/orders', permission: 'transfer:view' },
  { label: '在途追踪', icon: Truck, path: '/tracking', permission: 'tracking:view' },
  { label: '导入管理', icon: Upload, path: '/imports', permission: 'import:manage' },
  { label: '异常管理', icon: AlertTriangle, path: '/discrepancies', permission: 'discrepancy:view' },
  { label: '运费管理', icon: DollarSign, path: '/freight', permission: 'freight:view' },
  { label: '仓库管理', icon: Warehouse, path: '/warehouses', permission: 'warehouse:manage' },
  { label: '物流商管理', icon: Ship, path: '/carriers', permission: 'carrier:manage' },
  { label: 'SLA规则', icon: Clock, path: '/sla', permission: 'sla:manage' },
  { label: '团队管理', icon: Users, path: '/teams', permission: 'team:manage' },
  { label: '用户管理', icon: UserCog, path: '/users', permission: 'user:manage' },
];

const pageTitles: Record<string, string> = {
  '/': '数据看板',
  '/orders': '调拨单列表',
  '/tracking': '在途追踪',
  '/imports': '导入管理',
  '/discrepancies': '异常管理',
  '/freight': '运费管理',
  '/warehouses': '仓库管理',
  '/carriers': '物流商管理',
  '/sla': 'SLA规则',
  '/teams': '团队管理',
  '/users': '用户管理',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const currentTitle = pageTitles[location.pathname] || '调拨单管理系统';

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-[220px]'
        } bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-200`}
      >
        <div className="h-14 flex items-center px-4 border-b border-gray-200">
          {!collapsed && (
            <span className="text-base font-semibold text-gray-900 truncate">
              调拨单管理系统
            </span>
          )}
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <h2 className="text-base font-medium text-gray-900">{currentTitle}</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name || user?.username}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut size={16} />
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
