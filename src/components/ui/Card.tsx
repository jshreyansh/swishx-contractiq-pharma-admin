type CardVariant = 'default' | 'flat' | 'elevated';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: CardVariant;
  padding?: CardPadding;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white rounded-2xl shadow-card border border-slate-100/80',
  flat: 'bg-white rounded-2xl border border-slate-100/80',
  elevated: 'bg-white rounded-2xl shadow-card-lg border border-slate-100/80',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export default function Card({ className = '', children, onClick, variant = 'default', padding = 'none' }: CardProps) {
  return (
    <div
      className={`${variantClasses[variant]} ${paddingClasses[padding]} ${
        onClick ? 'cursor-pointer hover:shadow-card-hover hover:border-slate-200 transition-all duration-200' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
