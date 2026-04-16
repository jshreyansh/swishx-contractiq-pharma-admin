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
  default: 'bg-app-surface rounded-2xl border border-app-surface-dark',
  flat: 'bg-app-surface rounded-2xl',
  elevated: 'bg-app-surface rounded-2xl border border-app-surface-dark shadow-sm',
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
        onClick ? 'cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all duration-150' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
