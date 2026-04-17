interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export default function PageHeader({ title, description, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[18px] font-bold text-ink-900 tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-ink-500 mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
