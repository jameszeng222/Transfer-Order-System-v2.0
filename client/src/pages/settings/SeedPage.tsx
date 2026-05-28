import { useState } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function SeedPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [count, setCount] = useState(1000);

  if (!hasPermission('settings.manage')) {
    return <div className="text-center py-12 text-gray-500">无权限访问此页面</div>;
  }

  const handleGenerate = async () => {
    setLoading(true);
    setResult('');
    try {
      const res = await api.post<{ success: boolean; data: { orders: number; cartons: number; items: number }; error?: string }>('/seed/generate', { count });
      if (res.success) {
        setResult(`生成成功：${res.data.orders} 条调拨单，${res.data.cartons} 条箱记录，${res.data.items} 条SKU记录`);
      } else {
        setResult(`生成失败：${res.error}`);
      }
    } catch (err) {
      setResult(`请求失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('确定要清除所有测试数据吗？此操作不可恢复！')) return;
    setLoading(true);
    setResult('');
    try {
      const res = await api.delete<{ success: boolean; data: { message: string }; error?: string }>('/seed/clear');
      if (res.success) {
        setResult('测试数据已清除');
      } else {
        setResult(`清除失败：${res.error}`);
      }
    } catch (err) {
      setResult(`请求失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">测试数据管理</h1>

      <Card>
        <div className="space-y-4 p-4">
          <div>
            <p className="text-sm text-gray-600 mb-3">
              基于当前系统中的仓库、物流商、团队数据生成测试调拨单。请确保先在设置页面添加好仓库、物流商和团队。
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">生成数量</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                min={1}
                max={5000}
                className="h-9 w-32 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button onClick={handleGenerate} loading={loading}>
              生成测试数据
            </Button>
            <Button variant="danger" onClick={handleClear} loading={loading}>
              清除测试数据
            </Button>
          </div>

          {result && (
            <div className={`text-sm p-3 rounded-md ${result.includes('成功') || result.includes('已清除') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
