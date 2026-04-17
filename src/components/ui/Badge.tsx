export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral' | 'accent';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
  primary: 'bg-sky-100 text-sky-800',
  neutral: 'bg-slate-100 text-slate-700',
  accent: 'bg-teal-100 text-teal-800',
};

interface BadgeProps {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

export default function Badge({ className = '', variant, children, dot }: BadgeProps) {
  const variantClass = variant ? variantClasses[variant] : '';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${variantClass} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />}
      {children}
    </span>
  );
}
