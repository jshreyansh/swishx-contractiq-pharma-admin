import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, CheckCircle, XCircle, CreditCard as Edit2, Save, X, ArrowUpRight, Package, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, OrderItem, FinalApproval as FinalApprovalType } from '../types';
import { formatINR, formatDateTime, timeAgo, stageColor, stageLabel } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function FinalApproval() {
  const navigate = useNavigate();
  const { currentRole, currentUser, addToast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [myApproval, setMyApproval] = useState<FinalApprovalType | null>(null);
  const [allApprovals, setAllApprovals] = useState<FinalApprovalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ qty: number; price: number }>({ qty: 0, price: 0 });
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');

  useEffect(() => {
    loadOrders();
  }, [currentUser]);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*)')
      .in('stage', ['final_approval_pending', 'final_approved', 'erp_sync_done', 'final_rejected', 'sent_to_supply_chain', 'sent_to_stockist', 'completed'])
      .order('updated_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  async function selectOrder(order: Order) {
    setSelected(order);
    setEditingItem(null);
    const [{ data: oi }, { data: fa }, { data: my }] = await Promise.all([
      supabase.from('order_items').select('*, division:divisions(*)').eq('order_id', order.id).neq('status', 'rejected'),
      supabase.from('final_approvals').select('*, approver_user:app_users(*)').eq('order_id', order.id).order('sequence_order'),
      currentUser ? supabase.from('final_approvals').select('*').eq('order_id', order.id).eq('approver_user_id', currentUser.id).maybeSingle() : { data: null },
    ]);
    if (oi) setItems(oi as OrderItem[]);
    if (fa) setAllApprovals(fa as FinalApprovalType[]);
    if (my) setMyApproval(my as FinalApprovalType);
  }

  async function handleApprove() {
    if (!selected || !currentUser || !myApproval) return;
    await supabase.from('final_approvals').update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', myApproval.id);
    const { data: allFinal } = await supabase.from('final_approvals').select('*').eq('order_id', selected.id);
    const allApproved = allFinal?.every(fa => fa.status === 'approved');
    if (allApproved) {
      await supabase.from('orders').update({ stage: 'final_approved', updated_at: new Date().toISOString() }).eq('id', selected.id);
      await supabase.from('order_timeline').insert({
        order_id: selected.id, actor_name: currentUser.name, actor_role: 'Final Approver',
        action: 'All final approvers cleared. Order is final approved.', action_type: 'final_approved',
      });
      await supabase.from('notifications_log').insert([
        { order_id: selected.id, notification_type: 'supply_chain_email', recipient_email: 'supplychain@swishx.com', recipient_name: 'Supply Chain Team', subject: `Order ${selected.order_id} Final Approved - Dispatch Ready`, status: 'sent' },
        { order_id: selected.id, notification_type: 'supply_chain_email', recipient_email: 'warehouse@swishx.com', recipient_name: 'Warehouse Team', subject: `Order ${selected.order_id} Final Approved - Dispatch Ready`, status: 'sent' },
      ]);
      addToast({ type: 'success', title: 'Order Final Approved!', message: 'Supply chain and warehouse emails triggered.' });
    } else {
      addToast({ type: 'info', title: 'Approval Recorded', message: 'Awaiting other final approvers.' });
    }
    loadOrders();
    selectOrder({ ...selected, stage: allApproved ? 'final_approved' : selected.stage });
  }

  async function handleReject() {
    if (!selected || !currentUser || !myApproval || !rejectReason.trim()) return;
    await supabase.from('final_approvals').update({
      status: 'rejected', rejection_reason: rejectReason,
      decided_at: new Date().toISOString(),
    }).eq('id', myApproval.id);
    await supabase.from('orders').update({ stage: 'final_rejected', updated_at: new Date().toISOString() }).eq('id', selected.id);
    await supabase.from('order_timeline').insert({
      order_id: selected.id, actor_name: currentUser.name, actor_role: 'Final Approver',
      action: `Order rejected: ${rejectReason}`, action_type: 'final_rejected',
    });
    addToast({ type: 'error', title: 'Order Rejected', message: 'Final rejection recorded.' });
    setRejectModal(false);
    setRejectReason('');
    loadOrders();
    selectOrder({ ...selected, stage: 'final_rejected' });
  }

  async function handleERPFinalSync() {
    if (!selected || !currentUser) return;
    await supabase.from('orders').update({
      stage: 'erp_sync_done',
      erp_status: 'synced',
      erp_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    await supabase.from('order_timeline').insert({
      order_id: selected.id,
      actor_name: currentUser.name,
      actor_role: 'Final Approver',
      action: 'Final ERP sync confirmed. Order marked as ERP Sync Done.',
      action_type: 'erp_sync_done',
    });
    addToast({ type: 'success', title: 'Final ERP Sync Done', message: `Order ${selected.order_id} has been synced to ERP.` });
    loadOrders();
    selectOrder({ ...selected, stage: 'erp_sync_done' });
  }

  async function handleSaveEdit(item: OrderItem) {
    if (!currentUser) return;
    await supabase.from('order_items').update({
      final_quantity: editValues.qty,
      final_price: editValues.price,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    await supabase.from('order_timeline').insert({
      order_id: item.order_id, actor_name: currentUser.name, actor_role: 'Final Approver',
      action: `Edited ${item.product_name}: Qty ${item.final_quantity ?? item.quantity}→${editValues.qty}, Price ${formatINR(item.final_price ?? item.unit_price)}→${formatINR(editValues.price)}`,
      action_type: 'edited',
    });
    addToast({ type: 'info', title: 'Item Updated', message: `${item.product_name} quantity and price updated.` });
    setEditingItem(null);
    if (selected) selectOrder(selected);
  }

  async function handleRemoveItem(item: OrderItem) {
    if (!currentUser) return;
    await supabase.from('order_items').update({ status: 'removed' }).eq('id', item.id);
    await supabase.from('order_timeline').insert({
      order_id: item.order_id, actor_name: currentUser.name, actor_role: 'Final Approver',
      action: `Removed product: ${item.product_name}`, action_type: 'edited',
    });
    addToast({ type: 'warning', title: 'Product Removed', message: `${item.product_name} removed from final order.` });
    if (selected) selectOrder(selected);
  }

  const pending = orders.filter(o => ['final_approval_pending', 'final_approved'].includes(o.stage));
  const done = orders.filter(o => !['final_approval_pending', 'final_approved'].includes(o.stage));
  const display = activeTab === 'pending' ? pending : done;

  const canAct = currentRole === 'final_approver' && selected?.stage === 'final_approval_pending' && myApproval?.status === 'pending';
  const canEdit = (currentRole === 'final_approver' || currentRole === 'admin') && selected?.stage === 'final_approval_pending';
  const canERPSync = currentRole === 'final_approver' && selected?.stage === 'final_approved';

  const totalValue = items.reduce((sum, i) => sum + ((i.final_quantity ?? i.quantity) * (i.final_price ?? i.unit_price)), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Final Approval Workspace</h1>
        <p className="text-sm text-ink-500 mt-0.5">Last correction point before orders become executable</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-2xl font-bold text-warning-600">{orders.filter(o => o.stage === 'final_approval_pending').length}</p>
          <p className="text-xs text-ink-500 mt-1">Awaiting Approval</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-success-600">{orders.filter(o => o.stage === 'final_approved').length}</p>
          <p className="text-xs text-ink-500 mt-1">Final Approved</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-teal-500">{orders.filter(o => o.stage === 'erp_sync_done').length}</p>
          <p className="text-xs text-ink-500 mt-1">ERP Sync Done</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-danger-600">{orders.filter(o => o.stage === 'final_rejected').length}</p>
          <p className="text-xs text-ink-500 mt-1">Final Rejected</p>
        </Card>
      </div>

      <div className="flex gap-1 bg-app-surface-dark p-1 rounded-lg w-fit">
        {(['pending', 'done'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab ? 'bg-app-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
            {tab === 'pending' ? `Needs Action (${pending.length})` : `Processed (${done.length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-2 space-y-2">
          {loading ? <div className="py-8 text-center text-ink-300">Loading...</div> :
           display.length === 0 ? (
            <Card className="py-12 text-center">
              <CheckCircle size={28} className="mx-auto text-success-200 mb-2" />
              <p className="text-sm text-ink-300">No orders here</p>
            </Card>
          ) : display.map(order => (
            <Card
              key={order.id}
              onClick={() => selectOrder(order)}
              className={`p-4 ${selected?.id === order.id ? 'border-brand-orange bg-primary-50/30' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-semibold text-ink-900">{order.order_id}</span>
                <Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge>
              </div>
              <p className="text-sm font-medium text-ink-900">{order.hospital?.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-ink-300">{timeAgo(order.updated_at)}</span>
                <span className="text-sm font-bold text-ink-900">{formatINR(order.total_value)}</span>
              </div>
            </Card>
          ))}
        </div>

        {selected ? (
          <div className="col-span-3 space-y-4">
            <Card>
              <div className="px-4 py-3 border-b border-app-surface-dark flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-ink-500" />
                  <h2 className="text-sm font-semibold text-ink-900">Final Order — {selected.order_id}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-900">{formatINR(totalValue)}</span>
                  <button onClick={() => navigate(`/orders/${selected.id}`)} className="text-xs text-brand-blue flex items-center gap-0.5">
                    Full detail <ArrowUpRight size={11} />
                  </button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-app-bg border-b border-app-surface-dark">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Product</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Division</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-500">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-500">Price</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-500">Total</th>
                    {canEdit && <th className="px-4 py-2.5 text-center text-xs font-medium text-ink-500">Edit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-surface-dark">
                  {items.map(item => {
                    const isEditing = editingItem === item.id;
                    const qty = isEditing ? editValues.qty : (item.final_quantity ?? item.quantity);
                    const price = isEditing ? editValues.price : (item.final_price ?? item.unit_price);
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 font-medium text-ink-900">{item.product_name}</td>
                        <td className="px-4 py-2.5 text-xs text-ink-500">{item.division?.name}</td>
                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <input type="number" value={editValues.qty} min={1}
                              onChange={e => setEditValues(p => ({ ...p, qty: parseInt(e.target.value) || 1 }))}
                              className="w-16 text-right border border-brand-orange/40 rounded px-1 py-0.5 text-xs focus:outline-none" />
                          ) : qty}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <input type="number" value={editValues.price} min={0}
                              onChange={e => setEditValues(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                              className="w-20 text-right border border-brand-orange/40 rounded px-1 py-0.5 text-xs focus:outline-none" />
                          ) : formatINR(price)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatINR(qty * price)}</td>
                        {canEdit && (
                          <td className="px-4 py-2.5 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleSaveEdit(item)} className="text-success-600 hover:text-success-700">
                                  <Save size={13} />
                                </button>
                                <button onClick={() => setEditingItem(null)} className="text-ink-300 hover:text-ink-500">
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => { setEditingItem(item.id); setEditValues({ qty: item.final_quantity ?? item.quantity, price: item.final_price ?? item.unit_price }); }}
                                  className="text-ink-300 hover:text-brand-orange">
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => handleRemoveItem(item)} className="text-ink-300 hover:text-danger-600">
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <Card className="p-4">
              <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Approval Status</h2>
              <div className="space-y-2">
                {allApprovals.map(fa => (
                  <div key={fa.id} className="flex items-center justify-between p-2.5 rounded-lg bg-app-bg border border-app-surface-dark">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{fa.approver_name}</p>
                      {fa.rejection_reason && <p className="text-xs text-danger-500 mt-0.5">{fa.rejection_reason}</p>}
                      {fa.decided_at && <p className="text-xs text-ink-300 mt-0.5">{formatDateTime(fa.decided_at)}</p>}
                    </div>
                    <Badge className={fa.status === 'approved' ? 'bg-success-100 text-success-700' : fa.status === 'rejected' ? 'bg-danger-100 text-danger-700' : 'bg-warning-100 text-warning-700'}>
                      {fa.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {selected.stage === 'erp_sync_done' && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-teal-600">
                  <Database size={16} />
                  <p className="text-sm font-semibold">Final ERP Sync Done</p>
                </div>
                <p className="text-xs text-ink-500 mt-1.5">This order has been confirmed as synced to ERP by a final approver.</p>
              </Card>
            )}

            {canERPSync && (
              <Card className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Database size={14} className="text-teal-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Final ERP Sync</p>
                    <p className="text-xs text-ink-500 mt-0.5">Confirm that this order has been entered and synced in the ERP system. Any final approver can do this.</p>
                  </div>
                </div>
                <button
                  onClick={handleERPFinalSync}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Database size={14} /> Mark as Final ERP Sync Done
                </button>
              </Card>
            )}

            {canAct && (
              <Card className="p-4">
                <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Final Decision</h2>
                <div className="space-y-2">
                  <button onClick={handleApprove} className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    <CheckCircle size={14} /> Give Final Approval
                  </button>
                  <button onClick={() => setRejectModal(true)} className="w-full bg-white hover:bg-danger-50 border border-danger-200 text-danger-600 text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    <XCircle size={14} /> Reject Order
                  </button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="col-span-3 flex items-center justify-center h-48">
            <p className="text-sm text-ink-300">Select an order to review</p>
          </div>
        )}
      </div>

      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-app-surface rounded-2xl shadow-xl p-6 w-full max-w-sm border border-app-surface-dark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-ink-900">Final Rejection Reason</h3>
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }}><X size={16} className="text-ink-300" /></button>
            </div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g., Commercial mismatch, Wrong pricing..."
              className="w-full border border-app-surface-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger-500/20 resize-none bg-white text-ink-900" rows={3} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }} className="flex-1 py-2 text-sm border border-app-surface-dark rounded-lg text-ink-700 hover:bg-app-bg">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="flex-1 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 font-medium disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
