import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpRight, Building2, Calendar, CheckCircle, ChevronDown,
  ChevronUp, Clock, Mail, Package, Phone, ScrollText, User, XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RateContract, RateContractApproval, RateContractItem, RCItemHistory, RCStatus, RCTimeline } from '../types';
import { loadLinkedOrdersForRateContracts } from '../utils/orderRateContracts';
import {
  formatDate, formatDateTime, formatINR, rcStatusColor,
  rcStatusLabel, rcUtilizationColor, rcWorkflowStageColor, rcWorkflowStageLabel, timeAgo,
} from '../utils/formatters';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface RCWithStats extends RateContract {
  items: RateContractItem[];
  ordersCount: number;
  usedValue: number;
  totalExpectedValue: number;
  utilizationPct: number;
  effectiveStatus: RCStatus;
  daysLeft: number;
}

interface LinkedOrder {
  id: string;
  order_id: string;
  total_value: number;
  linked_rc_count?: number;
}

function effectiveStatus(rc: RateContract): RCStatus {
  if (rc.status === 'APPROVED' && new Date(rc.valid_to) < new Date()) return 'EXPIRED';
  return rc.status;
}

function daysLeft(rc: RateContract): number {
  return Math.ceil((new Date(rc.valid_to).getTime() - Date.now()) / 86400000);
}

function computeStats(rc: RateContract, items: RateContractItem[], ordersCount: number): RCWithStats {
  const usedValue = items.reduce((sum, item) => sum + item.negotiated_price * item.used_qty, 0);
  const expectedValue = items.reduce((sum, item) => sum + item.negotiated_price * item.expected_qty, 0);
  const utilizationPct = expectedValue > 0 ? Math.round((usedValue / expectedValue) * 100) : 0;

  return {
    ...rc,
    items,
    ordersCount,
    usedValue,
    totalExpectedValue: expectedValue,
    utilizationPct,
    effectiveStatus: effectiveStatus(rc),
    daysLeft: daysLeft(rc),
  };
}

