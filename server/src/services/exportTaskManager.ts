type ExportTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ExportTask {
  id: string;
  type: string;
  fileName: string;
  status: ExportTaskStatus;
  progress: number;
  total: number;
  buffer: Buffer | null;
  error: string | null;
  createdAt: number;
}

const tasks = new Map<string, ExportTask>();

let taskCounter = 0;

function generateId(): string {
  taskCounter++;
  return `export_${Date.now()}_${taskCounter}`;
}

export function createTask(type: string, fileName: string): ExportTask {
  const task: ExportTask = {
    id: generateId(),
    type,
    fileName,
    status: 'pending',
    progress: 0,
    total: 100,
    buffer: null,
    error: null,
    createdAt: Date.now(),
  };
  tasks.set(task.id, task);
  return task;
}

export function getTask(id: string): ExportTask | undefined {
  return tasks.get(id);
}

export function updateProgress(id: string, progress: number, total?: number): void {
  const task = tasks.get(id);
  if (task) {
    task.status = 'processing';
    task.progress = progress;
    if (total !== undefined) task.total = total;
  }
}

export function completeTask(id: string, buffer: Buffer): void {
  const task = tasks.get(id);
  if (task) {
    task.status = 'completed';
    task.progress = task.total;
    task.buffer = buffer;
  }
}

export function failTask(id: string, error: string): void {
  const task = tasks.get(id);
  if (task) {
    task.status = 'failed';
    task.error = error;
  }
}

export function cleanOldTasks(maxAgeMs: number = 30 * 60 * 1000): void {
  const now = Date.now();
  for (const [id, task] of tasks) {
    if (now - task.createdAt > maxAgeMs) {
      tasks.delete(id);
    }
  }
}
