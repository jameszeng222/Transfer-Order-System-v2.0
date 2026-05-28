import { useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

interface TimeFilterPanelProps {
  filters: {
    createTimeRange: { start: string; end: string };
    departureTimeRange: { start: string; end: string };
    pickupTimeRange: { start: string; end: string };
    logisticsSignTimeRange: { start: string; end: string };
    shelfTimeRange: { start: string; end: string };
  };
  onChange: (filters: TimeFilterPanelProps['filters']) => void;
}

const FIELDS = [
  { key: 'createTimeRange', label: '创建时间', startKey: 'start', endKey: 'end' },
  { key: 'departureTimeRange', label: '出库时间', startKey: 'start', endKey: 'end' },
  { key: 'pickupTimeRange', label: '收件时间', startKey: 'start', endKey: 'end' },
  { key: 'logisticsSignTimeRange', label: '签收时间', startKey: 'start', endKey: 'end' },
  { key: 'shelfTimeRange', label: '上架时间', startKey: 'start', endKey: 'end' },
] as const;

export default function TimeFilterPanel({ filters, onChange }: TimeFilterPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = FIELDS.filter(f => filters[f.key].start || filters[f.key].end).length;

  const handleClear = () => {
    onChange({
      createTimeRange: { start: '', end: '' },
      departureTimeRange: { start: '', end: '' },
      pickupTimeRange: { start: '', end: '' },
      logisticsSignTimeRange: { start: '', end: '' },
      shelfTimeRange: { start: '', end: '' },
    });
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="h-7 px-2.5 flex items-center gap-1.5 text-xs border border-border rounded bg-bg hover:bg-bg-hover transition-colors"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>时间筛选</span>
        {activeCount > 0 && (
          <span className="w-4 h-4 flex items-center justify-center bg-accent text-white rounded-full text-[10px]">{activeCount}</span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-2 bg-bg-card border border-border rounded-lg p-3">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-semibold text-text-secondary">时间范围筛选</span>
            {activeCount > 0 && (
              <button onClick={handleClear} className="text-[11px] text-text-tertiary hover:text-accent flex items-center gap-0.5">
                <X className="w-3 h-3" />清除全部
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {FIELDS.map(f => (
              <div key={f.key}>
                <div className="text-[11px] text-text-tertiary mb-1">{f.label}</div>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={filters[f.key].start}
                    onChange={e => onChange({ ...filters, [f.key]: { ...filters[f.key], start: e.target.value } })}
                    className="h-7 px-2 text-xs border border-border rounded bg-bg text-text-primary focus:outline-none focus:border-accent w-[120px]"
                  />
                  <span className="text-text-tertiary text-xs">~</span>
                  <input
                    type="date"
                    value={filters[f.key].end}
                    onChange={e => onChange({ ...filters, [f.key]: { ...filters[f.key], end: e.target.value } })}
                    className="h-7 px-2 text-xs border border-border rounded bg-bg text-text-primary focus:outline-none focus:border-accent w-[120px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
