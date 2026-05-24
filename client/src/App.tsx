import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import OrderListPage from './pages/orders/OrderListPage';
import OrderDetailPage from './pages/orders/OrderDetailPage';
import ImportPage from './pages/import/ImportPage';
import TrackingPage from './pages/tracking/TrackingPage';
import { useAuthStore } from './store/authStore';
import { api } from './api/client';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token, user, setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      api.get<{ data: { id: number; username: string; name: string; roleId: number; roleCode: string; roleName: string; teamId: number | null; permissions: string[] } }>('/auth/me')
        .then((res) => setAuth(token, res.data))
        .catch(() => logout());
    }
  }, [token, user, setAuth, logout]);

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Layout><OrderListPage /></Layout></ProtectedRoute>} />
      <Route path="/orders/:transferNo" element={<ProtectedRoute><Layout><OrderDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/imports" element={<ProtectedRoute><Layout><ImportPage /></Layout></ProtectedRoute>} />
      <Route path="/tracking" element={<ProtectedRoute><Layout><TrackingPage /></Layout></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
