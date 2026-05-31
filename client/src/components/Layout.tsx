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
  Database,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ExportCenter from './ExportCenter';

interface MenuItem {
  label: string;
  icon: React.ElementType;
  path: string;
  permission?: string;
  badge?: { text: string; variant: 'accent' | 'green' | 'orange' | 'red' | 'purple' | 'teal' };
  group?: string;
}

const menuItems: MenuItem[] = [
  { label: '数据看板', icon: LayoutDashboard, path: '/', group: '概览' },
  { label: '调拨单列表', icon: FileText, path: '/orders', permission: 'order.view', group: '业务' },
  { label: '在途追踪', icon: Truck, path: '/tracking', permission: 'tracking.view', group: '业务' },
  { label: '导入管理', icon: Upload, path: '/imports', permission: 'import.execute', group: '业务' },
  { label: '异常管理', icon: AlertTriangle, path: '/discrepancies', permission: 'discrepancy.view', group: '业务' },
  { label: '运费管理', icon: DollarSign, path: '/freight', permission: 'freight.view', group: '业务' },
  { label: '仓库管理', icon: Warehouse, path: '/warehouses', permission: 'settings.manage', group: '配置' },
  { label: '物流商管理', icon: Ship, path: '/carriers', permission: 'settings.manage', group: '配置' },
  { label: 'SLA规则', icon: Clock, path: '/sla', permission: 'settings.manage', group: '配置' },
  { label: '团队管理', icon: Users, path: '/teams', permission: 'settings.manage', group: '配置' },
  { label: '用户管理', icon: UserCog, path: '/users', permission: 'settings.manage', group: '配置' },
  { label: '数据管理', icon: Database, path: '/data-management', permission: 'settings.manage', group: '配置' },
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
  '/data-management': '数据管理',
};

const badgeVariantClasses: Record<string, string> = {
  accent: 'bg-accent-light text-accent',
  green: 'bg-green-light text-green',
  orange: 'bg-orange-light text-orange',
  red: 'bg-red-light text-red',
  purple: 'bg-purple-light text-purple',
  teal: 'bg-teal-light text-teal',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const currentTitle = pageTitles[location.pathname] || '调拨单管理系统';

  const groups = visibleItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const g = item.group || '其他';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-bg">
      <aside className="w-[220px] bg-bg-sidebar border-r border-border flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[15px] font-semibold text-text-primary">调拨管理</div>
          <div className="text-[11px] text-text-tertiary mt-0.5">Transfer Order System v4.0</div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {Object.entries(groups).map(([group, items], gi) => (
            <div key={group} className={gi > 0 ? 'mt-4' : ''}>
              <div className="px-3 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{group}</span>
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-[13px] transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-accent-light text-accent font-medium'
                        : 'text-text-secondary hover:bg-bg-hover'
                    }`}
                    style={{ width: 'calc(100% - 16px)' }}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2 : 1.8} className="shrink-0" />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeVariantClasses[item.badge.variant]}`}>
                        {item.badge.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-bg-card border-b border-border sticky top-0 flex items-center justify-between px-6 shrink-0 z-10">
          <h2 className="text-[15px] font-semibold text-text-primary">{currentTitle}</h2>
          <div className="flex items-center gap-4">
            <ExportCenter />
            <span className="text-[13px] text-text-secondary">{user?.name || user?.username}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
            >
              <LogOut size={14} strokeWidth={1.8} />
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
