import { create } from 'zustand';
import { API_BASE } from '../api/client';

export type ExportTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportTask {
  taskId: string;
  type: string;
  fileName: string;
  status: ExportTaskStatus;
  progress: number;
  total: number;
  error: string | null;
  createdAt: number;
}

interface ExportState {
  tasks: ExportTask[];
  panelOpen: boolean;
  addTask: (task: ExportTask) => void;
  updateTask: (taskId: string, update: Partial<ExportTask>) => void;
  removeTask: (taskId: string) => void;
  setPanelOpen: (open: boolean) => void;
  pollTask: (taskId: string, type: string) => void;
  downloadTask: (taskId: string, fileName: string) => Promise<void>;
  startExport: (type: string, params: URLSearchParams) => Promise<void>;
}

export const useExportStore = create<ExportState>((set, get) => ({
  tasks: [],
  panelOpen: false,

  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),

  updateTask: (taskId, update) => set((s) => ({
    tasks: s.tasks.map((t) => t.taskId === taskId ? { ...t, ...update } : t),
  })),

  removeTask: (taskId) => set((s) => ({
    tasks: s.tasks.filter((t) => t.taskId !== taskId),
  })),

  setPanelOpen: (open) => set({ panelOpen: open }),

  pollTask: (taskId, type) => {
    const token = localStorage.getItem('token');
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/${type}/export/${taskId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) {
          clearInterval(interval);
          get().updateTask(taskId, { status: 'failed', error: data.error || '查询失败' });
          return;
        }
        const d = data.data;
        get().updateTask(taskId, {
          status: d.status,
          progress: d.progress,
          total: d.total,
          error: d.error,
        });
        if (d.status === 'completed') {
          clearInterval(interval);
          const task = get().tasks.find((t) => t.taskId === taskId);
          if (task) {
            get().downloadTask(taskId, task.fileName);
          }
        } else if (d.status === 'failed') {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
        get().updateTask(taskId, { status: 'failed', error: '网络错误' });
      }
    }, 1000);
  },

  downloadTask: async (taskId, fileName) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/${get().tasks.find((t) => t.taskId === taskId)?.type || 'tracking'}/export/${taskId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  },

  startExport: async (type, params) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/${type}/export?${params.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.success) {
        alert('导出失败: ' + (data.error || '未知错误'));
        return;
      }
      const taskId = data.data.taskId;
      const task: ExportTask = {
        taskId,
        type,
        fileName: type === 'tracking' ? '在途明细.xlsx' : '调拨单列表.xlsx',
        status: 'pending',
        progress: 0,
        total: 100,
        error: null,
        createdAt: Date.now(),
      };
      get().addTask(task);
      get().setPanelOpen(true);
      get().pollTask(taskId, type);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出失败');
    }
  },
}));
