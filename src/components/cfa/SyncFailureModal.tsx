import { useState } from 'react';
import { X, RefreshCw, CreditCard as Edit3, FilePlus, AlertCircle, ChevronRight } from 'lucide-react';
import { Order } from '../../types';
import { formatINR } from '../../utils/formatters';

type RecoveryAction = 'retry' | 'edit' | 'manual' | null;

interface Props {
  order: Order;
  onClose: () => void;
  onRetry: (order: Order) => Promise<void>;
  onEditAndRetry: (order: Order, newErpId: string) => Promise<void>;
  onCreateManual: (order: Order) => void;
}

export default function SyncFailureModal({ order, onClose, onRetry, onEditAndRetry, onCreateManual }: Props) {
  const [action, setAction] = useState<RecoveryAction>(null);
  const [erpInput, setErpInput] = useState(order.erp_order_id || '');
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    await onRetry(order);
    setLoading(false);
  }

  async function handleEditRetry() {
    if (!erpInput.trim()) return;
    setLoading(true);
    await onEditAndRetry(order, erpInput.trim());
    setLoading(false);
  }

  function handleManual() {
    onCreateManual(order);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={16} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Processing Exception</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{order.order_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            CFA / CNF processing for order <span className="font-mono font-semibold">{order.order_id}</span> needs recovery.
            Choose a recovery action below.
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recovery Options</p>

            <button
              onClick={() => setAction(action === 'retry' ? null : 'retry')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                action === 'retry' ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action === 'retry' ? 'bg-sky-100' : 'bg-slate-100'}`}>
                  <RefreshCw size={14} className={action === 'retry' ? 'text-sky-600' : 'text-slate-500'} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Retry Processing</p>
                  <p className="text-xs text-slate-500 mt-0.5">Re-attempt processing with the same reference</p>
                </div>
              </div>
              <ChevronRight size={14} className={`transition-transform ${action === 'retry' ? 'rotate-90 text-sky-500' : 'text-slate-300'}`} />
            </button>

            {action === 'retry' && (
              <div className="ml-4 p-4 bg-sky-50 border border-sky-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-500">Current Reference</p>
                  <span className="font-mono text-sm font-semibold text-slate-800">{order.erp_order_id || '—'}</span>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={loading}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Retrying...' : 'Retry Processing Now'}
                </button>
              </div>
            )}

            <button
              onClick={() => setAction(action === 'edit' ? null : 'edit')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                action === 'edit' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action === 'edit' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  <Edit3 size={14} className={action === 'edit' ? 'text-amber-600' : 'text-slate-500'} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Edit Reference &amp; Retry</p>
                  <p className="text-xs text-slate-500 mt-0.5">Correct the processing reference and retry</p>
                </div>
              </div>
              <ChevronRight size={14} className={`transition-transform ${action === 'edit' ? 'rotate-90 text-amber-500' : 'text-slate-300'}`} />
            </button>

            {action === 'edit' && (
              <div className="ml-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Processing Reference</label>
                  <input
                    type="text"
                    value={erpInput}
                    onChange={e => setErpInput(e.target.value)}
                    placeholder="e.g. CFA-24018"
                    autoFocus
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 font-mono"
                  />
                </div>
                <button
                  onClick={handleEditRetry}
                  disabled={!erpInput.trim() || loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Saving...' : 'Save & Retry'}
                </button>
              </div>
            )}

            <button
              onClick={() => setAction(action === 'manual' ? null : 'manual')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                action === 'manual' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action === 'manual' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <FilePlus size={14} className={action === 'manual' ? 'text-emerald-600' : 'text-slate-500'} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Create Exception Order</p>
                  <p className="text-xs text-slate-500 mt-0.5">Skip automated processing and create an exception order</p>
                </div>
              </div>
              <ChevronRight size={14} className={`transition-transform ${action === 'manual' ? 'rotate-90 text-emerald-500' : 'text-slate-300'}`} />
            </button>

            {action === 'manual' && (
              <div className="ml-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="mb-3 space-y-1 text-xs text-slate-600">
                  <p>A new exception order will be created with the following details pre-filled:</p>
                  <ul className="mt-2 space-y-0.5 text-slate-500">
                    <li>• Hospital: <span className="font-medium text-slate-700">{order.hospital?.name}</span></li>
                    <li>• Stockist: <span className="font-medium text-slate-700">{order.stockist?.name}</span></li>
                    <li>• Value: <span className="font-medium text-slate-700">{formatINR(order.total_value)}</span></li>
                  </ul>
                  <p className="mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                    The exception order will be flagged and routed into division review.
                  </p>
                </div>
                <button
                  onClick={handleManual}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FilePlus size={13} /> Open Exception Order Form
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
