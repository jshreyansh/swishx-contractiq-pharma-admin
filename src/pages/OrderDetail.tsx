import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, User, Package, Clock, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, Truck, GitBranch, Database
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, OrderItem, DivisionApproval, FinalApproval, OrderTimeline } from '../types';
import { formatINR, formatDateTime, stageLabel, stageColor, erpStatusLabel, erpStatusColor, timeAgo } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRole, currentUser, addToast } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [divApprovals, setDivApprovals] = useState<DivisionApproval[]>([]);
  const [finalApprovals, setFinalApprovals] = useState<FinalApproval[]>([]);
  const [timeline, setTimeline] = useState<OrderTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState(false);

  useEffect(() => { if (id) loadOrder(); }, [id]);

  async function loadOrder() {
    setLoading(true);
    const [{ data: o }, { data: oi }, { data: da }, { data: fa }, { data: tl }] = await Promise.all([
      supabase.from('orders').select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*), cfa_user:app_users!orders_cfa_user_id_fkey(*)').eq('id', id!).maybeSingle(),
      supabase.from('order_items').select('*, division:divisions(*)').eq('order_id', id!).order('product_name'),
      supabase.from('division_approvals').select('*, division:divisions(*), approver_user:app_users(*)').eq('order_id', id!),
      supabase.from('final_approvals').select('*, approver_user:app_users(*)').eq('order_id', id!).order('sequence_order'),
      supabase.from('order_timeline').select('*').eq('order_id', id!).order('created_at', { ascending: false }),
    ]);
    if (o) setOrder(o as Order);
    if (oi) setItems(oi as OrderItem[]);
    if (da) setDivApprovals(da as DivisionApproval[]);
    if (fa) setFinalApprovals(fa as FinalApproval[]);
    if (tl) setTimeline(tl as OrderTimeline[]);
    setLoading(false);
  }

  async function handleERPSync() {
    if (!order) return;
    const erpId = `ERP-${Math.floor(Math.random() * 900000 + 100000)}`;
    await supabase.from('orders').update({
      erp_status: 'synced', erp_order_id: erpId,
      erp_synced_at: new Date().toISOString(), stage: 'erp_entered',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('order_timeline').insert({
      order_id: order.id, actor_name: currentUser?.name || 'CFA User', actor_role: 'CFA',
      action: `ERP entry completed. ERP ID: ${erpId}`, action_type: 'erp_synced',
    });
    addToast({ type: 'success', title: 'ERP Synced', message: `Order marked as ERP punched. ID: ${erpId}` });
    loadOrder();
  }

  async function handleFinalERPSync() {
    if (!order) return;
    await supabase.from('orders').update({
      stage: 'erp_sync_done', erp_status: 'synced',
      erp_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('order_timeline').insert({
      order_id: order.id, actor_name: currentUser?.name || 'Final Approver', actor_role: 'Final Approver',
      action: 'Final ERP sync confirmed. Order marked as ERP Sync Done.', action_type: 'erp_sync_done',
    });
    addToast({ type: 'success', title: 'Final ERP Sync Done', message: `Order ${order.order_id} synced to ERP.` });
    loadOrder();
  }

  async function handleDivisionApprove() {
    if (!order || !currentUser) return;
    const divId = currentUser.division_id;
    if (!divId) return;
    await supabase.from('division_approvals').update({
      status: 'approved', approver_user_id: currentUser.id,
      decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('order_id', order.id).eq('division_id', divId);
    await supabase.from('order_items').update({ status: 'approved' })
      .eq('order_id', order.id).eq('division_id', divId).eq('status', 'pending');
    await supabase.from('order_timeline').insert({
      order_id: order.id, actor_name: currentUser.name, actor_role: 'Division Approver',
      action: `${currentUser.division?.name} division approved all items`, action_type: 'division_approved',
    });
    addToast({ type: 'success', title: 'Division Approved', message: 'Your division items have been approved.' });
    setApproveModal(false);
    loadOrder();
  }

  async function handleDivisionReject() {
    if (!order || !currentUser || !rejectReason.trim()) return;
    const divId = currentUser.division_id;
    if (!divId) return;
    await supabase.from('division_approvals').update({
      status: 'rejected', rejection_reason: rejectReason, approver_user_id: currentUser.id,
      decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('order_id', order.id).eq('division_id', divId);
    await supabase.from('order_items').update({ status: 'rejected', rejection_reason: rejectReason })
      .eq('order_id', order.id).eq('division_id', divId);
    await supabase.from('order_timeline').insert({
      order_id: order.id, actor_name: currentUser.name, actor_role: 'Division Approver',
      action: `${currentUser.division?.name} division rejected: ${rejectReason}`, action_type: 'division_rejected',
    });
    addToast({ type: 'warning', title: 'Division Rejected', message: 'Your division items have been rejected.' });
    setRejectModal(false);
    setRejectReason('');
    loadOrder();
  }

  async function handleFinalApprove() {
    if (!order || !currentUser) return;
    await supabase.from('final_approvals').update({
      status: 'approved', decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('order_id', order.id).eq('approver_user_id', currentUser.id);
    const { data: allFinal } = await supabase.from('final_approvals').select('*').eq('order_id', order.id);
    const allApproved = allFinal?.every(fa => fa.status === 'approved');
    if (allApproved) {
      await supabase.from('orders').update({ stage: 'final_approved', updated_at: new Date().toISOString() }).eq('id', order.id);
      await supabase.from('order_timeline').insert({
        order_id: order.id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: 'All final approvers cleared. Order is final approved.', action_type: 'final_approved',
      });
      await supabase.from('notifications_log').insert({
        order_id: order.id, notification_type: 'supply_chain_email',
        recipient_email: 'supplychain@swishx.com', recipient_name: 'Supply Chain Team',
        subject: `Order ${order.order_id} Final Approved - Dispatch Ready`, status: 'sent',
      });
      addToast({ type: 'success', title: 'Final Approved!', message: 'Order finalized. Supply chain email triggered.' });
    } else {
      await supabase.from('order_timeline').insert({
        order_id: order.id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: `${currentUser.name} approved. Awaiting other approvers.`, action_type: 'final_approved',
      });
      addToast({ type: 'info', title: 'Approval Recorded', message: 'Awaiting other final approvers.' });
    }
    setApproveModal(false);
    loadOrder();
  }

  async function handleFinalReject() {
    if (!order || !currentUser || !rejectReason.trim()) return;
    await supabase.from('final_approvals').update({
      status: 'rejected', rejection_reason: rejectReason, decided_at: new Date().toISOString(),
    }).eq('order_id', order.id).eq('approver_user_id', currentUser.id);
    await supabase.from('orders').update({ stage: 'final_rejected', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('order_timeline').insert({
      order_id: order.id, actor_name: currentUser.name, actor_role: 'Final Approver',
      action: `Order rejected: ${rejectReason}`, action_type: 'final_rejected',
    });
    addToast({ type: 'error', title: 'Order Rejected', message: 'Final rejection recorded.' });
    setRejectModal(false);
    setRejectReason('');
    loadOrder();
  }

  const myDivApproval = divApprovals.find(da => da.division_id === currentUser?.division_id);
  const myFinalApproval = finalApprovals.find(fa => fa.approver_user_id === currentUser?.id);
  const myDivItems = items.filter(i => i.division_id === currentUser?.division_id);

  const canDivisionAct = currentRole === 'division_approver' &&
    ['division_processing', 'division_partially_approved', 'division_partially_rejected'].includes(order?.stage || '') &&
    myDivApproval?.status === 'pending';

  const canFinalAct = currentRole === 'final_approver' &&
    order?.stage === 'final_approval_pending' &&
    myFinalApproval?.status === 'pending';

  const canERPAct = currentRole === 'cfa' &&
    ['pending_erp_entry', 'manager_approved'].includes(order?.stage || '') &&
    order?.erp_status === 'pending_sync';

  const canFinalERPSync = currentRole === 'final_approver' && order?.stage === 'final_approved';

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
    if (status === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  const timelineIconClass = (actionType: string) => {
    if (actionType.includes('approved')) return 'bg-emerald-100';
    if (actionType.includes('rejected')) return 'bg-red-100';
    if (actionType === 'email_sent') return 'bg-sky-100';
    return 'bg-slate-100';
  };

  const getTimelineIcon = (actionType: string) => {
    if (actionType.includes('approved')) return <CheckCircle size={10} className="text-emerald-600" />;
    if (actionType.includes('rejected')) return <XCircle size={10} className="text-red-600" />;
    if (actionType === 'email_sent') return <Truck size={10} className="text-sky-600" />;
    return <Clock size={10} className="text-slate-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return <div className="py-20 text-center text-slate-400">Order not found</div>;
  }

  const totalValue = items.filter(i => i.status !== 'rejected' && i.status !== 'removed')
    .reduce((sum, i) => sum + ((i.final_quantity ?? i.quantity) * (i.final_price ?? i.unit_price)), 0);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
      >
        <ArrowLeft size={14} /> Back to Orders
      </button>

      <Card variant="elevated" className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{order.order_id}</h1>
              <Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge>
              <Badge className={erpStatusColor(order.erp_status)}>{erpStatusLabel(order.erp_status)}</Badge>
              {order.sla_breached && (
                <span className="flex items-center gap-1 text-xs text-red-700 font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={11} /> SLA Breached
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-2">
              Created {formatDateTime(order.created_at)} &middot; Last updated {timeAgo(order.updated_at)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-slate-900">{formatINR(totalValue)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Total Order Value</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <Building2 size={11} /> Hospital
            </p>
            <p className="text-sm font-semibold text-slate-800">{order.hospital?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{order.hospital?.city}, {order.hospital?.state}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <User size={11} /> Field Rep
            </p>
            <p className="text-sm font-semibold text-slate-800">{order.field_rep?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">Mgr: {order.manager_name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <Package size={11} /> Stockist
            </p>
            <p className="text-sm font-semibold text-slate-800">{order.stockist?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{order.stockist?.city}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
              <Truck size={11} /> CFA / CNF
            </p>
            <p className="text-sm font-semibold text-slate-800">{order.cfa_user?.name || '—'}</p>
            {order.erp_order_id && (
              <p className="text-xs text-slate-500 mt-0.5 font-mono">ERP: {order.erp_order_id}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Package size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Product Table</h2>
              <span className="ml-auto text-xs text-slate-400">{items.length} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Division</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map(item => {
                    const qty = item.final_quantity ?? item.quantity;
                    const price = item.final_price ?? item.unit_price;
                    const isMyDiv = item.division_id === currentUser?.division_id;
                    return (
                      <tr
                        key={item.id}
                        className={`${item.status === 'rejected' ? 'opacity-50 bg-red-50/30' : ''} ${isMyDiv && currentRole === 'division_approver' ? 'bg-sky-50/40' : ''}`}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {item.product_name}
                          {item.rejection_reason && (
                            <p className="text-xs text-red-500 mt-0.5">{item.rejection_reason}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{item.division?.name}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {item.final_quantity && item.final_quantity !== item.quantity ? (
                            <span>{item.final_quantity} <span className="text-xs text-slate-400 line-through">{item.quantity}</span></span>
                          ) : qty}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {item.final_price && item.final_price !== item.unit_price ? (
                            <span>{formatINR(item.final_price)} <span className="text-xs text-slate-400 line-through">{formatINR(item.unit_price)}</span></span>
                          ) : formatINR(price)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatINR(qty * price)}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={statusBadge(item.status)}>{item.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <GitBranch size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Division Approvals</h2>
            </div>
            <div className="p-4 space-y-2">
              {divApprovals.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Divisions not yet assigned</p>
              ) : divApprovals.map(da => (
                <div key={da.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{da.division?.name}</p>
                    {da.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{da.rejection_reason}</p>}
                    {da.decided_at && <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(da.decided_at)}</p>}
                  </div>
                  <Badge className={statusBadge(da.status)}>{da.status}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <CheckCircle size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Final Approvals</h2>
            </div>
            <div className="p-4 space-y-2">
              {finalApprovals.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Final approval not yet initiated</p>
              ) : finalApprovals.map(fa => (
                <div key={fa.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 shrink-0">
                      {fa.approver_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{fa.approver_name}</p>
                      {fa.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{fa.rejection_reason}</p>}
                      {fa.decided_at && <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(fa.decided_at)}</p>}
                    </div>
                  </div>
                  <Badge className={statusBadge(fa.status)}>{fa.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">ERP Sync</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-xs">Status</span>
                <Badge className={erpStatusColor(order.erp_status)}>{erpStatusLabel(order.erp_status)}</Badge>
              </div>
              {order.erp_order_id && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">ERP ID</span>
                  <span className="font-mono text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded">{order.erp_order_id}</span>
                </div>
              )}
              {order.erp_synced_at && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs">Synced at</span>
                  <span className="text-slate-700 text-xs">{formatDateTime(order.erp_synced_at)}</span>
                </div>
              )}
            </div>
            {canERPAct && (
              <button
                onClick={handleERPSync}
                className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                Mark as ERP Punched
              </button>
            )}
            {canFinalERPSync && (
              <button
                onClick={handleFinalERPSync}
                className="mt-4 w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Database size={13} /> Mark as Final ERP Sync Done
              </button>
            )}
            {order.stage === 'erp_sync_done' && (
              <div className="mt-4 flex items-center gap-2 text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2.5">
                <Database size={13} />
                <p className="text-xs font-semibold">Final ERP Sync Done</p>
              </div>
            )}
          </Card>

          {(canDivisionAct || canFinalAct || (currentRole === 'admin' && ['final_approval_pending', 'division_processing'].includes(order.stage))) && (
            <Card className="p-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Actions</h2>
              <div className="space-y-2">
                {(canDivisionAct || (currentRole === 'admin' && myDivApproval?.status === 'pending')) && (
                  <>
                    <button
                      onClick={() => setApproveModal(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    >
                      <CheckCircle size={14} /> Approve Division Items
                    </button>
                    <button
                      onClick={() => setRejectModal(true)}
                      className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-600 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      <XCircle size={14} /> Reject Division Items
                    </button>
                  </>
                )}
                {canFinalAct && (
                  <>
                    <button
                      onClick={() => setApproveModal(true)}
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    >
                      <CheckCircle size={14} /> Final Approve
                    </button>
                    <button
                      onClick={() => setRejectModal(true)}
                      className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-600 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      <XCircle size={14} /> Final Reject
                    </button>
                  </>
                )}
              </div>
            </Card>
          )}

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
                          {event.field_changed && (
                            <p className="text-xs text-slate-500 mt-0.5 font-mono">
                              {event.field_changed}: {event.old_value} &rarr; {event.new_value}
                            </p>
                          )}
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

      <Modal
        isOpen={approveModal}
        onClose={() => setApproveModal(false)}
        title="Confirm Approval"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setApproveModal(false)}
              className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={canFinalAct ? handleFinalApprove : handleDivisionApprove}
              className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition-colors"
            >
              Approve
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {canDivisionAct
            ? `You are approving ${myDivItems.length} item(s) for the ${currentUser?.division?.name} division.`
            : `You are giving final approval to order ${order.order_id}.`}
        </p>
      </Modal>

      <Modal
        isOpen={rejectModal}
        onClose={() => { setRejectModal(false); setRejectReason(''); }}
        title="Rejection Reason"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => { setRejectModal(false); setRejectReason(''); }}
              className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={canFinalAct ? handleFinalReject : handleDivisionReject}
              disabled={!rejectReason.trim()}
              className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Please provide a reason for rejection (required)</p>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="e.g., Wrong pricing, Product not allowed, ERP mismatch..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none transition-colors"
            rows={3}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
