import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-white border-emerald-200',
  error: 'bg-white border-red-200',
  info: 'bg-white border-sky-200',
  warning: 'bg-white border-amber-200',
};

const iconColors = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-sky-500',
  warning: 'text-amber-500',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map(toast => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-lg animate-slide-in-right ${colors[toast.type]}`}
          >
            <div className={`mt-0.5 shrink-0 ${iconColors[toast.type]}`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              <p className="text-xs mt-0.5 text-slate-500 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