function approvalStatusBadge(status: RateContractApproval['status']): string {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

function historyActionLabel(actionType: string): string {
  if (actionType === 'proposed') return 'proposed';
  if (actionType === 'division_edit') return 'edited';
  if (actionType === 'resubmitted') return 'resubmitted';
  if (actionType === 'final_edit') return 'adjusted (final review)';
  return actionType;
}

function historyActionColor(actionType: string): string {
  if (actionType === 'proposed') return 'text-slate-500';
  if (actionType === 'division_edit') return 'text-blue-600';
  if (actionType === 'resubmitted') return 'text-amber-600';
  if (actionType === 'final_edit') return 'text-indigo-600';
  return 'text-slate-400';
}

function timelineIconClass(actionType: string): string {
  if (actionType.includes('approved')) return 'bg-emerald-100';
  if (actionType.includes('rejected')) return 'bg-red-100';
  if (actionType === 'created') return 'bg-sky-100';
  return 'bg-slate-100';
}

function getTimelineIcon(actionType: string) {
  if (actionType.includes('approved')) return <CheckCircle size={10} className="text-emerald-600" />;
  if (actionType.includes('rejected')) return <XCircle size={10} className="text-red-600" />;
  if (actionType === 'created') return <ScrollText size={10} className="text-sky-600" />;
  return <Clock size={10} className="text-slate-500" />;
}

export default function RateContractDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [rc, setRC] = useState<RCWithStats | null>(null);
  const [approvals, setApprovals] = useState<RateContractApproval[]>([]);
  const [timeline, setTimeline] = useState<RCTimeline[]>([]);
  const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);
  const [itemHistory, setItemHistory] = useState<Map<string, RCItemHistory[]>>(new Map());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  function toggleItemHistory(itemId: string) {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  useEffect(() => {
    if (id) loadRC();
  }, [id]);

  async function loadRC() {
    if (!id) return;

    setLoading(true);

    const [
      { data: rcData },
      { data: itemData },
      { data: approvalsData },
      { data: timelineData },
      { data: historyData },
      linkedOrdersResult,
    ] = await Promise.all([
      supabase.from('rate_contracts').select('*, hospital:hospitals(*), field_rep:field_reps(*)').eq('id', id).single(),
      supabase.from('rate_contract_items').select('*, division:divisions(*)').eq('rc_id', id),
      supabase.from('rate_contract_approvals').select('*, division:divisions(*), approver_user:app_users(*)').eq('rc_id', id).order('sequence_order'),
      supabase.from('rate_contract_timeline').select('*').eq('rc_id', id).order('created_at', { ascending: false }),
      supabase.from('rate_contract_item_history').select('*').eq('rc_id', id).order('created_at', { ascending: true }),
      loadLinkedOrdersForRateContracts([id]),
    ]);

    const historyMap = new Map<string, RCItemHistory[]>();
    for (const h of (historyData || []) as RCItemHistory[]) {
      const arr = historyMap.get(h.rc_item_id) || [];
      arr.push(h);
      historyMap.set(h.rc_item_id, arr);
    }
    setItemHistory(historyMap);

    let linkedOrders = linkedOrdersResult.linkedOrdersByRcId.get(id) || [];

    if (linkedOrders.length > 0 && !linkedOrdersResult.schemaUnavailable) {
      const { data: orderLinks } = await supabase
        .from('order_rate_contract_links')
        .select('order_id, rc_id')
        .in('order_id', linkedOrders.map(order => order.id));

      if (orderLinks) {
        const rcCountByOrderId = new Map<string, number>();
        for (const link of orderLinks) {
          rcCountByOrderId.set(link.order_id, (rcCountByOrderId.get(link.order_id) || 0) + 1);
        }

        linkedOrders = linkedOrders.map(order => ({
          ...order,
          linked_rc_count: rcCountByOrderId.get(order.id) || 1,
        }));
      }
    }

    if (rcData) {
      const items = (itemData || []) as RateContractItem[];
      const ordersCount = linkedOrders.length;
      setRC(computeStats(rcData as RateContract, items, ordersCount));
    } else {
      setRC(null);
    }

    setApprovals((approvalsData || []) as RateContractApproval[]);
    setTimeline((timelineData || []) as RCTimeline[]);
    setLinkedOrders(linkedOrders as LinkedOrder[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading rate contract...</p>
        </div>
      </div>
    );
  }

  if (!rc) {
    return (
      <div className="space-y-5 max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/rate-contracts')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
        >
          <ArrowLeft size={14} /> Back to Rate Contracts
        </button>

        <div className="py-20 text-center text-slate-400">
          <ScrollText size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">Rate contract not found</p>
          <p className="text-sm text-slate-400 mt-1">The rate contract you are looking for does not exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const remainingValue = Math.max(rc.totalExpectedValue - rc.usedValue, 0);
  const linkedOrderValue = linkedOrders.reduce((sum, order) => sum + order.total_value, 0);
  const utilizationTone = rc.utilizationPct >= 90 ? 'text-red-500' : rc.utilizationPct >= 70 ? 'text-amber-600' : 'text-emerald-600';
  const hospitalPocEmail = rc.hospital?.contact_email?.trim() || 'Unavailable';
  const hospitalPocPhone = rc.hospital?.contact_phone?.trim() || 'Unavailable';
  const fieldRepName = rc.field_rep?.name?.trim() || 'Unavailable';
  const fieldRepEmail = rc.field_rep?.email?.trim() || 'Unavailable';
  const fieldRepPhone = rc.field_rep?.phone?.trim() || 'Unavailable';
  const requiredDivisionIds = [...new Set(
    rc.items
      .map(item => item.division_id)
      .filter((divisionId): divisionId is string => Boolean(divisionId))
  )];
  const divisionApprovals = approvals.filter(approval => approval.approval_stage === 'division');
  const coveredDivisionIds = new Set(
    divisionApprovals
      .map(approval => approval.division_id)
      .filter((divisionId): divisionId is string => Boolean(divisionId))
  );
  const missingDivisionApprovalCount = requiredDivisionIds.filter(divisionId => !coveredDivisionIds.has(divisionId)).length;
  const pendingDivisionApprovalCount = divisionApprovals.filter(
    approval => approval.division_id && requiredDivisionIds.includes(approval.division_id) && approval.status === 'pending'
  ).length;
  const divisionsFullyDecided =
    requiredDivisionIds.length > 0 &&
    missingDivisionApprovalCount === 0 &&
    pendingDivisionApprovalCount === 0;

  let contextClass = 'bg-slate-50 border-slate-100';
  let contextTextClass = 'text-slate-500';
  let contextTitle = 'Draft contract';
  let contextMessage = 'This contract has not been approved for order execution yet.';

  if (rc.effectiveStatus === 'APPROVED') {
    contextClass = 'bg-indigo-50 border-indigo-100';
    contextTextClass = 'text-indigo-600';
    contextTitle = linkedOrders.length > 0 ? 'Approved contract in active use' : 'Approved contract ready for execution';
    contextMessage = linkedOrders.length > 0
      ? `${linkedOrders.length} order${linkedOrders.length !== 1 ? 's have' : ' has'} already been created against this approved RC.`
      : 'This approved RC can now be used to create RC-backed orders with locked negotiated pricing.';
  } else if (rc.effectiveStatus === 'PENDING') {
    contextClass = 'bg-amber-50 border-amber-100';
    contextTextClass = 'text-amber-700';
    contextTitle = divisionsFullyDecided ? 'Ready for final approval' : 'Waiting on division approvals';
    contextMessage = divisionsFullyDecided
      ? 'All division approvals are complete. Final approvers can now review and act on this RC.'
      : `This RC is still under division review. Final approval stays locked until every division on this RC has completed its action.${missingDivisionApprovalCount > 0 || pendingDivisionApprovalCount > 0 ? ` Remaining division actions: ${missingDivisionApprovalCount + pendingDivisionApprovalCount}.` : ''}`;
  } else if (rc.effectiveStatus === 'REJECTED') {
    contextClass = 'bg-red-50 border-red-100';
    contextTextClass = 'text-red-600';
    contextTitle = 'Rejected contract';
    contextMessage = 'This RC was rejected and should not be used for new orders unless it is revised and resubmitted.';
  } else if (rc.effectiveStatus === 'EXPIRED') {
    contextClass = 'bg-slate-50 border-slate-100';
    contextTextClass = 'text-slate-600';
    contextTitle = 'Expired contract';
    contextMessage = 'This RC is no longer valid for new orders, though earlier linked orders remain part of its history.';
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <button
        onClick={() => navigate('/rate-contracts')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
      >
        <ArrowLeft size={14} /> Back to Rate Contracts
      </button>

      <Card variant="elevated" className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{rc.rc_code}</h1>
              <Badge className={rcStatusColor(rc.effectiveStatus)}>{rcStatusLabel(rc.effectiveStatus)}</Badge>
              {rc.workflow_stage && rc.workflow_stage !== 'approved' && rc.workflow_stage !== 'final_rejected' && (
                <Badge className={rcWorkflowStageColor(rc.workflow_stage)}>{rcWorkflowStageLabel(rc.workflow_stage)}</Badge>
              )}
              {rc.negotiation_round > 1 && (
                <Badge className="bg-amber-50 text-amber-700">Round {rc.negotiation_round}</Badge>
              )}
              <Badge className="bg-indigo-50 text-indigo-700">Rate Contract</Badge>
            </div>
            <p className="text-slate-400 text-xs mt-2">
              Created {formatDateTime(rc.created_at)} &middot; Last updated {timeAgo(rc.updated_at)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-slate-900">{formatINR(rc.totalExpectedValue)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Expected Contract Value</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <Building2 size={11} /> Hospital
            </p>
            <p className="text-sm font-semibold text-slate-800">{rc.hospital?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{rc.hospital?.city}, {rc.hospital?.state}</p>
            <div className="mt-1.5 space-y-1 text-xs text-slate-500">
              <p>POC: {rc.hospital?.contact_name || 'Unavailable'}</p>
              <p className="flex items-center gap-1.5">
                <Mail size={11} className="text-slate-400" />
                <span className="break-all">{hospitalPocEmail}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Phone size={11} className="text-slate-400" />
                <span>{hospitalPocPhone}</span>
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <User size={11} /> Field Rep
            </p>
            <p className="text-sm font-semibold text-slate-800">{fieldRepName}</p>
            <div className="mt-1.5 space-y-1 text-xs text-slate-500">
              <p className="flex items-center gap-1.5">
                <Mail size={11} className="text-slate-400" />
                <span className="break-all">{fieldRepEmail}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Phone size={11} className="text-slate-400" />
                <span>{fieldRepPhone}</span>
              </p>
              <p>Manager: {rc.field_rep?.manager_name || 'Unavailable'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <Calendar size={11} /> Validity
            </p>
            <p className="text-sm font-semibold text-slate-800">{formatDate(rc.valid_from)} – {formatDate(rc.valid_to)}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {rc.daysLeft >= 0 ? `${rc.daysLeft} day${rc.daysLeft !== 1 ? 's' : ''} remaining` : 'Expired'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <Package size={11} /> Linked Orders
            </p>
            <p className="text-sm font-semibold text-slate-800">{rc.ordersCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatINR(linkedOrderValue)} booked via this RC</p>
          </div>
        </div>
      </Card>

      <div className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${contextClass}`}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/60">
          <ScrollText size={15} className={contextTextClass} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold uppercase tracking-wide ${contextTextClass}`}>{contextTitle}</div>
          <p className={`text-xs mt-0.5 ${contextTextClass}`}>{contextMessage}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Package size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Product Table</h2>
              <span className="ml-auto text-xs text-slate-400">{rc.items.length} items</span>
              {itemHistory.size > 0 && (
                <span className="text-[11px] font-medium text-indigo-500">· {itemHistory.size} items have negotiation history</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Division</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Exp. Qty</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cap</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Unit Price</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Used</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Remaining</th>
                    <th className="w-9 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rc.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                        No products configured on this rate contract.
                      </td>
                    </tr>
                  ) : rc.items.map(item => {
                    const history = itemHistory.get(item.id) || [];
                    const isExpanded = expandedItems.has(item.id);
                    const hasHistory = history.length > 0;
                    const capQty = item.cap_qty ?? item.expected_qty;
                    const remainingQty = Math.max(capQty - item.used_qty, 0);
                    const maxRound = hasHistory ? Math.max(...history.map(h => h.negotiation_round)) : 1;

                    return (
                      <Fragment key={item.id}>
                        <tr
                          className={`border-b border-slate-100 transition-colors ${
                            isExpanded ? 'bg-indigo-50/30' : remainingQty === 0 ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">{item.product_name}</span>
                              {hasHistory && maxRound >= 2 && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">R{maxRound}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-slate-500">{item.division?.name || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{item.expected_qty.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">{capQty.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800 tabular-nums">{formatINR(item.negotiated_price)}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{item.used_qty.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className={`text-sm font-semibold ${remainingQty === 0 ? 'text-red-600' : remainingQty < capQty * 0.1 ? 'text-amber-600' : 'text-emerald-700'}`}>
                              {remainingQty.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            {hasHistory ? (
                              <button
                                onClick={() => toggleItemHistory(item.id)}
                                className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                                  isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                }`}
                                title={isExpanded ? 'Hide negotiation trail' : 'Show negotiation trail'}
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            ) : (
                              <span className="w-6 h-6 block" />
                            )}
                          </td>
                        </tr>

                        {hasHistory && isExpanded && (
                          <tr className="border-b border-indigo-100/60 bg-indigo-50/20">
                            <td colSpan={8} className="px-6 pt-3 pb-4">
                              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">Negotiation Trail — {item.product_name}</p>
                              <div className="relative pl-4">
                                {/* Vertical connector line */}
                                {history.length > 1 && (
                                  <div className="absolute left-[7px] top-3 bottom-3 w-px bg-slate-200" />
                                )}
                                <div className="space-y-3">
                                  {history.map((h, idx) => {
                                    const isLast = idx === history.length - 1;
                                    const dotColor = h.action_type === 'proposed' ? 'bg-slate-400'
                                      : h.action_type === 'division_edit' ? 'bg-blue-500'
                                      : h.action_type === 'resubmitted' ? 'bg-amber-500'
                                      : 'bg-indigo-500';
                                    const priceText = h.action_type === 'proposed'
                                      ? `${formatINR(h.price_after)}, qty ${h.qty_after.toLocaleString('en-IN')}`
                                      : h.price_before !== null && h.price_before !== h.price_after
                                        ? `${formatINR(h.price_before)} → ${formatINR(h.price_after)}${h.qty_before !== null && h.qty_before !== h.qty_after ? ` · qty ${h.qty_before} → ${h.qty_after}` : ''}`
                                        : h.qty_before !== null && h.qty_before !== h.qty_after
                                          ? `qty ${h.qty_before} → ${h.qty_after}`
                                          : 'confirmed, no change';

                                    return (
                                      <div key={h.id} className="flex items-start gap-3 relative">
                                        {/* Dot */}
                                        <div className={`shrink-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm mt-0.5 ${dotColor}`} />
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-baseline gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold rounded px-1 py-0.5 ${h.negotiation_round >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>R{h.negotiation_round}</span>
                                            <span className="text-xs font-semibold text-slate-700">{h.actor_name}</span>
                                            <span className={`text-xs ${historyActionColor(h.action_type)}`}>{historyActionLabel(h.action_type)}</span>
                                            <span className="text-xs text-slate-600 tabular-nums font-medium">{priceText}</span>
                                            {isLast && h.action_type !== 'proposed' && (
                                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">Current</span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(h.created_at)}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <CheckCircle size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Approval Chain</h2>
            </div>
            <div className="p-4 space-y-2">
              {approvals.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Approval chain has not been initialized yet.</p>
              ) : approvals.map(approval => (
                <div key={approval.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{approval.approver_name || 'Pending Approver'}</p>
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${
                        approval.approval_stage === 'division' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {approval.approval_stage === 'division' ? (approval.division?.name || 'Division') : `Final #${approval.sequence_order}`}
                      </span>
                    </div>
                    {approval.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{approval.rejection_reason}</p>}
                    {approval.decided_at && <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(approval.decided_at)}</p>}
                  </div>
                  <Badge className={approvalStatusBadge(approval.status)}>{approval.status}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <ScrollText size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Linked Orders</h2>
              <span className="ml-auto text-xs text-slate-400">{linkedOrders.length} orders</span>
            </div>
            <div className="p-4 space-y-2">
              {linkedOrders.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No orders have been created from this rate contract yet.</p>
              ) : linkedOrders.map(order => (
                <button
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-semibold text-slate-800">{order.order_id}</span>
                    {order.linked_rc_count && order.linked_rc_count > 1 && (
                      <p className="mt-0.5 text-xs text-indigo-600">Part of {order.linked_rc_count} linked RCs</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{formatINR(order.total_value)}</span>
                    <ArrowUpRight size={12} className="text-slate-300 group-hover:text-brand-orange transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contract Snapshot</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Status</span>
                <Badge className={rcStatusColor(rc.effectiveStatus)}>{rcStatusLabel(rc.effectiveStatus)}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Utilization</span>
                <span className={`text-xs font-semibold ${utilizationTone}`}>{rc.utilizationPct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Used Value</span>
                <span className="text-slate-700 text-xs">{formatINR(rc.usedValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Remaining Value</span>
                <span className="text-slate-700 text-xs">{formatINR(remainingValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Days Left</span>
                <span className={`text-xs font-semibold ${rc.daysLeft < 0 ? 'text-red-600' : rc.daysLeft <= 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                  {rc.daysLeft >= 0 ? `${rc.daysLeft}d` : 'Expired'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilization Bar</p>
                <span className="text-xs font-semibold text-slate-700">{rc.utilizationPct}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${rcUtilizationColor(rc.utilizationPct)}`}
                  style={{ width: `${Math.min(rc.utilizationPct, 100)}%` }}
                />
              </div>
            </div>

            {rc.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-slate-600 leading-relaxed">{rc.notes}</p>
              </div>
            )}
          </Card>

          <Card>
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full px-4 py-3 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
              aria-expanded={showTimeline}
            >
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Timeline</h2>
                <span className="text-xs text-slate-400">({timeline.length})</span>
              </div>
              {showTimeline ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
            {showTimeline && (
              <div className="p-4">
                {timeline.length === 0 ? (
                  <p className="text-sm text-slate-400">No timeline events yet</p>
                ) : (
                  <div className="space-y-0">
                    {timeline.map((event, idx) => (
                      <div key={event.id} className="flex gap-3 relative">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${timelineIconClass(event.action_type)}`}>
                            {getTimelineIcon(event.action_type)}
                          </div>
                          {idx < timeline.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1 min-h-[20px]" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <p className="text-xs font-semibold text-slate-800">{event.action}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {event.actor_name} &middot; {event.actor_role} &middot; {timeAgo(event.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
