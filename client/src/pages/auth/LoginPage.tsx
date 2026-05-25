import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleQuickLogin = async () => {
    setLoading(true);
    setError('');
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
      }>('/auth/login', { username: 'admin', password: 'admin123' });

      setAuth(res.data.token, res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
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
            <p className="text-xs text-text-muted mt-1">开发阶段 · 点击即可进入</p>
          </div>

          {error && (
            <div className="mb-5 text-xs text-danger bg-danger-light px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleQuickLogin}
            disabled={loading}
            className="w-full h-10 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent/50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {loading ? '登录中...' : '一键进入'}
          </button>
        </div>

        <p className="text-center text-[11px] text-text-muted mt-6">
          跨境电商物流 · 调拨单管理平台
        </p>
      </div>
    </div>
  );
}
