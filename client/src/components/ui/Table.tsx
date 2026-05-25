import type { ReactNode } from 'react';

interface ColumnDef {
  key: string;
  title: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps {
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  loading?: boolean;
  emptyText?: string;
  className?: string;
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
}: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr>
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
                colSpan={columns.length}
                className="text-center py-16 text-text-tertiary text-[13px]"
              >
                加载中...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-16 text-text-tertiary text-[13px]"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={`hover:bg-bg-hover cursor-pointer ${rowIdx < data.length - 1 ? 'border-b border-border-light' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 text-text-secondary ${alignClasses[col.align || 'left']}`}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as ReactNode) ?? '--'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { ColumnDef };
