import { useState, useEffect, useCallback } from 'react';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import { Card, Button, Modal } from '../../components/ui';

interface DataStats {
  orders: number;
  cartons: number;
  cartonItems: number;
  orderItems: number;
  trackingEvents: number;
  discrepancies: number;
  freightBills: number;
  changeLogs: number;
}

const STAT_ITEMS: { key: keyof DataStats; label: string; color: string }[] = [
  { key: 'orders', label: '调拨单', color: 'text-accent' },
  { key: 'cartons', label: '箱记录', color: 'text-blue-500' },
  { key: 'cartonItems', label: '箱SKU明细', color: 'text-blue-400' },
  { key: 'orderItems', label: 'SKU明细', color: 'text-teal-500' },
  { key: 'trackingEvents', label: '物流事件', color: 'text-orange-500' },
  { key: 'discrepancies', label: '异常记录', color: 'text-red-500' },
  { key: 'freightBills', label: '运费账单', color: 'text-purple-500' },
  { key: 'changeLogs', label: '操作日志', color: 'text-text-tertiary' },
];

export default function DataManagementPage() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resultMsg, setResultMsg] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: DataStats }>('/data-management/stats');
      if (res.success) setStats(res.data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleClear = async () => {
    if (confirmText !== '确认清除') return;
    setClearLoading(true);
    try {
      const res = await api.post<{ success: boolean; message?: string }>('/data-management/clear-orders', {});
      if (res.success) {
        setResultMsg('所有调拨单和在途数据已清除');
        setConfirmOpen(false);
        setConfirmText('');
        fetchStats();
      } else {
        setResultMsg(res.message || '清除失败');
      }
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : '清除失败');
    } finally {
      setClearLoading(false);
    }
  };

  const totalRecords = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card title="数据概览" actions={
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchStats} loading={loading}>刷新</Button>
      }>
        <div className="px-5 py-4">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-text-primary" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {totalRecords.toLocaleString()}
            </div>
            <div className="text-xs text-text-tertiary mt-1">业务数据总记录数</div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {STAT_ITEMS.map((item) => (
              <div key={item.key} className="text-center p-2.5 rounded-lg bg-bg">
                <div className={`text-lg font-semibold ${item.color}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {stats ? stats[item.key].toLocaleString() : '--'}
                </div>
                <div className="text-[10px] text-text-tertiary">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="数据清除">
        <div className="px-5 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 mb-4">
            <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-700">
              <div className="font-medium mb-1">注意：此操作不可恢复</div>
              <div className="text-xs text-orange-600">将清除所有调拨单、箱记录、SKU明细、物流事件、异常记录、运费账单和操作日志。基础配置数据（仓库、物流商、团队、用户、SLA规则）不会被清除。</div>
            </div>
          </div>
          <Button variant="danger" icon={Trash2} onClick={() => { setResultMsg(''); setConfirmOpen(true); }}>
            清除所有业务数据
          </Button>
          {resultMsg && (
            <div className={`mt-3 text-sm ${resultMsg.includes('已清除') ? 'text-green-600' : 'text-red-500'}`}>
              {resultMsg}
            </div>
          )}
        </div>
      </Card>

      <Modal open={confirmOpen} title="确认清除数据" onClose={() => { setConfirmOpen(false); setConfirmText(''); }} width="sm">
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="mb-2">此操作将永久删除以下数据：</p>
            <ul className="list-disc list-inside text-xs text-gray-500 space-y-1">
              <li>所有调拨单（{stats?.orders ?? '--'}条）</li>
              <li>所有箱记录和箱SKU明细</li>
              <li>所有物流事件和异常记录</li>
              <li>所有运费账单和操作日志</li>
            </ul>
            <p className="mt-2 text-orange-600 font-medium">基础配置数据（仓库、物流商、团队、用户、SLA规则）不会被清除。</p>
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">请输入「确认清除」以继续</label>
            <input
              type="text"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="确认清除"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => { setConfirmOpen(false); setConfirmText(''); }}>取消</Button>
            <Button variant="danger" loading={clearLoading} onClick={handleClear} disabled={confirmText !== '确认清除'}>
              确认清除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
