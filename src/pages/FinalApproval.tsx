import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, Save, X, ArrowUpRight,
  Package, Database, ChevronRight, Pencil, ScrollText, Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, OrderItem, FinalApproval as FinalApprovalType, RateContract, RateContractItem, RateContractApproval } from '../types';
import { formatINR, formatDate, formatDateTime, timeAgo, stageColor, stageLabel, rcStatusLabel, rcStatusColor, rcWorkflowStageLabel, rcWorkflowStageColor } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import Badge from '../components/ui/Badge';
import { getMutationError } from '../utils/supabaseWrites';

interface OrderWithMyFinalApproval extends Order {
  my_final_approval?: FinalApprovalType;
}

export default function FinalApproval() {
  const navigate = useNavigate();
  const { currentRole, currentUser, addToast } = useApp();
  const [orders, setOrders]           = useState<OrderWithMyFinalApproval[]>([]);
  const [selected, setSelected]       = useState<Order | null>(null);
  const [items, setItems]             = useState<OrderItem[]>([]);
  const [myApproval, setMyApproval]   = useState<FinalApprovalType | null>(null);
  const [allApprovals, setAllApprovals] = useState<FinalApprovalType[]>([]);
  const [loading, setLoading]         = useState(true);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues]   = useState<{ qty: number; price: number }>({ qty: 0, price: 0 });
  const [activeTab, setActiveTab]     = useState<'pending' | 'done'>('pending');
  const detailScrollRef               = useRef<HTMLDivElement>(null);

  // RC tab state
  const [activeModule, setActiveModule] = useState<'orders' | 'rc'>('orders');
  const [rcs, setRCs]               = useState<(RateContract & { myApproval?: RateContractApproval; allItems?: RateContractItem[] })[]>([]);
  const [selectedRC, setSelectedRC] = useState<(RateContract & { myApproval?: RateContractApproval; allItems?: RateContractItem[] }) | null>(null);
  const [rcAllApprovals, setRCAllApprovals] = useState<RateContractApproval[]>([]);
  const [rcRejectModal, setRCRejectModal] = useState(false);
  const [rcRejectReason, setRCRejectReason] = useState('');
  const [editingRCItem, setEditingRCItem] = useState<{ id: string; negotiated_price: number; expected_qty: number } | null>(null);

  useEffect(() => { loadOrders(); loadRCsForFinalApproval(); }, [currentUser]);

  // Reset right-panel scroll when a new order is selected
  useEffect(() => {
    if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
  }, [selected?.id]);

  async function loadRCsForFinalApproval() {
    const { data: rcData } = await supabase
      .from('rate_contracts')
      .select('*, hospital:hospitals(*)')
      .eq('workflow_stage', 'final_approval_pending')
      .order('updated_at', { ascending: false });
    if (!rcData) return;

    const enriched = await Promise.all(rcData.map(async (rc) => {
      const { data: allItems } = await supabase
        .from('rate_contract_items')
        .select('*, division:divisions(*)')
        .eq('rc_id', rc.id);

      const { data: myApproval } = currentUser
        ? await supabase.from('rate_contract_approvals').select('*')
            .eq('rc_id', rc.id).eq('approval_stage', 'final')
            .eq('approver_user_id', currentUser.id).maybeSingle()
        : { data: null };

      if (currentRole === 'final_approver' && !myApproval) return null;

      return { ...rc as RateContract, myApproval: myApproval || undefined, allItems: allItems as RateContractItem[] || [] };
    }));

    setRCs(enriched.filter(Boolean) as any[]);
  }

  async function handleRCFinalApprove() {
    if (!selectedRC || !currentUser || !selectedRC.myApproval || currentRole !== 'final_approver') return;
    try {
      const approvalUpdate = await supabase.from('rate_contract_approvals').update({
        status: 'approved', decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', selectedRC.myApproval.id).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The RC final approval could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const { data: allFinal } = await supabase
        .from('rate_contract_approvals')
        .select('*').eq('rc_id', selectedRC.id).eq('approval_stage', 'final');
      const allApproved = allFinal?.every(a => a.status === 'approved');

      if (allApproved) {
        const contractUpdate = await supabase.from('rate_contracts').update({
          status: 'APPROVED',
          workflow_stage: 'approved',
          updated_at: new Date().toISOString(),
        }).eq('id', selectedRC.id).select('id');
        const contractUpdateError = getMutationError(contractUpdate, 'The RC could not be marked as approved.');
        if (contractUpdateError) throw new Error(contractUpdateError);

        const timelineInsert = await supabase.from('rate_contract_timeline').insert({
          rc_id: selectedRC.id, actor_name: currentUser.name, actor_role: 'Final Approver',
          action: 'All final approvers cleared. RC is now APPROVED and active.', action_type: 'final_approved',
        }).select('id');
        const timelineInsertError = getMutationError(timelineInsert, 'RC history could not be updated after approval.');
        if (timelineInsertError) throw new Error(timelineInsertError);

        addToast({ type: 'success', title: 'RC Approved!', message: `${selectedRC.rc_code} is now active.` });
      } else {
        const timelineInsert = await supabase.from('rate_contract_timeline').insert({
          rc_id: selectedRC.id, actor_name: currentUser.name, actor_role: 'Final Approver',
          action: `${currentUser.name} approved. Awaiting other final approvers.`, action_type: 'final_approved',
        }).select('id');
        const timelineInsertError = getMutationError(timelineInsert, 'RC history could not be updated after approval.');
        if (timelineInsertError) throw new Error(timelineInsertError);

        addToast({ type: 'info', title: 'Approval Recorded', message: 'Awaiting other final approvers.' });
      }

      setSelectedRC(null); setRCAllApprovals([]);
      loadRCsForFinalApproval();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: error instanceof Error ? error.message : 'The RC final approval could not be completed.',
      });
    }
  }

  async function handleRCFinalReject() {
    if (!selectedRC || !currentUser || !selectedRC.myApproval || !rcRejectReason.trim() || currentRole !== 'final_approver') return;
    try {
      const approvalUpdate = await supabase.from('rate_contract_approvals').update({
        status: 'rejected', rejection_reason: rcRejectReason, decided_at: new Date().toISOString(),
      }).eq('id', selectedRC.myApproval.id).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The RC rejection could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const contractUpdate = await supabase.from('rate_contracts').update({
        status: 'REJECTED',
        workflow_stage: 'final_rejected',
        updated_at: new Date().toISOString(),
      }).eq('id', selectedRC.id).select('id');
      const contractUpdateError = getMutationError(contractUpdate, 'The RC status could not be updated.');
      if (contractUpdateError) throw new Error(contractUpdateError);

      const timelineInsert = await supabase.from('rate_contract_timeline').insert({
        rc_id: selectedRC.id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: `Final rejected: ${rcRejectReason}`, action_type: 'final_rejected',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'RC history could not be updated after rejection.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'error', title: 'RC Rejected', message: `${selectedRC.rc_code} has been rejected.` });
      setRCRejectModal(false); setRCRejectReason(''); setSelectedRC(null);
      loadRCsForFinalApproval();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Rejection Failed',
        message: error instanceof Error ? error.message : 'The RC rejection could not be completed.',
      });
    }
  }

  async function selectRCForDetail(rc: typeof rcs[0]) {
    setSelectedRC(rc);
    const { data } = await supabase
      .from('rate_contract_approvals')
      .select('*, division:divisions(*), approver_user:app_users(*)')
      .eq('rc_id', rc.id)
      .order('sequence_order');
    if (data) setRCAllApprovals(data as RateContractApproval[]);
  }

  async function handleRCItemSave() {
    if (!editingRCItem || !selectedRC || !currentUser || currentRole !== 'final_approver') return;
    try {
      const currentItem = selectedRC.allItems?.find(i => i.id === editingRCItem.id);

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
        actor_role: 'Final Approver',
        action_type: 'final_edit',
        price_before: currentItem?.negotiated_price ?? null,
        price_after: editingRCItem.negotiated_price,
        qty_before: currentItem?.expected_qty ?? null,
        qty_after: editingRCItem.expected_qty,
      });

      const timelineInsert = await supabase.from('rate_contract_timeline').insert({
        rc_id: selectedRC.id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: 'RC item price/qty adjusted during final review.', action_type: 'edited',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'RC history could not be updated after editing.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'info', title: 'Item Updated', message: 'RC item saved.' });
      setEditingRCItem(null);
      const { data: updatedItems } = await supabase
        .from('rate_contract_items').select('*, division:divisions(*)').eq('rc_id', selectedRC.id);
      setSelectedRC(prev => prev ? { ...prev, allItems: updatedItems as RateContractItem[] || [] } : null);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'RC item changes could not be saved.',
      });
    }
  }

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*)')
      .in('stage', ['final_approval_pending', 'final_approved', 'erp_sync_done', 'final_rejected', 'sent_to_supply_chain', 'sent_to_stockist', 'completed'])
      .order('updated_at', { ascending: false });

    if (!data?.length) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (currentRole === 'final_approver' && currentUser) {
      const orderIds = data.map(order => order.id);
      const { data: myApprovals } = await supabase
        .from('final_approvals')
        .select('*')
        .eq('approver_user_id', currentUser.id)
        .in('order_id', orderIds);

      const myApprovalsByOrderId = new Map((myApprovals || []).map(approval => [approval.order_id, approval as FinalApprovalType]));
      const myOrders = data
        .filter(order => myApprovalsByOrderId.has(order.id))
        .map(order => ({ ...order, my_final_approval: myApprovalsByOrderId.get(order.id) }));

      setOrders(myOrders as OrderWithMyFinalApproval[]);
    } else {
      setOrders(data as OrderWithMyFinalApproval[]);
    }

    setLoading(false);
  }

  async function selectOrder(order: Order) {
    setSelected(order);
    setEditingItem(null);
    const [{ data: oi }, { data: fa }, { data: my }] = await Promise.all([
      supabase.from('order_items').select('*, division:divisions(*)').eq('order_id', order.id).neq('status', 'rejected'),
      supabase.from('final_approvals').select('*, approver_user:app_users(*)').eq('order_id', order.id).order('sequence_order'),
      currentUser
        ? supabase.from('final_approvals').select('*').eq('order_id', order.id).eq('approver_user_id', currentUser.id).maybeSingle()
        : { data: null },
    ]);
    if (oi) setItems(oi as OrderItem[]);
    if (fa) setAllApprovals(fa as FinalApprovalType[]);
    if (my) setMyApproval(my as FinalApprovalType);
  }

  async function handleApprove() {
    if (!selected || !currentUser || !myApproval) return;
    try {
      const approvalUpdate = await supabase.from('final_approvals').update({
        status: 'approved', decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', myApproval.id).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The final approval could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const { data: allFinal } = await supabase.from('final_approvals').select('*').eq('order_id', selected.id);
      const allApproved = allFinal?.every(fa => fa.status === 'approved');

      if (allApproved) {
        const orderUpdate = await supabase.from('orders').update({
          stage: 'final_approved',
          updated_at: new Date().toISOString(),
        }).eq('id', selected.id).select('id');
        const orderUpdateError = getMutationError(orderUpdate, 'The order could not be marked as final approved.');
        if (orderUpdateError) throw new Error(orderUpdateError);

        const timelineInsert = await supabase.from('order_timeline').insert({
          order_id: selected.id, actor_name: currentUser.name, actor_role: 'Final Approver',
          action: 'All final approvers cleared. Order is final approved.', action_type: 'final_approved',
        }).select('id');
        const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after final approval.');
        if (timelineInsertError) throw new Error(timelineInsertError);

        const notificationsInsert = await supabase.from('notifications_log').insert([
          { order_id: selected.id, notification_type: 'supply_chain_email', recipient_email: 'supplychain@swishx.com', recipient_name: 'Supply Chain Team', subject: `Order ${selected.order_id} Final Approved`, status: 'sent' },
          { order_id: selected.id, notification_type: 'supply_chain_email', recipient_email: 'warehouse@swishx.com', recipient_name: 'Warehouse Team', subject: `Order ${selected.order_id} Final Approved`, status: 'sent' },
        ]).select('id');
        const notificationsInsertError = getMutationError(notificationsInsert, 'Notification history could not be recorded.');
        if (notificationsInsertError) throw new Error(notificationsInsertError);

        addToast({ type: 'success', title: 'Order Final Approved!', message: 'Supply chain notified.' });
      } else {
        const timelineInsert = await supabase.from('order_timeline').insert({
          order_id: selected.id, actor_name: currentUser.name, actor_role: 'Final Approver',
          action: `${currentUser.name} approved. Awaiting other approvers.`, action_type: 'final_approved',
        }).select('id');
        const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after approval.');
        if (timelineInsertError) throw new Error(timelineInsertError);

        addToast({ type: 'info', title: 'Approval Recorded', message: 'Awaiting other final approvers.' });
      }

      loadOrders();
      selectOrder({ ...selected, stage: allApproved ? 'final_approved' : selected.stage });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: error instanceof Error ? error.message : 'The final approval could not be completed.',
      });
    }
  }

  async function handleReject() {
    if (!selected || !currentUser || !myApproval || !rejectReason.trim()) return;
    try {
      const approvalUpdate = await supabase.from('final_approvals').update({
        status: 'rejected', rejection_reason: rejectReason, decided_at: new Date().toISOString(),
      }).eq('id', myApproval.id).select('id');
      const approvalUpdateError = getMutationError(approvalUpdate, 'The final rejection could not be saved.');
      if (approvalUpdateError) throw new Error(approvalUpdateError);

      const orderUpdate = await supabase.from('orders').update({
        stage: 'final_rejected',
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id).select('id');
      const orderUpdateError = getMutationError(orderUpdate, 'The order could not be marked as rejected.');
      if (orderUpdateError) throw new Error(orderUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: selected.id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: `Order rejected: ${rejectReason}`, action_type: 'final_rejected',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after rejection.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'error', title: 'Order Rejected', message: 'Final rejection recorded.' });
      setRejectModal(false); setRejectReason('');
      loadOrders();
      selectOrder({ ...selected, stage: 'final_rejected' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Rejection Failed',
        message: error instanceof Error ? error.message : 'The final rejection could not be completed.',
      });
    }
  }

  async function handleERPFinalSync() {
    if (!selected || !currentUser) return;
    try {
      const orderUpdate = await supabase.from('orders').update({
        stage: 'erp_sync_done', erp_status: 'synced',
        erp_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', selected.id).select('id');
      const orderUpdateError = getMutationError(orderUpdate, 'The ERP sync confirmation could not be saved.');
      if (orderUpdateError) throw new Error(orderUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: selected.id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: 'Final ERP sync confirmed.', action_type: 'erp_sync_done',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after ERP sync.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'success', title: 'ERP Sync Done', message: `Order ${selected.order_id} synced.` });
      loadOrders();
      selectOrder({ ...selected, stage: 'erp_sync_done' });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'ERP Sync Failed',
        message: error instanceof Error ? error.message : 'Final ERP sync could not be completed.',
      });
    }
  }

  async function handleSaveEdit(item: OrderItem) {
    if (!currentUser) return;
    try {
      const itemUpdate = await supabase.from('order_items').update({
        final_quantity: editValues.qty, final_price: editValues.price, updated_at: new Date().toISOString(),
      }).eq('id', item.id).select('id');
      const itemUpdateError = getMutationError(itemUpdate, 'Order item changes could not be saved.');
      if (itemUpdateError) throw new Error(itemUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: item.order_id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: `Edited ${item.product_name}: Qty→${editValues.qty}, Price→${formatINR(editValues.price)}`,
        action_type: 'edited',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after editing.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'info', title: 'Item Updated', message: `${item.product_name} updated.` });
      setEditingItem(null);
      if (selected) selectOrder(selected);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Order item changes could not be saved.',
      });
    }
  }

  async function handleRemoveItem(item: OrderItem) {
    if (!currentUser) return;
    try {
      const itemUpdate = await supabase.from('order_items').update({ status: 'removed' }).eq('id', item.id).select('id');
      const itemUpdateError = getMutationError(itemUpdate, 'The product could not be removed from this order.');
      if (itemUpdateError) throw new Error(itemUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: item.order_id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: `Removed: ${item.product_name}`, action_type: 'edited',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after removing the product.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'warning', title: 'Product Removed', message: `${item.product_name} removed.` });
      if (selected) selectOrder(selected);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Remove Failed',
        message: error instanceof Error ? error.message : 'The product could not be removed from this order.',
      });
    }
  }

  const pending = orders.filter(order => {
    if (order.stage === 'final_approved') return true;
    if (order.stage !== 'final_approval_pending') return false;
    return currentRole === 'admin' ? true : order.my_final_approval?.status === 'pending';
  });
  const done = orders.filter(order => !pending.some(pendingOrder => pendingOrder.id === order.id));
  const display = activeTab === 'pending' ? pending : done;
  const visibleRCs = currentRole === 'admin' ? rcs : rcs.filter(rc => rc.myApproval?.status === 'pending');

  const canAct    = currentRole === 'final_approver' && selected?.stage === 'final_approval_pending' && myApproval?.status === 'pending';
  const canEdit   = (currentRole === 'final_approver' || currentRole === 'admin') && selected?.stage === 'final_approval_pending';
  const canERPSync = currentRole === 'final_approver' && selected?.stage === 'final_approved';
  const canActRC  = currentRole === 'final_approver' && selectedRC?.myApproval?.status === 'pending';
  const totalValue = items.reduce((s, i) => s + ((i.final_quantity ?? i.quantity) * (i.final_price ?? i.unit_price)), 0);

  const PANEL_HEIGHT = 'calc(100vh - 296px)';

  return (
    <div className="flex flex-col gap-4">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-ink-900 tracking-tight">Final Approval</h1>
          <p className="text-sm text-ink-400 mt-0.5">Last correction point before orders become executable</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => { setActiveModule('orders'); setSelectedRC(null); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeModule === 'orders' ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            Orders ({pending.length})
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
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Awaiting Approval', value: orders.filter(o => o.stage === 'final_approval_pending').length, color: 'text-brand-orange' },
          { label: 'Final Approved',    value: orders.filter(o => o.stage === 'final_approved').length,         color: 'text-emerald-600' },
          { label: 'ERP Sync Done',     value: orders.filter(o => o.stage === 'erp_sync_done').length,          color: 'text-brand-blue' },
          { label: 'Rejected',          value: orders.filter(o => o.stage === 'final_rejected').length,         color: 'text-red-500' },
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
              activeTab === tab ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {tab === 'pending' ? `Needs Action (${pending.length})` : `Processed (${done.length})`}
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
            <div className="flex flex-col items-center justify-center h-40 bg-white rounded-2xl border border-slate-100 shadow-card p-6 text-center">
              <CheckCircle size={28} className="text-slate-200 mb-2" />
              <p className="text-sm text-ink-400">No orders here</p>
            </div>
          ) : display.map(order => {
            const isSelected = selected?.id === order.id;
            return (
              <button
                key={order.id}
                onClick={() => selectOrder(order)}
                className={`w-full text-left bg-white rounded-xl border shadow-card p-3.5 transition-all duration-150 group ${
                  isSelected
                    ? 'border-brand-orange ring-1 ring-brand-orange/20 shadow-card-hover'
                    : 'border-slate-100 hover:border-slate-200 hover:shadow-card-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-ink-700">{order.order_id}</span>
                  <Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge>
                </div>
                <p className="text-sm font-semibold text-ink-900 leading-tight">{order.hospital?.name}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{order.field_rep?.name}</p>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-[11px] text-ink-400">{timeAgo(order.updated_at)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-ink-800 tabular-nums">{formatINR(order.total_value)}</span>
                    <ChevronRight size={12} className={`transition-colors ${isSelected ? 'text-brand-orange' : 'text-slate-300 group-hover:text-slate-400'}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT: detail panel */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-card text-center px-8">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Package size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-ink-700">Select an order</p>
              <p className="text-xs text-ink-400 mt-1">Pick an order from the left to review it</p>
            </div>
          ) : (
            <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">

              {/* Sticky header */}
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
                    Full detail <ArrowUpRight size={11} />
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
                  <p className="text-xs text-amber-700">You can adjust quantities, prices, or remove items before approving</p>
                </div>
              )}

              {/* Scrollable content */}
              <div ref={detailScrollRef} className="flex-1 overflow-y-auto">

                {/* Items table */}
                <table className="w-full text-sm" style={{ minWidth: '560px' }}>
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Product</th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Division</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Qty</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Price</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Total</th>
                      {canEdit && <th className="px-4 py-2.5 w-16" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => {
                      const isEditing = editingItem === item.id;
                      const qty   = isEditing ? editValues.qty   : (item.final_quantity ?? item.quantity);
                      const price = isEditing ? editValues.price : (item.final_price   ?? item.unit_price);
                      return (
                        <tr key={item.id} className={isEditing ? 'bg-primary-50/30' : 'hover:bg-slate-50/60'}>
                          <td className="px-5 py-3 font-medium text-ink-900 text-sm">{item.product_name}</td>
                          <td className="px-5 py-3 text-xs text-ink-400">{item.division?.name}</td>
                          <td className="px-5 py-3 text-right">
                            {isEditing ? (
                              <input type="number" value={editValues.qty} min={1}
                                onChange={e => setEditValues(p => ({ ...p, qty: parseInt(e.target.value) || 1 }))}
                                className="w-16 text-right border border-brand-orange/40 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                              />
                            ) : <span className="text-sm text-ink-700 tabular-nums">{qty}</span>}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {isEditing ? (
                              <input type="number" value={editValues.price} min={0}
                                onChange={e => setEditValues(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                                className="w-24 text-right border border-brand-orange/40 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                              />
                            ) : <span className="text-sm text-ink-700 tabular-nums">{formatINR(price)}</span>}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-ink-900 tabular-nums text-sm">
                            {formatINR(qty * price)}
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => handleSaveEdit(item)} title="Save" className="text-emerald-600 hover:text-emerald-700"><Save size={14} /></button>
                                  <button onClick={() => setEditingItem(null)} title="Cancel"><X size={14} className="text-ink-300 hover:text-ink-600" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => { setEditingItem(item.id); setEditValues({ qty: item.final_quantity ?? item.quantity, price: item.final_price ?? item.unit_price }); }}
                                    className="text-ink-300 hover:text-brand-orange transition-colors" title="Edit"><Pencil size={13} /></button>
                                  <button onClick={() => handleRemoveItem(item)}
                                    className="text-ink-300 hover:text-red-500 transition-colors" title="Remove"><X size={13} /></button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Approver status */}
                {allApprovals.length > 0 && (
                  <div className="mx-5 my-4">
                    <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-2">Approver Status</p>
                    <div className="space-y-2">
                      {allApprovals.map((fa, i) => (
                        <div key={fa.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-[10px] font-bold text-ink-500 flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-ink-900">{fa.approver_name}</p>
                              {fa.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{fa.rejection_reason}</p>}
                              {fa.decided_at && <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(fa.decided_at)}</p>}
                            </div>
                          </div>
                          <Badge className={
                            fa.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                            fa.status === 'rejected' ? 'bg-red-50 text-red-600' :
                            'bg-orange-50 text-orange-600'
                          }>{fa.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ERP sync done confirmation */}
                {selected.stage === 'erp_sync_done' && (
                  <div className="mx-5 mb-4 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <Database size={16} className="text-brand-blue shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Final ERP Sync Done</p>
                      <p className="text-xs text-blue-600 mt-0.5">This order has been confirmed as synced to ERP.</p>
                    </div>
                  </div>
                )}

                {/* Spacer so content isn't hidden behind sticky footer */}
                {(canAct || canERPSync) && <div className="h-20" />}
              </div>

              {/* ── Sticky footer ── */}
              <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-ink-400">Order total</p>
                  <p className="text-base font-bold text-ink-900 tabular-nums">{formatINR(totalValue)}</p>
                </div>

                <div className="flex items-center gap-2">
                  {canERPSync && (
                    <button
                      onClick={handleERPFinalSync}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl transition-colors shadow-sm"
                    >
                      <Database size={14} /> Mark ERP Sync Done
                    </button>
                  )}
                  {canAct && (
                    <>
                      <button
                        onClick={() => setRejectModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={handleApprove}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
                      >
                        <CheckCircle size={14} /> Give Approval
                      </button>
                    </>
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
          <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pr-0.5">
            {visibleRCs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 bg-white rounded-2xl border border-slate-100 shadow-card p-6 text-center">
                <ScrollText size={28} className="text-slate-200 mb-2" />
                <p className="text-sm text-ink-400">No RCs ready for final approval</p>
              </div>
            ) : visibleRCs.map(rc => {
              const isSel = selectedRC?.id === rc.id;
              return (
                <button key={rc.id} onClick={() => selectRCForDetail(rc)}
                  className={`w-full text-left bg-white rounded-xl border shadow-card p-3.5 transition-all group ${
                    isSel ? 'border-brand-orange ring-1 ring-brand-orange/20' : 'border-slate-100 hover:border-slate-200'
                  }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-ink-700">{rc.rc_code}</span>
                    <Badge className={rc.myApproval?.status === 'pending' ? 'bg-orange-50 text-orange-600' : rc.myApproval?.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}>
                      {rc.myApproval?.status || 'pending'}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-ink-900">{rc.hospital?.name}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5">{rc.allItems?.length ?? 0} product(s)</p>
                  {(rc.negotiation_round || 1) >= 2 && (
                    <p className="text-[10px] font-semibold text-indigo-600 mt-1">Round 2 · After renegotiation</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-ink-400">{formatDate(rc.valid_from)} – {formatDate(rc.valid_to)}</span>
                    <ChevronRight size={12} className={`transition-colors ${isSel ? 'text-brand-orange' : 'text-slate-300'}`} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-0">
            {!selectedRC ? (
              <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-card text-center px-8">
                <ScrollText size={22} className="text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-ink-700">Select a rate contract to review</p>
              </div>
            ) : (
              <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
                <div className="shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-800">{selectedRC.rc_code}</span>
                      <Badge className={rcWorkflowStageColor(selectedRC.workflow_stage)}>{rcWorkflowStageLabel(selectedRC.workflow_stage)}</Badge>
                      {(selectedRC.negotiation_round || 1) >= 2 && (
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">Round 2</span>
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
                    <button onClick={() => { setSelectedRC(null); setRCAllApprovals([]); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 hover:bg-slate-100 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {canActRC && (
                  <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <Pencil size={11} className="text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">You can adjust negotiated prices and quantities before approving</p>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Product</th>
                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Division</th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Negotiated Price</th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Expected Qty</th>
                        {canActRC && <th className="px-4 py-2.5 w-16" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedRC.allItems || []).map(item => {
                        const isEdit = editingRCItem?.id === item.id;
                        return (
                          <tr key={item.id} className={`group ${isEdit ? 'bg-primary-50/30' : 'hover:bg-slate-50/60'}`}>
                            <td className="px-5 py-3 font-medium text-ink-900 text-sm">
                              <div className="flex items-center gap-1.5"><Lock size={11} className="text-indigo-400 shrink-0" />{item.product_name}</div>
                            </td>
                            <td className="px-5 py-3 text-xs text-ink-400">{item.division?.name || '—'}</td>
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
                            {canActRC && (
                              <td className="px-4 py-3">
                                {isEdit ? (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={handleRCItemSave}><Save size={14} className="text-brand-blue hover:text-brand-blue-dark" /></button>
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

                  {rcAllApprovals.length > 0 && (
                    <div className="mx-5 my-4">
                      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-2">Approval Status</p>
                      <div className="space-y-2">
                        {rcAllApprovals.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.approval_stage === 'division' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {a.approval_stage === 'division' ? (a.division?.name || 'Division') : `Final #${a.sequence_order}`}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-ink-900">{a.approver_name}</p>
                                {a.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{a.rejection_reason}</p>}
                                {a.decided_at && <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(a.decided_at)}</p>}
                              </div>
                            </div>
                            <Badge className={a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : a.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}>{a.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {canActRC && <div className="h-20" />}
                </div>

                <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-ink-400">Contract value</p>
                    <p className="text-base font-bold text-ink-900 tabular-nums">
                      {formatINR((selectedRC.allItems || []).reduce((s, i) => s + i.negotiated_price * i.expected_qty, 0))}
                    </p>
                  </div>
                  {canActRC && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRCRejectModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                        <XCircle size={14} /> Reject
                      </button>
                      <button onClick={handleRCFinalApprove}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm">
                        <CheckCircle size={14} /> Give Final Approval
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RC reject modal ── */}
      {rcRejectModal && selectedRC && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-sm border border-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink-900">RC Final Rejection</h3>
              <button onClick={() => { setRCRejectModal(false); setRCRejectReason(''); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 hover:bg-slate-100 transition-colors"><X size={14} /></button>
            </div>
            <p className="text-sm text-ink-500 mb-3">Rejecting <span className="font-semibold text-ink-800">{selectedRC.rc_code}</span></p>
            <textarea value={rcRejectReason} onChange={e => setRCRejectReason(e.target.value)}
              placeholder="e.g., Commercial terms unacceptable…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-300 resize-none text-ink-900 placeholder:text-ink-400"
              rows={3} autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRCRejectModal(false); setRCRejectReason(''); }} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-ink-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleRCFinalReject} disabled={!rcRejectReason.trim()} className="flex-1 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold disabled:opacity-50 transition-colors">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Reject modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-sm border border-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink-900">Final Rejection Reason</h3>
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 hover:bg-slate-100 transition-colors">
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-ink-500 mb-3">
              Rejecting <span className="font-semibold text-ink-800">{selected?.order_id}</span> — this cannot be undone.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g., Commercial mismatch, wrong pricing…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-300 resize-none text-ink-900 placeholder:text-ink-400"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }}
                className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-ink-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim()}
                className="flex-1 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold disabled:opacity-50 transition-colors">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
