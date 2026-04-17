import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, CheckCircle, XCircle, ArrowUpRight, Package,
  X, Pencil, Trash2, Save, ChevronRight, ScrollText, Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, DivisionApproval, OrderItem, RateContract, RateContractItem, RateContractApproval } from '../types';
import { formatINR, formatDateTime, stageLabel, stageColor, rcStatusLabel, rcStatusColor, rcWorkflowStageLabel, rcWorkflowStageColor } from '../utils/formatters';
import { syncOrderStageAfterDivisionDecision } from '../utils/orderWorkflow';
import { getMutationError } from '../utils/supabaseWrites';
import { useApp } from '../context/AppContext';
import Badge from '../components/ui/Badge';

interface OrderWithDivision extends Order {
  my_approval?: DivisionApproval;
  my_items?: OrderItem[];
}

interface EditingItem {
  id: string;
  final_quantity: number;
  final_price: number;
}

interface RCWithMyApproval extends RateContract {
  myApproval?: RateContractApproval;
  myItems?: RateContractItem[];
}

export default function DivisionWorkspace() {
  const navigate = useNavigate();
  const { currentRole, currentUser, addToast } = useApp();
  const [orders, setOrders] = useState<OrderWithDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderWithDivision | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  // RC tab state
  const [activeModule, setActiveModule] = useState<'orders' | 'rc'>('orders');
  const [rcs, setRCs] = useState<RCWithMyApproval[]>([]);
  const [selectedRC, setSelectedRC] = useState<RCWithMyApproval | null>(null);
  const [rcRejectModal, setRCRejectModal] = useState(false);
  const [rcRejectReason, setRCRejectReason] = useState('');
  const [editingRCItem, setEditingRCItem] = useState<{ id: string; negotiated_price: number; expected_qty: number } | null>(null);

  const divisionId = currentUser?.division_id;
  const canEdit = selected?.my_approval?.status === 'pending' &&
    (currentRole === 'division_approver' || currentRole === 'admin');
  const canEditRC = currentRole === 'division_approver' &&
    selectedRC?.myApproval?.status === 'pending';

  useEffect(() => {
    if (divisionId || currentRole === 'admin') {
      loadOrders();
      loadDivisionRCs();
    }
  }, [currentUser, currentRole]);

  // Scroll right panel to top whenever a new order is selected
  useEffect(() => {
    if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
  }, [selected?.id]);

  async function loadOrders() {
    setLoading(true);
    const stageFilter = [
      'division_processing', 'division_partially_approved',
      'division_partially_rejected', 'final_approval_pending', 'final_approved',
    ];
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*)')
      .in('stage', stageFilter)
      .order('updated_at', { ascending: false });

    if (!ordersData) { setLoading(false); return; }

    const targetDivId = currentRole === 'admin' ? null : divisionId;

    const enriched: OrderWithDivision[] = await Promise.all(
      ordersData.map(async (o) => {
        const { data: da } = await supabase
          .from('division_approvals')
          .select('*, division:divisions(*)')
          .eq('order_id', o.id)
          .eq('division_id', targetDivId || divisionId || '')
          .maybeSingle();
        const { data: items } = await supabase
          .from('order_items')
          .select('*, division:divisions(*)')
          .eq('order_id', o.id)
          .eq('division_id', targetDivId || divisionId || '');
        return { ...o, my_approval: da || undefined, my_items: items || [] };
      })
    );

    setOrders(enriched);
    setLoading(false);
  }

  async function refreshSelected(orderId: string) {
    const targetDivId = currentRole === 'admin' ? null : divisionId;
    const { data: items } = await supabase
      .from('order_items')
      .select('*, division:divisions(*)')
      .eq('order_id', orderId)
      .eq('division_id', targetDivId || divisionId || '');
    setSelected(prev => prev ? { ...prev, my_items: items || [] } : null);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, my_items: items || [] } : o));
  }

  async function handleSaveItem() {
    if (!editingItem || !selected || !currentUser) return;
    setSaving(true);
    try {
      const itemUpdate = await supabase.from('order_items').update({
        final_quantity: editingItem.final_quantity,
        final_price: editingItem.final_price,
        updated_at: new Date().toISOString(),
      }).eq('id', editingItem.id).select('id');
      const itemUpdateError = getMutationError(itemUpdate, 'Order item changes could not be saved.');
      if (itemUpdateError) throw new Error(itemUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: selected.id,
        actor_name: currentUser.name,
        actor_role: 'Division Approver',
        action: `Item updated: qty ${editingItem.final_quantity}, price ${formatINR(editingItem.final_price)}`,
        action_type: 'edited',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated for this item change.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'success', title: 'Item Updated', message: 'Product details saved.' });
      setEditingItem(null);
      await refreshSelected(selected.id);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Order item changes could not be saved.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!selected || !currentUser) return;
    try {
      const itemUpdate = await supabase.from('order_items').update({
        status: 'removed',
        rejection_reason: 'Removed by division approver',
        updated_at: new Date().toISOString(),
      }).eq('id', itemId).select('id');
      const itemUpdateError = getMutationError(itemUpdate, 'The product could not be removed from this order.');
      if (itemUpdateError) throw new Error(itemUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: selected.id,
        actor_name: currentUser.name,
        actor_role: 'Division Approver',
        action: 'Item removed from order',
        action_type: 'edited',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after removing the item.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'info', title: 'Item Removed', message: 'Product removed from this order.' });
      setRemoveConfirm(null);
      await refreshSelected(selected.id);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Remove Failed',
        message: error instanceof Error ? error.message : 'The product could not be removed from this order.',
      });
    }
  }

  async function loadDivisionRCs() {
    const targetDivId = currentRole === 'admin' ? null : divisionId;
    if (!targetDivId && currentRole !== 'admin') return;

    if (currentRole === 'admin') {
      const { data: rcData } = await supabase
        .from('rate_contracts')
        .select('*, hospital:hospitals(*)')
        .in('workflow_stage', ['division_review', 'resubmitted'])
        .order('updated_at', { ascending: false });

      if (!rcData) { setRCs([]); return; }

      const enriched: RCWithMyApproval[] = await Promise.all(
        rcData.map(async (rc) => {
          const round = rc.negotiation_round || 1;
          const { data: divisionApprovals } = await supabase
            .from('rate_contract_approvals')
            .select('*')
            .eq('rc_id', rc.id)
            .eq('approval_stage', 'division')
            .eq('negotiation_round', round)
            .order('sequence_order');
          const approvalToShow = divisionApprovals?.find(a => a.status === 'pending') || divisionApprovals?.[0];
          const { data: allItems } = await supabase
            .from('rate_contract_items')
            .select('*, division:divisions(*)')
            .eq('rc_id', rc.id);
          return {
            ...rc as RateContract,
            myApproval: approvalToShow || undefined,
            myItems: allItems as RateContractItem[] || [],
          };
        })
      );

      setRCs(enriched);
      return;
    }

    const { data: items } = await supabase
      .from('rate_contract_items')
      .select('rc_id')
      .eq('division_id', targetDivId || divisionId || '');

    const rcIds = [...new Set((items || []).map((i: { rc_id: string }) => i.rc_id))];
    if (!rcIds.length) { setRCs([]); return; }

    const { data: rcData } = await supabase
      .from('rate_contracts')
      .select('*, hospital:hospitals(*)')
      .in('id', rcIds)
      .in('workflow_stage', ['division_review', 'resubmitted'])
      .order('updated_at', { ascending: false });

    if (!rcData) { setRCs([]); return; }

    const enriched: RCWithMyApproval[] = await Promise.all(
      rcData.map(async (rc) => {
        const round = rc.negotiation_round || 1;
        const { data: approval } = await supabase
          .from('rate_contract_approvals')
          .select('*')
          .eq('rc_id', rc.id)
          .eq('division_id', targetDivId || divisionId || '')
          .eq('approval_stage', 'division')
          .eq('negotiation_round', round)
          .maybeSingle();
        const { data: myItems } = await supabase
          .from('rate_contract_items')
          .select('*, division:divisions(*)')
          .eq('rc_id', rc.id)
          .eq('division_id', targetDivId || divisionId || '');
        return { ...rc as RateContract, myApproval: approval || undefined, myItems: myItems as RateContractItem[] || [] };
      })
    );
    setRCs(enriched);
  }

  async function checkAndAdvanceRCAfterDivisionDecision(rcId: string, round: number) {
    const { data: allDivApprovals } = await supabase
      .from('rate_contract_approvals')
      .select('status')
      .eq('rc_id', rcId)
      .eq('approval_stage', 'division')
      .eq('negotiation_round', round);

    if (!allDivApprovals || allDivApprovals.length === 0) return;
    if (allDivApprovals.some(a => a.status === 'pending')) return;

    const allApproved = allDivApprovals.every(a => a.status === 'approved');
    const now = new Date().toISOString();

    if (allApproved) {
      await supabase.from('rate_contracts').update({ workflow_stage: 'final_approval_pending', updated_at: now }).eq('id', rcId);
      await supabase.from('rate_contract_timeline').insert({
        rc_id: rcId, actor_name: 'System', actor_role: 'Workflow Engine',
        action: 'All divisions approved. RC advanced to final approval queue.', action_type: 'stage_advanced',
      });
    } else {
      const isLastRound = round >= 2;
      const newStage = isLastRound ? 'final_rejected' : 'sent_back_to_field_rep';
      const updates: Record<string, unknown> = { workflow_stage: newStage, updated_at: now };
      if (isLastRound) updates.status = 'REJECTED';
      await supabase.from('rate_contracts').update(updates).eq('id', rcId);
      await supabase.from('rate_contract_timeline').insert({
        rc_id: rcId, actor_name: 'System', actor_role: 'Workflow Engine',
        action: isLastRound
          ? 'Maximum negotiation rounds exhausted after division feedback. RC final rejected.'
          : 'All divisions responded with suggested changes. RC sent back to field rep for resubmission.',
        action_type: isLastRound ? 'final_rejected' : 'sent_back',
      });
    }
  }

  async function handleRCApprove() {
    if (!selectedRC || !currentUser || !selectedRC.myApproval || currentRole !== 'division_approver') return;
    const round = selectedRC.negotiation_round || 1;
    try {
      const approvalUpdate = await supabase.from('rate_contract_approvals').update({
        status: 'approved', approver_user_id: currentUser.id,
        approver_name: currentUser.name, decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', selectedRC.myApproval.id).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The RC approval could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const timelineInsert = await supabase.from('rate_contract_timeline').insert({
        rc_id: selectedRC.id, actor_name: currentUser.name, actor_role: 'Division Approver',
        action: `${currentUser.division?.name || 'Division'} approved RC items (Round ${round}).`, action_type: 'division_approved',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'RC history could not be updated after approval.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      await checkAndAdvanceRCAfterDivisionDecision(selectedRC.id, round);

      addToast({ type: 'success', title: 'RC Division Approved', message: `Your division approved ${selectedRC.rc_code}.` });
      setSelectedRC(null);
      loadDivisionRCs();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: error instanceof Error ? error.message : 'The RC approval could not be completed.',
      });
    }
  }

  async function handleRCSendBack() {
    if (!selectedRC || !currentUser || !selectedRC.myApproval || !rcRejectReason.trim() || currentRole !== 'division_approver') return;
    const round = selectedRC.negotiation_round || 1;
    try {
      const approvalUpdate = await supabase.from('rate_contract_approvals').update({
        status: 'rejected', rejection_reason: rcRejectReason, approver_user_id: currentUser.id,
        approver_name: currentUser.name, decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', selectedRC.myApproval.id).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The send-back could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const timelineInsert = await supabase.from('rate_contract_timeline').insert({
        rc_id: selectedRC.id, actor_name: currentUser.name, actor_role: 'Division Approver',
        action: `${currentUser.division?.name || 'Division'} requested changes (Round ${round}): ${rcRejectReason}`,
        action_type: 'division_sent_back',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'RC history could not be updated after sending back.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      await checkAndAdvanceRCAfterDivisionDecision(selectedRC.id, round);

      addToast({ type: 'warning', title: 'Changes Requested', message: `${selectedRC.rc_code} sent back for renegotiation.` });
      setRCRejectModal(false); setRCRejectReason(''); setSelectedRC(null);
      loadDivisionRCs();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Send Back Failed',
        message: error instanceof Error ? error.message : 'The send-back could not be completed.',
      });
    }
  }

  async function handleRCItemSave() {
    if (!editingRCItem || !selectedRC || !currentUser || currentRole !== 'division_approver') return;
    try {
      const currentItem = selectedRC.myItems?.find(i => i.id === editingRCItem.id);

      const itemUpdate = await supabase.from('rate_contract_items').update({
        negotiated_price: editingRCItem.negotiated_price,
        expected_qty: editingRCItem.expected_qty,
        updated_at: new Date().toISOString(),
      }).eq('id', editingRCItem.id).select('id');
      const itemUpdateError = getMutationError(itemUpdate, 'RC item changes could not be saved.');
      if (itemUpdateError) throw new Error(itemUpdateError);

      await supabase.from('rate_contract_item_history').insert({
        rc_item_id: editingRCItem.id,
        rc_id: selectedRC.id,
        negotiation_round: selectedRC.negotiation_round || 1,
        actor_name: currentUser.name,
        actor_role: 'Division Approver',
        action_type: 'division_edit',
        price_before: currentItem?.negotiated_price ?? null,
        price_after: editingRCItem.negotiated_price,
        qty_before: currentItem?.expected_qty ?? null,
        qty_after: editingRCItem.expected_qty,
      });

      const timelineInsert = await supabase.from('rate_contract_timeline').insert({
        rc_id: selectedRC.id, actor_name: currentUser.name, actor_role: 'Division Approver',
        action: `Item price/qty updated during division review.`, action_type: 'edited',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'RC history could not be updated for this item change.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'info', title: 'Item Updated', message: 'RC item price saved.' });
      setEditingRCItem(null);
      const rcDivisionId = selectedRC.myApproval?.division_id || divisionId || '';
      const { data: updatedItems } = await supabase
        .from('rate_contract_items')
        .select('*, division:divisions(*)')
        .eq('rc_id', selectedRC.id)
        .eq('division_id', rcDivisionId);
      setSelectedRC(prev => prev ? { ...prev, myItems: updatedItems as RateContractItem[] || [] } : null);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'RC item changes could not be saved.',
      });
    }
  }

  async function handleApprove(order: OrderWithDivision) {
    if (!currentUser || !divisionId) return;
    try {
      const approvalUpdate = await supabase.from('division_approvals').update({
        status: 'approved',
        approver_user_id: currentUser.id,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('order_id', order.id).eq('division_id', divisionId).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The division approval could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const itemsUpdate = await supabase.from('order_items').update({ status: 'approved' })
        .eq('order_id', order.id).eq('division_id', divisionId).eq('status', 'pending').select('id');
      const itemsUpdateError = getMutationError(itemsUpdate, 'The division item approvals could not be saved.');
      if (itemsUpdateError) throw new Error(itemsUpdateError);

      const nextStage = await syncOrderStageAfterDivisionDecision(order.id);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: order.id,
        actor_name: currentUser.name,
        actor_role: 'Division Approver',
        action: `${currentUser.division?.name} division approved ${order.my_items?.length} item(s). Order moved to ${stageLabel(nextStage)}.`,
        action_type: 'division_approved',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after division approval.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'success', title: 'Approved', message: `Items approved for ${order.order_id}` });
      loadOrders();
      setSelected(null);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: error instanceof Error ? error.message : 'The division approval could not be completed.',
      });
    }
  }

  async function handleReject(order: OrderWithDivision) {
    if (!currentUser || !divisionId || !rejectReason.trim()) return;
    try {
      const approvalUpdate = await supabase.from('division_approvals').update({
        status: 'rejected',
        rejection_reason: rejectReason,
        approver_user_id: currentUser.id,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('order_id', order.id).eq('division_id', divisionId).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The division rejection could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const itemsUpdate = await supabase.from('order_items').update({ status: 'rejected', rejection_reason: rejectReason })
        .eq('order_id', order.id).eq('division_id', divisionId).select('id');
      const itemsUpdateError = getMutationError(itemsUpdate, 'The rejected division items could not be saved.');
      if (itemsUpdateError) throw new Error(itemsUpdateError);

      const nextStage = await syncOrderStageAfterDivisionDecision(order.id);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: order.id,
        actor_name: currentUser.name,
        actor_role: 'Division Approver',
        action: `${currentUser.division?.name} division rejected: ${rejectReason}. Order moved to ${stageLabel(nextStage)}.`,
        action_type: 'division_rejected',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after division rejection.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'warning', title: 'Rejected', message: `Items rejected for ${order.order_id}` });
      setRejectModal(false);
      setRejectReason('');
      loadOrders();
      setSelected(null);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Rejection Failed',
        message: error instanceof Error ? error.message : 'The division rejection could not be completed.',
      });
    }
  }

  const pending = orders.filter(o => o.my_approval?.status === 'pending');
  const done    = orders.filter(o => o.my_approval?.status !== 'pending');
  const display = activeTab === 'pending' ? pending : done;
  const visibleRCs = currentRole === 'admin' ? rcs : rcs.filter(rc => rc.myApproval?.status === 'pending');

  if (!divisionId && currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <GitBranch size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500">No division assigned to your account.</p>
        </div>
      </div>
    );
  }

  const activeItems  = (selected?.my_items || []).filter(i => i.status !== 'removed');
  const removedItems = (selected?.my_items || []).filter(i => i.status === 'removed');

  // Height of the two-panel section: viewport minus header (56px) + main padding (48px) + top content (~180px)
  const PANEL_HEIGHT = 'calc(100vh - 284px)';

  return (
    <div className="flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-ink-900 tracking-tight">Division Workspace</h1>
          <p className="text-sm text-ink-400 mt-0.5">
            {currentRole === 'admin'
              ? 'All division approvals'
              : `${currentUser?.division?.name} — review and approve your products`}
          </p>
        </div>
        {/* Module toggle */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => { setActiveModule('orders'); setSelectedRC(null); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeModule === 'orders' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <GitBranch size={13} /> Orders ({pending.length})
          </button>
          <button
            onClick={() => { setActiveModule('rc'); setSelected(null); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeModule === 'rc' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <ScrollText size={13} /> Rate Contracts ({rcs.filter(r => r.myApproval?.status === 'pending').length})
          </button>
        </div>
      </div>

      {activeModule === 'orders' && (<>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Needs Action', value: pending.length, color: pending.length > 0 ? 'text-brand-orange' : 'text-ink-900' },
          { label: 'Approved', value: orders.filter(o => o.my_approval?.status === 'approved').length, color: 'text-emerald-600' },
          { label: 'Rejected', value: orders.filter(o => o.my_approval?.status === 'rejected').length, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-card p-4">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-xs text-ink-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['pending', 'done'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelected(null); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === tab
                ? 'bg-white text-ink-900 shadow-card'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {tab === 'pending' ? `Needs Action (${pending.length})` : `Done (${done.length})`}
          </button>
        ))}
      </div>

      {/* ── Split panel ── */}
      <div className="flex gap-4" style={{ height: PANEL_HEIGHT }}>

        {/* LEFT: order list — independently scrollable */}
        <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pr-0.5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-xs text-ink-300">Loading…</div>
          ) : display.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center bg-white rounded-2xl border border-slate-100 shadow-card p-6">
              <CheckCircle size={28} className="text-slate-200 mb-2" />
              <p className="text-sm text-ink-400">No orders here</p>
            </div>
          ) : display.map(order => {
            const isSelected = selected?.id === order.id;
            const statusColor =
              order.my_approval?.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
              order.my_approval?.status === 'rejected' ? 'bg-red-50 text-red-600' :
              'bg-orange-50 text-orange-600';
            return (
              <button
                key={order.id}
                onClick={() => { setSelected(order); setEditingItem(null); setRemoveConfirm(null); }}
                className={`w-full text-left bg-white rounded-xl border shadow-card p-3.5 transition-all duration-150 group ${
                  isSelected
                    ? 'border-brand-orange ring-1 ring-brand-orange/20 shadow-card-hover'
                    : 'border-slate-100 hover:border-slate-200 hover:shadow-card-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-ink-700">{order.order_id}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusColor}`}>
                    {order.my_approval?.status || 'pending'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-ink-900 leading-tight">{order.hospital?.name}</p>
                <p className="text-[11px] text-ink-400 mt-0.5 truncate">{order.field_rep?.name}</p>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-[11px] text-ink-400">{order.my_items?.length ?? 0} item(s)</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-ink-800 tabular-nums">{formatINR(order.total_value)}</span>
                    <ChevronRight size={12} className={`transition-colors ${isSelected ? 'text-brand-orange' : 'text-slate-300 group-hover:text-slate-400'}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT: detail panel — independently scrollable with sticky footer */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-card text-center px-8">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Package size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-ink-700">Select an order</p>
              <p className="text-xs text-ink-400 mt-1">Pick an order from the left to review its items</p>
            </div>
          ) : (
            <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">

              {/* Detail header — always visible */}
              <div className="shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink-800">{selected.order_id}</span>
                    <Badge className={stageColor(selected.stage)}>{stageLabel(selected.stage)}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-ink-900 mt-0.5">{selected.hospital?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/orders/${selected.id}`)}
                    className="text-xs text-brand-blue hover:text-brand-blue-dark flex items-center gap-1 font-medium"
                  >
                    Full order <ArrowUpRight size={11} />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 hover:bg-slate-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {canEdit && (
                <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                  <Pencil size={11} className="text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">You can edit quantities, prices, or remove items before deciding</p>
                </div>
              )}

              {/* Scrollable content area */}
              <div ref={detailScrollRef} className="flex-1 overflow-y-auto">

                {/* Items table */}
                <table className="w-full text-sm" style={{ minWidth: '520px' }}>
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Product</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Qty</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Unit Price</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Total</th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                      {canEdit && <th className="px-4 py-2.5 w-16" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeItems.map(item => {
                      const isEditing   = editingItem?.id === item.id;
                      const isRemoving  = removeConfirm === item.id;
                      return (
                        <tr key={item.id} className={`group ${isEditing ? 'bg-primary-50/30' : isRemoving ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}`}>
                          <td className="px-5 py-3 font-medium text-ink-900 text-sm">{item.product_name}</td>

                          <td className="px-5 py-3 text-right">
                            {isEditing ? (
                              <input type="number" min={1} value={editingItem.final_quantity}
                                onChange={e => setEditingItem(p => p ? { ...p, final_quantity: parseInt(e.target.value) || 1 } : null)}
                                className="w-16 border border-brand-orange/40 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                              />
                            ) : <span className="text-sm text-ink-700 tabular-nums">{item.final_quantity ?? item.quantity}</span>}
                          </td>

                          <td className="px-5 py-3 text-right">
                            {isEditing ? (
                              <input type="number" min={0} step={0.01} value={editingItem.final_price}
                                onChange={e => setEditingItem(p => p ? { ...p, final_price: parseFloat(e.target.value) || 0 } : null)}
                                className="w-24 border border-brand-orange/40 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                              />
                            ) : <span className="text-sm text-ink-700 tabular-nums">{formatINR(item.final_price ?? item.unit_price)}</span>}
                          </td>

                          <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums text-sm">
                            {formatINR((isEditing ? editingItem.final_quantity * editingItem.final_price : (item.final_quantity ?? item.quantity) * (item.final_price ?? item.unit_price)))}
                          </td>

                          <td className="px-5 py-3">
                            <Badge className={
                              item.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                              item.status === 'rejected' ? 'bg-red-50 text-red-600' :
                              'bg-orange-50 text-orange-600'
                            }>{item.status}</Badge>
                          </td>

                          {canEdit && (
                            <td className="px-4 py-3">
                              {isRemoving ? (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => handleRemoveItem(item.id)} className="text-[11px] text-red-600 hover:text-red-800 font-semibold">Remove?</button>
                                  <button onClick={() => setRemoveConfirm(null)}><X size={11} className="text-ink-300 hover:text-ink-500" /></button>
                                </div>
                              ) : isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={handleSaveItem} disabled={saving} title="Save" className="text-brand-blue hover:text-brand-blue-dark disabled:opacity-40"><Save size={14} /></button>
                                  <button onClick={() => setEditingItem(null)} title="Cancel"><X size={14} className="text-ink-300 hover:text-ink-600" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingItem({ id: item.id, final_quantity: item.final_quantity ?? item.quantity, final_price: item.final_price ?? item.unit_price }); setRemoveConfirm(null); }} title="Edit" className="text-ink-300 hover:text-brand-orange transition-colors"><Pencil size={13} /></button>
                                  <button onClick={() => { setRemoveConfirm(item.id); setEditingItem(null); }} title="Remove" className="text-ink-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Removed items */}
                {removedItems.length > 0 && (
                  <div className="mx-5 my-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-2">Removed</p>
                    {removedItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-1">
                        <span className="text-xs text-ink-300 line-through">{item.product_name}</span>
                        <span className="text-xs text-ink-300">{item.quantity} × {formatINR(item.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Decision result for already-decided orders */}
                {selected.my_approval?.status !== 'pending' && (
                  <div className={`mx-5 my-3 rounded-xl border p-4 flex items-start gap-3 ${
                    selected.my_approval?.status === 'approved'
                      ? 'bg-emerald-50 border-emerald-100'
                      : 'bg-red-50 border-red-100'
                  }`}>
                    {selected.my_approval?.status === 'approved'
                      ? <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                      : <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className={`text-sm font-semibold ${selected.my_approval?.status === 'approved' ? 'text-emerald-800' : 'text-red-700'}`}>
                        Division {selected.my_approval?.status}
                      </p>
                      {selected.my_approval?.rejection_reason && (
                        <p className="text-xs text-ink-500 mt-0.5">{selected.my_approval.rejection_reason}</p>
                      )}
                      {selected.my_approval?.decided_at && (
                        <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(selected.my_approval.decided_at)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Spacer so content isn't hidden behind sticky footer */}
                {canEdit && <div className="h-20" />}
              </div>

              {/* ── Sticky footer: totals + action buttons ── */}
              <div className="shrink-0 border-t border-slate-100 bg-white">
                <div className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-ink-400">Active items total</p>
                    <p className="text-base font-bold text-ink-900 tabular-nums">
                      {formatINR(activeItems.reduce((s, i) => s + i.quantity * i.unit_price, 0))}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRejectModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(selected)}
                        disabled={activeItems.length === 0}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <CheckCircle size={14} /> Approve All
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      </>)}

      {/* ── RC Tab ── */}
      {activeModule === 'rc' && (
        <div className="flex gap-4" style={{ height: PANEL_HEIGHT }}>
          {/* LEFT: RC list */}
          <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pr-0.5">
            {visibleRCs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 bg-white rounded-2xl border border-slate-100 shadow-card p-6 text-center">
                <ScrollText size={28} className="text-slate-200 mb-2" />
                <p className="text-sm text-ink-400">No RCs pending your division</p>
              </div>
            ) : visibleRCs.map(rc => {
              const isSel = selectedRC?.id === rc.id;
              const isRound2 = (rc.negotiation_round || 1) >= 2;
              return (
                <button key={rc.id} onClick={() => setSelectedRC(rc)}
                  className={`w-full text-left bg-white rounded-xl border shadow-card p-3.5 transition-all group ${
                    isSel ? 'border-brand-orange ring-1 ring-brand-orange/20' : 'border-slate-100 hover:border-slate-200'
                  }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-ink-700">{rc.rc_code}</span>
                    <Badge className={rc.myApproval?.status === 'pending' ? 'bg-orange-50 text-orange-600' : rc.myApproval?.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                      {rc.myApproval?.status || 'pending'}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-ink-900">{rc.hospital?.name}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">{rc.myItems?.length ?? 0} item(s) for your division</p>
                  {isRound2 && (
                    <p className="text-[10px] font-semibold text-red-500 mt-1.5">⚠ Round 2 — Final negotiation</p>
                  )}
                  <ChevronRight size={12} className={`ml-auto mt-1 transition-colors ${isSel ? 'text-brand-orange' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>

          {/* RIGHT: RC detail */}
          <div className="flex-1 min-w-0">
            {!selectedRC ? (
              <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-card text-center px-8">
                <ScrollText size={22} className="text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-ink-700">Select a rate contract</p>
              </div>
            ) : (
              <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
                <div className="shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-800">{selectedRC.rc_code}</span>
                      <Badge className={rcWorkflowStageColor(selectedRC.workflow_stage)}>{rcWorkflowStageLabel(selectedRC.workflow_stage)}</Badge>
                      {(selectedRC.negotiation_round || 1) >= 2 && (
                        <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Round 2 · Final</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-ink-900 mt-0.5">{selectedRC.hospital?.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/rate-contracts/${selectedRC.id}`)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-brand-blue hover:text-brand-blue-dark hover:bg-blue-50 rounded-lg transition-colors"
                      title="Open full RC detail page"
                    >
                      <ArrowUpRight size={12} /> Full RC
                    </button>
                    <button onClick={() => setSelectedRC(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 hover:bg-slate-100 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {canEditRC && selectedRC.myApproval?.status === 'pending' && (
                  <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <Pencil size={11} className="text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">You can edit negotiated prices and quantities for your division's items before deciding</p>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Product</th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Negotiated Price</th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Expected Qty</th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Cap Qty</th>
                        {canEditRC && selectedRC.myApproval?.status === 'pending' && <th className="px-4 py-2.5 w-16" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedRC.myItems || []).map(item => {
                        const isEdit = editingRCItem?.id === item.id;
                        return (
                          <tr key={item.id} className={`group ${isEdit ? 'bg-primary-50/30' : 'hover:bg-slate-50/60'}`}>
                            <td className="px-5 py-3 font-medium text-ink-900 text-sm flex items-center gap-1.5">
                              <Lock size={11} className="text-indigo-400 shrink-0" /> {item.product_name}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {isEdit ? (
                                <input type="number" min={0} step={0.01} value={editingRCItem.negotiated_price}
                                  onChange={e => setEditingRCItem(p => p ? { ...p, negotiated_price: parseFloat(e.target.value) || 0 } : null)}
                                  className="w-24 border border-brand-orange/40 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                                />
                              ) : <span className="text-sm tabular-nums text-ink-700">{formatINR(item.negotiated_price)}</span>}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {isEdit ? (
                                <input type="number" min={1} value={editingRCItem.expected_qty}
                                  onChange={e => setEditingRCItem(p => p ? { ...p, expected_qty: parseInt(e.target.value) || 1 } : null)}
                                  className="w-16 border border-brand-orange/40 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                                />
                              ) : <span className="text-sm tabular-nums text-ink-700">{item.expected_qty}</span>}
                            </td>
                            <td className="px-5 py-3 text-right text-sm tabular-nums text-ink-700">{item.cap_qty ?? '—'}</td>
                            {canEditRC && selectedRC.myApproval?.status === 'pending' && (
                              <td className="px-4 py-3">
                                {isEdit ? (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={handleRCItemSave} title="Save" className="text-brand-blue hover:text-brand-blue-dark"><Save size={14} /></button>
                                    <button onClick={() => setEditingRCItem(null)}><X size={14} className="text-ink-300 hover:text-ink-600" /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingRCItem({ id: item.id, negotiated_price: item.negotiated_price, expected_qty: item.expected_qty })}
                                      className="text-ink-300 hover:text-brand-orange transition-colors"><Pencil size={13} /></button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {canEditRC && <div className="h-20" />}
                </div>

                {canEditRC && selectedRC.myApproval?.status === 'pending' && (
                  <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3 flex items-center justify-between">
                    <p className="text-xs text-ink-400">
                      {selectedRC.myItems?.length ?? 0} item(s) for your division
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRCRejectModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl transition-colors">
                        <XCircle size={14} /> Send Back to Field Rep
                      </button>
                      <button onClick={handleRCApprove}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm">
                        <CheckCircle size={14} /> Approve Division Items
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reject modal (Orders) ── */}
      {rejectModal && selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-sm border border-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink-900">Rejection Reason</h3>
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 hover:bg-slate-100 transition-colors">
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-ink-500 mb-3">Provide a reason for rejecting items in <span className="font-semibold text-ink-800">{selected.order_id}</span></p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g., Division cannot supply, incorrect pricing…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-300 resize-none text-ink-900 placeholder:text-ink-400"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-ink-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleReject(selected)}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold disabled:opacity-50 transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RC Send Back modal ── */}
      {rcRejectModal && selectedRC && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-sm border border-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink-900">Request Changes</h3>
              <button onClick={() => { setRCRejectModal(false); setRCRejectReason(''); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 hover:bg-slate-100 transition-colors">
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-ink-500 mb-1">
              Sending <span className="font-semibold text-ink-800">{selectedRC.rc_code}</span> back to the field rep for renegotiation.
            </p>
            {(selectedRC.negotiation_round || 1) >= 2 && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
                ⚠ This is Round 2. Sending back again will final-reject this RC — no further rounds are allowed.
              </p>
            )}
            <textarea
              value={rcRejectReason}
              onChange={e => setRCRejectReason(e.target.value)}
              placeholder="e.g., Pricing too high, product SKU mismatch, quantities unrealistic…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-300 resize-none text-ink-900 placeholder:text-ink-400 mt-3"
              rows={3} autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRCRejectModal(false); setRCRejectReason(''); }} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-ink-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleRCSendBack} disabled={!rcRejectReason.trim()}
                className="flex-1 py-2 text-sm bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold disabled:opacity-50 transition-colors">
                Send Back to Field Rep
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
