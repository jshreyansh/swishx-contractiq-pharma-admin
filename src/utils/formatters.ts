import { OrderStage, ERPStatus, OrderPricingMode, RCStatus, RCWorkflowStage } from '../types';

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
    hospital_confirmed: 'Hospital Reconfirmed',
    pending_manager_approval: 'Created',
    manager_approved: 'Created',
    pending_erp_entry: 'CFA / CNF Processing',
    erp_entered: 'CFA / CNF Processed',
    erp_sync_failed: 'Processing Exception',
    division_processing: 'Division Review',
    division_partially_approved: 'Division Review',
    division_partially_rejected: 'Division Rejected',
    final_approval_pending: 'Final Approval Pending',
    final_approved: 'Approved',
    final_rejected: 'Rejected',
    erp_sync_done: 'Approved',
    sent_to_supply_chain: 'Approved',
    sent_to_stockist: 'Approved',
    fulfillment_pending: 'Approved',
    completed: 'Closed',
  };
  return map[stage] || stage;
}

export function stageColor(stage: OrderStage): string {
  // 4 families only: slate (neutral), orange (action needed), blue (in-flow), green (done), red (failed)
  const map: Record<OrderStage, string> = {
    created:                      'bg-slate-100 text-slate-500',
    hospital_confirmed:           'bg-slate-100 text-slate-500',
    pending_manager_approval:     'bg-slate-100 text-slate-500',
    manager_approved:             'bg-slate-100 text-slate-500',
    pending_erp_entry:            'bg-orange-50 text-orange-600',
    erp_entered:                  'bg-blue-50 text-blue-600',
    erp_sync_failed:              'bg-red-50 text-red-600',
    erp_sync_done:                'bg-emerald-50 text-emerald-700',
    division_processing:          'bg-blue-50 text-blue-600',
    division_partially_approved:  'bg-blue-50 text-blue-600',
    division_partially_rejected:  'bg-red-50 text-red-600',
    final_approval_pending:       'bg-orange-50 text-orange-600',
    final_approved:               'bg-emerald-50 text-emerald-700',
    final_rejected:               'bg-red-50 text-red-600',
    sent_to_supply_chain:         'bg-emerald-50 text-emerald-700',
    sent_to_stockist:             'bg-emerald-50 text-emerald-700',
    fulfillment_pending:          'bg-emerald-50 text-emerald-700',
    completed:                    'bg-emerald-50 text-emerald-700',
  };
  return map[stage] || 'bg-slate-100 text-slate-500';
}

export function erpStatusLabel(status: ERPStatus): string {
  const map: Record<ERPStatus, string> = {
    pending_sync: 'Pending Processing',
    synced: 'Processed',
    manual_added: 'Exception Order',
    sync_failed: 'Processing Exception',
    resync_required: 'Rework Required',
  };
  return map[status] || status;
}

export function erpStatusColor(status: ERPStatus): string {
  const map: Record<ERPStatus, string> = {
    pending_sync:    'bg-slate-100 text-slate-500',
    synced:          'bg-emerald-50 text-emerald-700',
    manual_added:    'bg-blue-50 text-blue-600',
    sync_failed:     'bg-red-50 text-red-600',
    resync_required: 'bg-orange-50 text-orange-600',
  };
  return map[status] || 'bg-slate-100 text-slate-500';
}

export function getOrderPricingMode(order: {
  pricing_mode?: OrderPricingMode | null;
  rc_id?: string | null;
  linked_rate_contracts?: Array<{ id: string }> | null;
}): OrderPricingMode {
  if (order.pricing_mode === 'RC' || (order.linked_rate_contracts?.length || 0) > 0 || order.rc_id) return 'RC';
  return 'MANUAL';
}

export function orderPricingLabel(mode: OrderPricingMode): string {
  return mode === 'RC' ? 'RC Order' : 'Manual Order';
}

export function orderPricingColor(mode: OrderPricingMode): string {
  return mode === 'RC' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600';
}

export function rcStatusLabel(status: RCStatus): string {
  const map: Record<RCStatus, string> = {
    DRAFT:    'Draft',
    PENDING:  'Pending Approval',
    APPROVED: 'Active',
    REJECTED: 'Rejected',
    EXPIRED:  'Expired',
  };
  return map[status] || status;
}

export function rcStatusColor(status: RCStatus): string {
  const map: Record<RCStatus, string> = {
    DRAFT:    'bg-slate-100 text-slate-500',
    PENDING:  'bg-orange-50 text-orange-600',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-red-50 text-red-600',
    EXPIRED:  'bg-slate-100 text-slate-400',
  };
  return map[status] || 'bg-slate-100 text-slate-500';
}

export function rcUtilizationColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function rcWorkflowStageLabel(stage: RCWorkflowStage): string {
  const map: Record<RCWorkflowStage, string> = {
    hospital_acceptance_pending: 'Awaiting Hospital Acceptance',
    division_review:             'Division Review',
    sent_back_to_field_rep:      'Back With Field Rep',
    resubmitted:                 'Resubmitted (Round 2)',
    final_approval_pending:      'Ready for Final Approval',
    approved:                    'Approved',
    final_rejected:              'Final Rejected',
    discarded:                   'Discarded',
  };
  return map[stage] || stage;
}

export function rcWorkflowStageColor(stage: RCWorkflowStage): string {
  const map: Record<RCWorkflowStage, string> = {
    hospital_acceptance_pending: 'bg-slate-100 text-slate-500',
    division_review:             'bg-blue-50 text-blue-600',
    sent_back_to_field_rep:      'bg-amber-50 text-amber-700',
    resubmitted:                 'bg-indigo-50 text-indigo-600',
    final_approval_pending:      'bg-orange-50 text-orange-600',
    approved:                    'bg-emerald-50 text-emerald-700',
    final_rejected:              'bg-red-50 text-red-600',
    discarded:                   'bg-slate-100 text-slate-400',
  };
  return map[stage] || 'bg-slate-100 text-slate-500';
}
