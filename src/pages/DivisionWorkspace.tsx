import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, CheckCircle, XCircle, ArrowUpRight, Package, X, Pencil, Trash2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, DivisionApproval, OrderItem } from '../types';
import { formatINR, formatDateTime, stageLabel, stageColor, timeAgo } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface OrderWithDivision extends Order {
  my_approval?: DivisionApproval;
  my_items?: OrderItem[];
}

interface EditingItem {
  id: string;
  quantity: number;
  unit_price: number;
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

  const divisionId = currentUser?.division_id;

  const canEdit = selected?.my_approval?.status === 'pending' && (currentRole === 'division_approver' || currentRole === 'admin');

  useEffect(() => {
    if (divisionId || currentRole === 'admin') loadOrders();
  }, [currentUser, currentRole]);

  async function loadOrders() {
    setLoading(true);
    const stageFilter = ['division_processing', 'division_partially_approved', 'division_partially_rejected', 'final_approval_pending', 'final_approved'];
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
    await supabase.from('order_items').update({
      quantity: editingItem.quantity,
      unit_price: editingItem.unit_price,
      updated_at: new Date().toISOString(),
    }).eq('id', editingItem.id);
    await supabase.from('order_timeline').insert({
      order_id: selected.id,
      actor_name: currentUser.name,
      actor_role: 'Division Approver',
      action: `Item updated: qty ${editingItem.quantity}, price ${formatINR(editingItem.unit_price)}`,
      action_type: 'item_edited',
    });
    addToast({ type: 'success', title: 'Item Updated', message: 'Product details saved successfully.' });
    setEditingItem(null);
    await refreshSelected(selected.id);
    setSaving(false);
  }

  async function handleRemoveItem(itemId: string) {
    if (!selected || !currentUser) return;
    await supabase.from('order_items').update({
      status: 'removed',
      rejection_reason: 'Removed by division approver',
      updated_at: new Date().toISOString(),
    }).eq('id', itemId);
    await supabase.from('order_timeline').insert({
      order_id: selected.id,
      actor_name: currentUser.name,
      actor_role: 'Division Approver',
      action: 'Item removed from order by division approver',
      action_type: 'item_removed',
    });
    addToast({ type: 'info', title: 'Item Removed', message: 'Product removed from this order.' });
    setRemoveConfirm(null);
    await refreshSelected(selected.id);
  }

  async function handleApprove(order: OrderWithDivision) {
    if (!currentUser || !divisionId) return;
    await supabase.from('division_approvals').update({
      status: 'approved',
      approver_user_id: currentUser.id,
      decided_at: new Date().toISOString(),
    }).eq('order_id', order.id).eq('division_id', divisionId);
    await supabase.from('order_items').update({ status: 'approved' })
      .eq('order_id', order.id).eq('division_id', divisionId).eq('status', 'pending');
    await supabase.from('order_timeline').insert({
      order_id: order.id,
      actor_name: currentUser.name,
      actor_role: 'Division Approver',
      action: `${currentUser.division?.name} division approved ${order.my_items?.length} item(s)`,
      action_type: 'division_approved',
    });
    addToast({ type: 'success', title: 'Division Approved', message: `Items approved for order ${order.order_id}` });
    loadOrders();
    setSelected(null);
  }

  async function handleReject(order: OrderWithDivision) {
    if (!currentUser || !divisionId || !rejectReason.trim()) return;
    await supabase.from('division_approvals').update({
      status: 'rejected',
      rejection_reason: rejectReason,
      approver_user_id: currentUser.id,
      decided_at: new Date().toISOString(),
    }).eq('order_id', order.id).eq('division_id', divisionId);
    await supabase.from('order_items').update({ status: 'rejected', rejection_reason: rejectReason })
      .eq('order_id', order.id).eq('division_id', divisionId);
    await supabase.from('order_timeline').insert({
      order_id: order.id,
      actor_name: currentUser.name,
      actor_role: 'Division Approver',
      action: `${currentUser.division?.name} division rejected: ${rejectReason}`,
      action_type: 'division_rejected',
    });
    addToast({ type: 'warning', title: 'Division Rejected', message: `Items rejected for order ${order.order_id}` });
    setRejectModal(false);
    setRejectReason('');
    loadOrders();
    setSelected(null);
  }

  const pending = orders.filter(o => o.my_approval?.status === 'pending');
  const done = orders.filter(o => o.my_approval?.status !== 'pending');
  const display = activeTab === 'pending' ? pending : done;

