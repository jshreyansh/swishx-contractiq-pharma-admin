import { Video as LucideIcon } from 'lucide-react';
import EmptyState from './EmptyState';
import { SkeletonTable } from './SkeletonLoader';
import { PackageSearch } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  skeletonRows?: number;
}

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  onRowClick,
  emptyTitle = 'No data found',
  emptyDescription,
  emptyIcon = PackageSearch,
  skeletonRows = 5,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <SkeletonTable rows={skeletonRows} cols={columns.length} />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map(col => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map(row => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
