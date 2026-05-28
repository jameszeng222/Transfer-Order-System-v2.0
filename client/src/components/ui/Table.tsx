interface ColumnDef {
  key: string;
  title: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps {
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  loading?: boolean;
  emptyText?: string;
  className?: string;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  rowKey?: string;
  onSelectionChange?: (selectedKeys: Set<string>) => void;
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Table({
  columns,
  data,
  loading = false,
  emptyText = '暂无数据',
  className = '',
  selectable = false,
  selectedKeys = new Set<string>(),
  rowKey = 'id',
  onSelectionChange,
}: TableProps) {
  const allSelected = data.length > 0 && data.every((row) => selectedKeys.has(String(row[rowKey])));
  const someSelected = data.some((row) => selectedKeys.has(String(row[rowKey])));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    const newSet = new Set(selectedKeys);
    if (allSelected) {
      for (const row of data) newSet.delete(String(row[rowKey]));
    } else {
      for (const row of data) newSet.add(String(row[rowKey]));
    }
    onSelectionChange(newSet);
  };

  const toggleRow = (key: string) => {
    if (!onSelectionChange) return;
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    onSelectionChange(newSet);
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr>
            {selectable && (
              <th className="px-4 py-2.5 text-center w-[40px] border-b border-border-light bg-bg">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-accent cursor-pointer"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-left font-medium text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-light bg-bg ${alignClasses[col.align || 'left']}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="text-center py-16 text-text-tertiary text-[13px]"
              >
                加载中...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="text-center py-16 text-text-tertiary text-[13px]"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => {
              const key = String(row[rowKey]);
              const isSelected = selectedKeys.has(key);
              return (
                <tr
                  key={rowIdx}
                  className={`hover:bg-bg-hover cursor-pointer ${rowIdx < data.length - 1 ? 'border-b border-border-light' : ''} ${isSelected ? 'bg-accent/5' : ''}`}
                >
                  {selectable && (
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        className="w-3.5 h-3.5 accent-accent cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 text-text-secondary ${alignClasses[col.align || 'left']}`}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '--')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { ColumnDef };