  if (!divisionId && currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <GitBranch size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500">No division assigned to your account</p>
        </div>
      </div>
    );
  }

  const activeItems = (selected?.my_items || []).filter(i => i.status !== 'removed');
  const removedItems = (selected?.my_items || []).filter(i => i.status === 'removed');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Division Workspace</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          {currentRole === 'admin' ? 'All division approvals' : `${currentUser?.division?.name} division — Review and approve your products`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-2xl font-bold text-ink-900">{pending.length}</p>
          <p className="text-xs text-ink-500 mt-1">Pending Action</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-success-600">{orders.filter(o => o.my_approval?.status === 'approved').length}</p>
          <p className="text-xs text-ink-500 mt-1">Approved</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-danger-600">{orders.filter(o => o.my_approval?.status === 'rejected').length}</p>
          <p className="text-xs text-ink-500 mt-1">Rejected</p>
        </Card>
      </div>

      <div className="flex gap-1 bg-app-surface-dark p-1 rounded-lg w-fit">
        {(['pending', 'done'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab ? 'bg-app-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
            {tab === 'pending' ? `Needs Action (${pending.length})` : `Completed (${done.length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-ink-300">Loading...</div>
          ) : display.length === 0 ? (
            <Card className="py-12 text-center">
              <CheckCircle size={32} className="mx-auto text-success-200 mb-2" />
              <p className="text-sm text-ink-300">No orders in this list</p>
            </Card>
          ) : display.map(order => (
            <Card
              key={order.id}
              onClick={() => { setSelected(order); setEditingItem(null); setRemoveConfirm(null); }}
              className={`p-4 ${selected?.id === order.id ? 'border-brand-orange bg-primary-50/30' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-xs font-semibold text-ink-900">{order.order_id}</span>
                <Badge className={
                  order.my_approval?.status === 'approved' ? 'bg-success-100 text-success-700' :
                  order.my_approval?.status === 'rejected' ? 'bg-danger-100 text-danger-700' :
                  'bg-warning-100 text-warning-700'
                }>{order.my_approval?.status || 'pending'}</Badge>
              </div>
              <p className="text-sm font-medium text-ink-900">{order.hospital?.name}</p>
              <p className="text-xs text-ink-500 mt-0.5">{order.field_rep?.name} · {order.stockist?.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-ink-300">{order.my_items?.length} item(s) for your division</span>
                <span className="text-sm font-semibold text-ink-900">{formatINR(order.total_value)}</span>
              </div>
            </Card>
          ))}
        </div>

        {selected ? (
          <div className="space-y-4">
            <Card>
              <div className="px-4 py-3 border-b border-app-surface-dark flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-ink-500" />
                  <h2 className="text-sm font-semibold text-ink-900">
                    Your Division Items — {selected.order_id}
                  </h2>
                </div>
                <button onClick={() => navigate(`/orders/${selected.id}`)} className="text-xs text-brand-blue flex items-center gap-0.5">
                  Full order <ArrowUpRight size={11} />
                </button>
              </div>

              {canEdit && (
                <div className="px-4 py-2 bg-warning-50 border-b border-warning-100">
                  <p className="text-xs text-warning-700 flex items-center gap-1.5">
                    <Pencil size={11} /> You can edit quantities, prices, or remove items before approving
                  </p>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-app-bg border-b border-app-surface-dark">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Product</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-500">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-500">Unit Price</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-500">Total</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-500">Status</th>
                    {canEdit && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-surface-dark">
                  {activeItems.map(item => {
                    const isEditing = editingItem?.id === item.id;
                    const isRemoving = removeConfirm === item.id;
                    return (
                      <tr key={item.id} className={`group ${isEditing ? 'bg-primary-50/40' : isRemoving ? 'bg-danger-50/40' : 'hover:bg-app-bg/60'}`}>
                        <td className="px-4 py-2.5 font-medium text-ink-900">{item.product_name}</td>

                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min={1}
                              value={editingItem.quantity}
                              onChange={e => setEditingItem(prev => prev ? { ...prev, quantity: parseInt(e.target.value) || 1 } : null)}
                              className="w-16 border border-brand-orange/40 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-orange/30"
                            />
                          ) : item.quantity}
                        </td>

                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={editingItem.unit_price}
                              onChange={e => setEditingItem(prev => prev ? { ...prev, unit_price: parseFloat(e.target.value) || 0 } : null)}
                              className="w-24 border border-brand-orange/40 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-orange/30"
                            />
                          ) : formatINR(item.unit_price)}
                        </td>

                        <td className="px-4 py-2.5 text-right font-medium">
                          {isEditing
                            ? formatINR(editingItem.quantity * editingItem.unit_price)
                            : formatINR(item.quantity * item.unit_price)
                          }
                        </td>

                        <td className="px-4 py-2.5">
                          <Badge className={
                            item.status === 'approved' ? 'bg-success-100 text-success-700' :
                            item.status === 'rejected' ? 'bg-danger-100 text-danger-700' :
                            'bg-warning-100 text-warning-700'
                          }>{item.status}</Badge>
                        </td>

                        {canEdit && (
                          <td className="px-3 py-2.5">
                            {isRemoving ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="text-xs text-danger-600 hover:text-danger-800 font-medium"
                                >Remove?</button>
                                <button onClick={() => setRemoveConfirm(null)} className="text-xs text-ink-300 hover:text-ink-500 ml-1">
                                  <X size={11} />
                                </button>
                              </div>
                            ) : isEditing ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={handleSaveItem}
                                  disabled={saving}
                                  className="text-brand-blue hover:text-brand-blue-dark disabled:opacity-50"
                                  title="Save changes"
                                >
                                  <Save size={13} />
                                </button>
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="text-ink-300 hover:text-ink-500"
                                  title="Cancel"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditingItem({ id: item.id, quantity: item.quantity, unit_price: item.unit_price }); setRemoveConfirm(null); }}
                                  className="text-ink-300 hover:text-brand-orange transition-colors"
                                  title="Edit item"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => { setRemoveConfirm(item.id); setEditingItem(null); }}
                                  className="text-ink-300 hover:text-danger-500 transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 size={13} />
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

              {removedItems.length > 0 && (
                <div className="px-4 py-2 border-t border-dashed border-app-surface-dark bg-app-bg/50">
                  <p className="text-xs font-medium text-ink-300 mb-1">Removed Items</p>
                  {removedItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-1">
                      <span className="text-xs text-ink-300 line-through">{item.product_name}</span>
                      <span className="text-xs text-ink-300">{item.quantity} × {formatINR(item.unit_price)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-app-surface-dark flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-ink-300">Active Items Total</p>
                  <p className="text-sm font-bold text-ink-900">
                    {formatINR(activeItems.reduce((s, i) => s + i.quantity * i.unit_price, 0))}
                  </p>
                </div>
              </div>
            </Card>

            {canEdit && (
              <Card className="p-4">
                <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Division Decision</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => handleApprove(selected)}
                    disabled={activeItems.length === 0}
                    className="w-full bg-success-600 hover:bg-success-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle size={14} /> Approve All Division Items
                  </button>
                  <button
                    onClick={() => setRejectModal(true)}
                    className="w-full bg-white hover:bg-danger-50 border border-danger-200 text-danger-600 text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} /> Reject Division Items
                  </button>
                </div>
              </Card>
            )}

            {selected.my_approval?.status !== 'pending' && (
              <Card className="p-4">
                <div className={`text-center py-4 ${selected.my_approval?.status === 'approved' ? 'text-success-600' : 'text-danger-600'}`}>
                  {selected.my_approval?.status === 'approved' ? <CheckCircle size={24} className="mx-auto mb-2" /> : <XCircle size={24} className="mx-auto mb-2" />}
                  <p className="font-semibold text-sm">Division {selected.my_approval?.status}</p>
                  {selected.my_approval?.rejection_reason && (
                    <p className="text-xs text-ink-500 mt-1">{selected.my_approval.rejection_reason}</p>
                  )}
                  {selected.my_approval?.decided_at && (
                    <p className="text-xs text-ink-300 mt-1">{formatDateTime(selected.my_approval.decided_at)}</p>
                  )}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-ink-300">Select an order to review</p>
          </div>
        )}
      </div>

      {rejectModal && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-app-surface rounded-2xl shadow-xl p-6 w-full max-w-sm border border-app-surface-dark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-ink-900">Rejection Reason</h3>
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }}><X size={16} className="text-ink-300" /></button>
            </div>
            <p className="text-sm text-ink-700 mb-3">Required to reject division items</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g., Division cannot supply, Wrong pricing..."
              className="w-full border border-app-surface-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger-500/20 resize-none bg-white text-ink-900"
              rows={3}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }} className="flex-1 py-2 text-sm border border-app-surface-dark rounded-lg text-ink-700 hover:bg-app-bg">Cancel</button>
              <button onClick={() => handleReject(selected)} disabled={!rejectReason.trim()} className="flex-1 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 font-medium disabled:opacity-50">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
