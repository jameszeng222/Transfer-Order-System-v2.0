interface PaginationProps {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  current,
  pageSize,
  total,
  onChange,
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  if (total === 0) return null;

  return (
    <div className={`flex items-center justify-between px-5 py-3 ${className}`}>
      <span className="text-[12px] text-text-tertiary">
        共 {total} 条，第 {current}/{totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
          className="px-3 py-[5px] text-[12px] border border-border rounded-md bg-bg-card text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          上一页
        </button>
        {getPages().map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-[12px] text-text-tertiary">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`px-3 py-[5px] text-[12px] rounded-md transition-colors cursor-pointer ${
                p === current
                  ? 'bg-accent text-white'
                  : 'border border-border bg-bg-card text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          disabled={current >= totalPages}
          onClick={() => onChange(current + 1)}
          className="px-3 py-[5px] text-[12px] border border-border rounded-md bg-bg-card text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
