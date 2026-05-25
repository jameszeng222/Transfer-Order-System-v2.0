import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          token: string;
          user: {
            id: number;
            username: string;
            name: string;
            roleId: number;
            roleCode: string;
            roleName: string;
            teamId: number | null;
            permissions: string[];
          };
        };
      }>('/auth/login', { username: username.trim(), password });

      setAuth(res.data.token, res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setAuth('demo-token', {
      id: 1,
      username: 'admin',
      name: '管理员',
      roleId: 1,
      roleCode: 'ADMIN',
      roleName: '管理员',
      teamId: null,
      permissions: [
        'dashboard.view', 'orders.view', 'orders.edit', 'orders.import', 'orders.export',
        'tracking.view', 'freight.view', 'freight.edit', 'discrepancy.view', 'discrepancy.edit',
        'settings.view', 'settings.manage',
      ],
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-border-light p-10 shadow-sm">
          <div className="text-center mb-10">
            <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">
              调拨单管理系统
            </h1>
            <p className="text-xs text-text-muted mt-1">请登录以继续</p>
          </div>

          {IS_DEMO && (
            <div className="mb-5 px-3 py-2 rounded-lg bg-accent-light text-xs text-accent font-medium text-center">
              演示模式 · 数据为空，仅供预览界面
            </div>
          )}

          {!IS_DEMO ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent hover:border-text-muted transition-colors"
                  placeholder="请输入用户名"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent hover:border-text-muted transition-colors"
                  placeholder="请输入密码"
                  required
                />
              </div>

              {error && (
                <div className="text-xs text-danger bg-danger-light px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent/50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          ) : (
            <button
              onClick={handleDemoLogin}
              className="w-full h-10 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover active:bg-accent-hover transition-colors cursor-pointer"
            >
              进入演示
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-text-muted mt-6">
          跨境电商物流 · 调拨单管理平台
        </p>
      </div>
    </div>
  );
}
