import { useState, useRef, useEffect } from 'react';
import { Upload, Download } from 'lucide-react';
import { Button, Card, Badge } from '../../components/ui';
import { api } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface RowError { row: number; message: string; }
interface ImportResult { total: number; success: number; failed: number; errors: RowError[]; createdOrders: number; updatedOrders: number; }
interface ImportHistory { time: string; type: string; filename: string; success: number; failed: number; operator: string; }

interface ImportCardConfig {
  key: string;
  label: string;
  badge?: string;
  badgeVariant?: 'pending' | 'shipped' | 'transit' | 'received' | 'shelved' | 'complete' | 'abnormal';
  description: string;
  endpoint: string;
  templateType: string;
}

const IMPORT_CARDS: ImportCardConfig[] = [
  { key: 'main', label: '调拨单导入', badge: '主导入', badgeVariant: 'pending', description: '30个字段，仅第三方入库单号必填，支持覆盖更新', endpoint: '/imports/upload', templateType: 'main' },
  { key: 'logistics', label: '物流信息导入', description: '物流节点+异常+报关+时间节点，合并导入', endpoint: '/imports/logistics', templateType: 'logistics' },
  { key: 'inbound', label: '入库回传', description: '签收/上架数量回传', endpoint: '/imports/inbound', templateType: 'inbound' },
  { key: 'reconcile', label: '运费账单导入', description: '运费确认后自动分摊到SKU', endpoint: '/imports/freight', templateType: 'freight' },
];

export default function ImportPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get<{ success: boolean; data: ImportHistory[] }>('/imports/history');
      if (data.success) setHistory(data.data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFileSelect = async (config: ImportCardConfig, f: File) => {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      alert('请选择 Excel 文件（.xlsx / .xls）');
      return;
    }
    setLoadingKey(config.key);
    setResult(null);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', f);
      const res = await fetch(`${API_BASE}${config.endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        fetchHistory();
      } else {
        setResult({ total: 0, success: 0, failed: 1, errors: [{ row: 0, message: data.error || '导入失败' }], createdOrders: 0, updatedOrders: 0 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '网络错误';
      setResult({ total: 0, success: 0, failed: 1, errors: [{ row: 0, message: msg }], createdOrders: 0, updatedOrders: 0 });
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDownloadTemplate = async (config: ImportCardConfig) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/imports/templates/${config.templateType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('下载模板失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.label}模板.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '下载失败';
      alert(msg);
    }
  };

  const triggerFileInput = (key: string) => {
    fileInputRefs.current[key]?.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {IMPORT_CARDS.map((config) => (
          <Card key={config.key}>
            <div className="p-5">
              <div className="text-[13px] font-semibold mb-1">
                {config.label}
                {config.badge && <Badge variant={config.badgeVariant || 'pending'} className="ml-1.5 text-[9px]">{config.badge}</Badge>}
              </div>
              <div className="text-xs text-text-tertiary mb-4">{config.description}</div>
              <input
                ref={(el) => { fileInputRefs.current[config.key] = el; }}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(config, f); e.target.value = ''; }}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" icon={Upload} loading={loadingKey === config.key} onClick={() => triggerFileInput(config.key)}>选择文件上传</Button>
                <Button size="sm" variant="secondary" icon={Download} onClick={() => handleDownloadTemplate(config)}>下载模板</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {result && (
        <Card title="导入结果">
          <div className="p-5">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center p-4 bg-bg rounded-lg">
                <div className="text-xl font-semibold text-text-primary tabular-nums">{result.total}</div>
                <div className="text-xs text-text-tertiary mt-1">总行数</div>
              </div>
              <div className="text-center p-4 bg-green-light rounded-lg">
                <div className="text-xl font-semibold text-green tabular-nums">{result.success}</div>
                <div className="text-xs text-text-tertiary mt-1">成功</div>
              </div>
              <div className="text-center p-4 bg-red-light rounded-lg">
                <div className="text-xl font-semibold text-red tabular-nums">{result.failed}</div>
                <div className="text-xs text-text-tertiary mt-1">失败</div>
              </div>
              <div className="text-center p-4 bg-accent-light rounded-lg">
                <div className="text-xl font-semibold text-accent tabular-nums">{result.createdOrders + result.updatedOrders}</div>
                <div className="text-xs text-text-tertiary mt-1">新建 {result.createdOrders} / 更新 {result.updatedOrders}</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm text-red mb-2">
                  错误详情 <Badge variant="abnormal">{result.errors.length} 条</Badge>
                </div>
                <div className="max-h-60 overflow-y-auto border border-border-light rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg">
                        <th className="text-left px-4 py-2.5 font-medium text-xs text-text-tertiary">行号</th>
                        <th className="text-left px-4 py-2.5 font-medium text-xs text-text-tertiary">错误信息</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="border-t border-border-light">
                          <td className="px-4 py-2.5 text-text-secondary tabular-nums">{err.row}</td>
                          <td className="px-4 py-2.5 text-text-primary">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="导入历史">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px]">时间</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px]">导入类型</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px]">文件名</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px]">成功</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px]">失败</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px]">操作人</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-text-tertiary text-[13px]">加载中...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-text-tertiary text-[13px]">暂无数据</td>
                </tr>
              ) : (
                history.map((row, idx) => (
                  <tr key={idx} className={idx < history.length - 1 ? 'border-b border-border-light' : ''}>
                    <td className="px-4 py-2.5 text-text-secondary">{row.time}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{row.type}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{row.filename}</td>
                    <td className="px-4 py-2.5 text-green">{row.success}</td>
                    <td className="px-4 py-2.5 text-red">{row.failed}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{row.operator}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
