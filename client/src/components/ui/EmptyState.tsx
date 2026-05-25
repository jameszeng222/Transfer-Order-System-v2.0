import type { ReactNode, ElementType } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ElementType;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = '暂无数据',
  description,
  icon: Icon = Inbox,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-bg-hover flex items-center justify-center mb-4">
        <Icon size={22} strokeWidth={1.5} className="text-text-tertiary" />
      </div>
      <h3 className="text-[13px] font-medium text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-[12px] text-text-tertiary mb-5 max-w-xs text-center">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
