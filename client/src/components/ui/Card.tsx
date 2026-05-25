import type { ReactNode } from 'react';

type CardPadding = 'none' | 'sm' | 'md';

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  padding?: CardPadding;
  className?: string;
  children?: ReactNode;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-5',
  md: 'p-6',
};

export function Card({
  title,
  subtitle,
  actions,
  padding = 'none',
  className = '',
  children,
}: CardProps) {
  return (
    <div className={`bg-bg-card border border-border rounded-xl ${className}`}>
      {(title || actions) && (
        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-text-tertiary">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
    </div>
  );
}
