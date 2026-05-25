import type { ElementType } from 'react';

type StatColor = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ElementType;
  color?: StatColor;
  sub?: string;
  trend?: { value: string; direction: 'up' | 'down' };
  className?: string;
}

const colorClasses: Record<StatColor, { icon: string }> = {
  blue: { icon: 'text-accent bg-accent-light' },
  green: { icon: 'text-green bg-green-light' },
  orange: { icon: 'text-orange bg-orange-light' },
  red: { icon: 'text-red bg-red-light' },
  purple: { icon: 'text-purple bg-purple-light' },
  teal: { icon: 'text-teal bg-teal-light' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  sub,
  trend,
  className = '',
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={`bg-bg-card border border-border rounded-lg px-5 py-4 ${className}`}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.icon}`}>
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[12px] text-text-tertiary font-medium mb-1.5">{label}</div>
          <div className="text-[28px] font-bold tracking-tight text-text-primary">{value}</div>
          {sub && (
            <div className="text-[11px] text-text-tertiary mt-1">{sub}</div>
          )}
          {trend && (
            <div className={`text-[11px] font-medium mt-1 ${trend.direction === 'up' ? 'text-green' : 'text-red'}`}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
