import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface RowError {
  row: number;
  message: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: RowError[];
  createdOrders: number;
  updatedOrders: number;
}

interface TabConfig {
  key: string;
  label: string;
  subLabel: string;
  templateType: string;
  endpoint: string;
}

const TABS: TabConfig[] = [
  { key: 'main', label: '调拨单导入', subLabel: '5.1', templateType: 'main', endpoint: '/imports/upload' },
  { key: 'outbound', label: '出库回传', subLabel: '5.2', templateType: 'outbound', endpoint: '/imports/outbound' },
  { key: 'logistics', label: '物流信息', subLabel: '5.3', templateType: 'logistics', endpoint: '/imports/logistics' },
  { key: 'inbound', label: '入库回传', subLabel: '5.4', templateType: 'inbound', endpoint: '/imports/inbound' },
  { key: 'logistics-events', label: '物流事件', subLabel: '5.3细', templateType: 'logistics-events', endpoint: '/imports/logistics-events' },
];

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState('main');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const handleFileSelect = useCallback((f: File) => {
    if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
      setFile(f);
      setResult(null);
    } else {
      alert('请选择 Excel 文件（.xlsx / .xls）');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect],
  );

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api${currentTab.endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setResult({
          total: 0,
          success: 0,
          failed: 1,
          errors: [{ row: 0, message: data.error || '导入失败' }],
          createdOrders: 0,
          updatedOrders: 0,
        });
      }
    } catch (err: any) {
      setResult({
        total: 0,
        success: 0,
        failed: 1,
        errors: [{ row: 0, message: err.message || '网络错误' }],
        createdOrders: 0,
        updatedOrders: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/imports/templates/${currentTab.templateType}?token=${token}`, '_blank');
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    resetState();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">导入管理</h1>

      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            <span className="ml-1 text-xs text-gray-400">({tab.subLabel})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">{currentTab.label}</h3>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <Download size={14} />
            下载模板
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : file
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet size={32} className="text-green-500" />
              <span className="text-sm text-gray-700">{file.name}</span>
              <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={32} className="text-gray-400" />
              <span className="text-sm text-gray-500">拖拽文件到此处，或点击选择文件</span>
              <span className="text-xs text-gray-400">支持 .xlsx / .xls 格式</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={resetState}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            清除
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                导入中...
              </>
            ) : (
              '开始导入'
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">导入结果</h3>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{result.total}</div>
              <div className="text-xs text-gray-500">总行数</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-semibold text-green-600">{result.success}</div>
              <div className="text-xs text-gray-500">成功</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-semibold text-red-600">{result.failed}</div>
              <div className="text-xs text-gray-500">失败</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-semibold text-blue-600">
                {result.createdOrders + result.updatedOrders}
              </div>
              <div className="text-xs text-gray-500">
                新建 {result.createdOrders} / 更新 {result.updatedOrders}
              </div>
            </div>
          </div>

          {result.failed === 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              <CheckCircle size={16} />
              全部导入成功
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-red-600 mb-2">
                <XCircle size={16} />
                错误详情
              </div>
              <div className="max-h-60 overflow-y-auto border border-red-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50">
                      <th className="text-left px-3 py-2 font-medium text-red-700">行号</th>
                      <th className="text-left px-3 py-2 font-medium text-red-700">错误信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, idx) => (
                      <tr key={idx} className="border-t border-red-100">
                        <td className="px-3 py-2 text-gray-600">{err.row}</td>
                        <td className="px-3 py-2 text-gray-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
