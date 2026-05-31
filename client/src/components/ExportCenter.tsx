import { useEffect, useRef } from 'react';
import { X, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useExportStore } from '../store/exportStore';
import type { ExportTask } from '../store/exportStore';

function TaskItem({ task }: { task: ExportTask }) {
  const { downloadTask, removeTask } = useExportStore();
  const pct = task.total > 0 ? Math.round((task.progress / task.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-border-light last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.status === 'completed' && <CheckCircle2 size={14} className="text-green shrink-0" />}
          {task.status === 'failed' && <AlertCircle size={14} className="text-red shrink-0" />}
          {(task.status === 'pending' || task.status === 'processing') && <Loader2 size={14} className="text-accent animate-spin shrink-0" />}
          <span className="text-[12px] text-text-primary font-medium truncate max-w-[160px]">{task.fileName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {task.status === 'completed' && (
            <button
              onClick={() => downloadTask(task.taskId, task.fileName)}
              className="text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              <Download size={13} />
            </button>
          )}
          <button
            onClick={() => removeTask(task.taskId)}
            className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      {(task.status === 'pending' || task.status === 'processing') && (
        <div className="w-full h-1.5 bg-bg-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {task.status === 'processing' && (
        <span className="text-[10px] text-text-tertiary">{pct}%</span>
      )}
      {task.status === 'failed' && task.error && (
        <span className="text-[10px] text-red">{task.error}</span>
      )}
    </div>
  );
}

export default function ExportCenter() {
  const { tasks, panelOpen, setPanelOpen } = useExportStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (panelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen, setPanelOpen]);

  const activeCount = tasks.filter((t) => t.status === 'pending' || t.status === 'processing').length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Download size={16} strokeWidth={1.8} />
        <span>导出中心</span>
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <div className="absolute right-0 top-full mt-2 w-[280px] bg-bg-card border border-border rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
            <h4 className="text-[13px] font-semibold text-text-primary">导出中心</h4>
            <button onClick={() => setPanelOpen(false)} className="text-text-tertiary hover:text-text-secondary cursor-pointer">
              <X size={15} />
            </button>
          </div>
          <div className="px-4 py-1 max-h-[360px] overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-text-tertiary">暂无导出任务</div>
            ) : (
              tasks.map((task) => <TaskItem key={task.taskId} task={task} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
