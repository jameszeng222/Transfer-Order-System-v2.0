interface DateRangeFilterProps {
  label: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export default function DateRangeFilter({ label, startValue, endValue, onStartChange, onEndChange }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-text-tertiary shrink-0">{label}</span>
      <input
        type="date"
        value={startValue}
        onChange={(e) => onStartChange(e.target.value)}
        className="h-7 px-2 text-xs border border-border rounded bg-bg text-text-primary focus:outline-none focus:border-accent"
      />
      <span className="text-xs text-text-tertiary">~</span>
      <input
        type="date"
        value={endValue}
        onChange={(e) => onEndChange(e.target.value)}
        className="h-7 px-2 text-xs border border-border rounded bg-bg text-text-primary focus:outline-none focus:border-accent"
      />
    </div>
  );
}
