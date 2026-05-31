import type { ReactNode } from 'react';

type BadgeVariant =
  | 'pending'
  | 'shipped'
  | 'transit'
  | 'received'
  | 'shelved'
  | 'partial_shelved'
  | 'complete'
  | 'abnormal';

interface BadgeProps {
  variant?: BadgeVariant;
  color?: string;
  className?: string;
  children?: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  pending: 'bg-bg-hover text-text-tertiary',
  shipped: 'bg-accent-light text-accent',
  transit: 'bg-orange-light text-orange',
  received: 'bg-green-light text-green',
  shelved: 'bg-teal-light text-teal',
  partial_shelved: 'bg-yellow-light text-yellow-700',
  complete: 'bg-purple-light text-purple',
  abnormal: 'bg-red-light text-red',
};

export function Badge({
  variant = 'pending',
  color,
  className = '',
  children,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-[2px] rounded text-[11px] font-medium ${color || variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
