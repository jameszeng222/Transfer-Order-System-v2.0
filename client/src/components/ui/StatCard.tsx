import type { ElementType } from 'react';

type StatColor = 'blue' | 'green' | 'amber' | 'red';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ElementType;
  color?: StatColor;
  subtitle?: string;
  className?: string;
}

const colorClasses: Record<StatColor, { border: string; icon: string }> = {
  blue: {
    border: 'border-l-blue-500',
    icon: 'text-blue-600 bg-blue-50',
  },
  green: {
    border: 'border-l-green-500',
    icon: 'text-green-600 bg-green-50',
  },
  amber: {
    border: 'border-l-amber-500',
    icon: 'text-amber-600 bg-amber-50',
  },
  red: {
    border: 'border-l-red-500',
    icon: 'text-red-600 bg-red-50',
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  subtitle,
  className = '',
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${colors.border} p-5 ${className}`}
    >
      <div className="flex items-center gap-4">
        {Icon && (
          <div
            className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${colors.icon}`}
          >
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500 mt-0.5">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}
