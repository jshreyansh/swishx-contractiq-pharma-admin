import { OrderStage, ERPStatus } from '../types';

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function stageLabel(stage: OrderStage): string {
  const map: Record<OrderStage, string> = {
    created: 'Created',
    hospital_confirmed: 'Hospital Confirmed',
    pending_manager_approval: 'Pending Manager Approval',
    manager_approved: 'Manager Approved',
    pending_erp_entry: 'Pending ERP Entry',
    erp_entered: 'ERP Entered',
    erp_sync_failed: 'ERP Sync Failed',
    division_processing: 'Division Processing',
    division_partially_approved: 'Division Partially Approved',
    division_partially_rejected: 'Division Partially Rejected',
    final_approval_pending: 'Final Approval Pending',
    final_approved: 'Final Approved',
    final_rejected: 'Final Rejected',
    erp_sync_done: 'Final ERP Sync Done',
    sent_to_supply_chain: 'Sent to Supply Chain',
    sent_to_stockist: 'Sent to Stockist',
    fulfillment_pending: 'Fulfillment Pending',
    completed: 'Completed',
  };
  return map[stage] || stage;
}

export function stageColor(stage: OrderStage): string {
  const map: Record<OrderStage, string> = {
    created: 'bg-slate-100 text-slate-700',
    hospital_confirmed: 'bg-blue-100 text-blue-700',
    pending_manager_approval: 'bg-amber-100 text-amber-700',
    manager_approved: 'bg-sky-100 text-sky-700',
    pending_erp_entry: 'bg-orange-100 text-orange-700',
    erp_entered: 'bg-cyan-100 text-cyan-700',
    erp_sync_failed: 'bg-red-100 text-red-700',
    division_processing: 'bg-violet-100 text-violet-700',
    division_partially_approved: 'bg-indigo-100 text-indigo-700',
    division_partially_rejected: 'bg-pink-100 text-pink-700',
    final_approval_pending: 'bg-yellow-100 text-yellow-700',
    final_approved: 'bg-emerald-100 text-emerald-700',
    final_rejected: 'bg-red-100 text-red-700',
    erp_sync_done: 'bg-teal-100 text-teal-700',
    sent_to_supply_chain: 'bg-teal-100 text-teal-700',
    sent_to_stockist: 'bg-green-100 text-green-700',
    fulfillment_pending: 'bg-lime-100 text-lime-700',
    completed: 'bg-green-200 text-green-800',
  };
  return map[stage] || 'bg-gray-100 text-gray-700';
}

export function erpStatusLabel(status: ERPStatus): string {
  const map: Record<ERPStatus, string> = {
    pending_sync: 'Pending Sync',
    synced: 'Synced',
    manual_added: 'Manual Added',
    sync_failed: 'Sync Failed',
    resync_required: 'Re-sync Required',
  };
  return map[status] || status;
}

export function erpStatusColor(status: ERPStatus): string {
  const map: Record<ERPStatus, string> = {
    pending_sync: 'bg-amber-100 text-amber-700',
    synced: 'bg-emerald-100 text-emerald-700',
    manual_added: 'bg-blue-100 text-blue-700',
    sync_failed: 'bg-red-100 text-red-700',
    resync_required: 'bg-orange-100 text-orange-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}
