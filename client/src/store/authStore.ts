import { create } from 'zustand';

interface UserInfo {
  id: number;
  username: string;
  name: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  teamId: number | null;
  permissions: string[];
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  setAuth: (token: string, user: UserInfo) => void;
  logout: () => void;
  hasPermission: (code: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },
  hasPermission: (code) => {
    const { user } = get();
    if (!user) return false;
    if (user.roleCode === 'ADMIN') return true;
    return user.permissions.includes(code);
  },
}));
