import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, AlertTriangle, ArrowUpRight, X, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, Division, Hospital, FieldRep, Stockist } from '../types';
import { formatINR, stageLabel, stageColor, erpStatusColor, erpStatusLabel, timeAgo } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import CreateOrderModal from '../components/cfa/CreateOrderModal';
import SyncFailureModal from '../components/cfa/SyncFailureModal';

interface ManualOrderPrefill {
  hospitalId: string;
  stockistId: string;
  repId: string;
  notes: string;
}

export default function CFAQueue() {
  const navigate = useNavigate();
  const { currentRole, currentUser, addToast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'failed' | 'history'>('pending');
  const [erpModal, setERPModal] = useState<{ orderId: string; orderNum: string } | null>(null);
  const [erpInput, setErpInput] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<ManualOrderPrefill | null>(null);
  const [syncFailModal, setSyncFailModal] = useState<Order | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stockists, setStockists] = useState<Stockist[]>([]);
  const [reps, setReps] = useState<FieldRep[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  async function loadData() {
    setLoading(true);
    let q = supabase.from('orders')
      .select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*)')
      .order('updated_at', { ascending: false });

    if (currentRole === 'cfa' && currentUser) {
      q = q.eq('cfa_user_id', currentUser.id);
    }

    const { data } = await q;
    if (data) setOrders(data as Order[]);
    setLoading(false);

    const [{ data: h }, { data: s }, { data: r }, { data: d }] = await Promise.all([
      supabase.from('hospitals').select('*').order('name'),
      supabase.from('stockists').select('*').order('name'),
      supabase.from('field_reps').select('*').order('name'),
      supabase.from('divisions').select('*').order('name'),
    ]);
    if (h) setHospitals(h);
    if (s) setStockists(s);
    if (r) setReps(r);
    if (d) setDivisions(d);
  }

  const pending = orders.filter(o => ['pending_erp_entry', 'manager_approved'].includes(o.stage));
  const failed = orders.filter(o => o.stage === 'erp_sync_failed' || o.erp_status === 'sync_failed');
  const history = orders.filter(o => ['erp_entered', 'division_processing', 'final_approval_pending', 'final_approved', 'erp_sync_done', 'sent_to_supply_chain', 'sent_to_stockist', 'completed'].includes(o.stage));

  async function handleMarkERP() {
    if (!erpModal || !erpInput.trim() || !currentUser) return;
    await supabase.from('orders').update({
      erp_status: 'synced',
      erp_order_id: erpInput,
      erp_synced_at: new Date().toISOString(),
      stage: 'erp_entered',
      updated_at: new Date().toISOString(),
    }).eq('id', erpModal.orderId);
    await supabase.from('order_timeline').insert({
      order_id: erpModal.orderId,
      actor_name: currentUser.name,
      actor_role: 'CFA',
      action: `ERP entry completed. ERP ID: ${erpInput}`,
      action_type: 'erp_synced',
    });
    addToast({ type: 'success', title: 'ERP Marked', message: `Order ${erpModal.orderNum} synced with ERP ID: ${erpInput}` });
    setERPModal(null);
    setErpInput('');
    loadData();
  }

  async function handleMarkSyncFailed(order: Order) {
    if (!currentUser) return;
    await supabase.from('orders').update({
      erp_status: 'sync_failed',
      stage: 'erp_sync_failed',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('order_timeline').insert({
      order_id: order.id,
      actor_name: currentUser.name,
      actor_role: 'CFA',
      action: `ERP sync marked as failed by ${currentUser.name}. Recovery action required.`,
      action_type: 'erp_sync_failed',
    });
    addToast({ type: 'error', title: 'Sync Failed', message: `Order ${order.order_id} marked as ERP sync failed.` });
    loadData();
  }

  async function handleRetrySync(order: Order) {
    if (!currentUser) return;
    await supabase.from('orders').update({
      erp_status: 'resync_required',
      stage: 'pending_erp_entry',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('order_timeline').insert({
      order_id: order.id,
      actor_name: currentUser.name,
      actor_role: 'CFA',
      action: `ERP sync retry initiated. Order returned to pending ERP entry.`,
      action_type: 'erp_retry',
    });
    addToast({ type: 'info', title: 'Retry Initiated', message: `Order ${order.order_id} queued for ERP re-sync.` });
    setSyncFailModal(null);
    loadData();
  }

  async function handleEditAndRetrySync(order: Order, newErpId: string) {
    if (!currentUser) return;
    await supabase.from('orders').update({
      erp_order_id: newErpId,
      erp_status: 'resync_required',
      stage: 'pending_erp_entry',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('order_timeline').insert({
      order_id: order.id,
      actor_name: currentUser.name,
      actor_role: 'CFA',
      action: `ERP ID updated to ${newErpId} and retry initiated.`,
      action_type: 'erp_retry',
    });
    addToast({ type: 'info', title: 'ERP Updated & Retry', message: `Order ${order.order_id} updated with new ERP ID and queued for re-sync.` });
    setSyncFailModal(null);
    loadData();
  }

  function handleOpenManualFromFailure(order: Order) {
    setManualPrefill({
      hospitalId: order.hospital_id,
      stockistId: order.stockist_id,
      repId: order.field_rep_id,
      notes: `Manually created to replace failed ERP sync for ${order.order_id}`,
    });
    setCreateModal(true);
  }

  async function handleCreateOrder(params: {
    hospitalId: string; stockistId: string; repId: string; notes: string;
    items: { productId: string; productName: string; divisionId: string; quantity: number; unitPrice: number }[];
  }) {
    if (!currentUser) return;
    const orderId = `ORD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000 + 10000))}`;
    const totalValue = params.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const { data: o } = await supabase.from('orders').insert({
      order_id: orderId,
      hospital_id: params.hospitalId,
      stockist_id: params.stockistId,
      field_rep_id: params.repId,
      cfa_user_id: currentUser.id,
      stage: 'division_processing',
      erp_status: 'manual_added',
      manager_name: 'Manual Entry',
      manager_approved_at: new Date().toISOString(),
      total_value: totalValue,
      notes: `[Manually Created Order] ${params.notes}`,
    }).select().maybeSingle();
    if (o) {
      const divIds = [...new Set(params.items.map(i => i.divisionId))];
      await Promise.all([
        supabase.from('order_items').insert(
          params.items.map(item => ({
            order_id: o.id,
            product_name: item.productName,
            division_id: item.divisionId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            status: 'pending',
          }))
        ),
        supabase.from('division_approvals').insert(
          divIds.map(divId => ({
            order_id: o.id,
            division_id: divId,
            status: 'pending',
          }))
        ),
        supabase.from('order_timeline').insert({
          order_id: o.id,
          actor_name: currentUser.name,
          actor_role: 'CFA',
          action: `Manually created order with ${params.items.length} product(s) totalling ${formatINR(totalValue)}. Flagged as manually created.`,
          action_type: 'created',
        }),
      ]);
    }
    addToast({ type: 'success', title: 'Manual Order Created', message: `Order ${orderId} created and sent to division approval.` });
    setCreateModal(false);
    setManualPrefill(null);
    loadData();
  }

  const displayOrders = activeTab === 'pending' ? pending : activeTab === 'failed' ? failed : history;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">CFA / CNF Queue</h1>
          <p className="text-sm text-ink-500 mt-0.5">ERP punching and order sync workspace</p>
        </div>
        <button
          onClick={() => setCreateModal(true)}
          className="flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Create Manual Order
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-warning-50 rounded-lg flex items-center justify-center">
              <AlertTriangle size={16} className="text-warning-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-ink-900">{pending.length}</p>
              <p className="text-xs text-ink-500">Pending ERP Entry</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-danger-50 rounded-lg flex items-center justify-center">
              <XCircle size={16} className="text-danger-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-ink-900">{failed.length}</p>
              <p className="text-xs text-ink-500">Sync Failed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-success-50 rounded-lg flex items-center justify-center">
              <CheckCircle size={16} className="text-success-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-ink-900">{history.length}</p>
              <p className="text-xs text-ink-500">Synced Orders</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
              <AlertTriangle size={16} className="text-brand-orange" />
            </div>
            <div>
              <p className="text-xl font-bold text-ink-900">{orders.filter(o => o.sla_breached).length}</p>
              <p className="text-xs text-ink-500">SLA Breached</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-1 bg-app-surface-dark p-1 rounded-lg w-fit">
        {(['pending', 'failed', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab ? 'bg-app-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
          >
            {tab === 'pending' ? `Pending (${pending.length})` :
             tab === 'failed' ? (
               <span className="flex items-center gap-1">
                 Sync Failed
                 {failed.length > 0 && <span className="bg-danger-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">{failed.length}</span>}
               </span>
             ) : `History (${history.length})`}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="py-12 text-center text-ink-300">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-bg border-b border-app-surface-dark">
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Hospital</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">ERP Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500 uppercase">Value</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500 uppercase">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-surface-dark">
              {displayOrders.map(order => (
                <tr key={order.id} className={`hover:bg-app-bg ${order.sla_breached ? 'bg-danger-50/20' : ''} ${order.stage === 'erp_sync_failed' ? 'bg-danger-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-ink-900">{order.order_id}</span>
                      {order.sla_breached && <AlertTriangle size={11} className="text-danger-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{order.hospital?.name}</td>
                  <td className="px-4 py-3"><Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge></td>
                  <td className="px-4 py-3"><Badge className={erpStatusColor(order.erp_status)}>{erpStatusLabel(order.erp_status)}</Badge></td>
                  <td className="px-4 py-3 text-right font-medium text-ink-900">{formatINR(order.total_value)}</td>
                  <td className="px-4 py-3 text-right text-xs text-ink-300">{timeAgo(order.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {activeTab === 'pending' && (
                        <>
                          <button
                            onClick={() => setERPModal({ orderId: order.id, orderNum: order.order_id })}
                            className="text-xs bg-warning-500 hover:bg-warning-600 text-white px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Mark ERP
                          </button>
                          <button
                            onClick={() => handleMarkSyncFailed(order)}
                            className="text-xs bg-white hover:bg-danger-50 border border-danger-200 text-danger-600 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Sync Failed
                          </button>
                        </>
                      )}
                      {activeTab === 'failed' && (
                        <button
                          onClick={() => setSyncFailModal(order)}
                          className="text-xs bg-danger-600 hover:bg-danger-700 text-white px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Recover
                        </button>
                      )}
                      <button onClick={() => navigate(`/orders/${order.id}`)} className="text-ink-300 hover:text-ink-700">
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-300">
                    {activeTab === 'failed' ? 'No failed sync orders' : 'No orders in this list'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {erpModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-app-surface rounded-2xl shadow-xl p-6 w-full max-w-sm border border-app-surface-dark">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink-900">Mark ERP Punched</h3>
              <button onClick={() => setERPModal(null)}><X size={16} className="text-ink-300" /></button>
            </div>
            <p className="text-sm text-ink-700 mb-3">Order: <span className="font-mono font-medium">{erpModal.orderNum}</span></p>
            <input
              type="text"
              value={erpInput}
              onChange={e => setErpInput(e.target.value)}
              placeholder="Enter ERP Order ID (e.g. ERP-789123)"
              className="w-full border border-app-surface-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/40 bg-white text-ink-900"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setERPModal(null)} className="flex-1 py-2 text-sm border border-app-surface-dark rounded-lg text-ink-700 hover:bg-app-bg">Cancel</button>
              <button onClick={handleMarkERP} disabled={!erpInput.trim()} className="flex-1 py-2 text-sm bg-warning-500 text-white rounded-lg hover:bg-warning-600 font-medium disabled:opacity-50">
                Confirm Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {syncFailModal && (
        <SyncFailureModal
          order={syncFailModal}
          onClose={() => setSyncFailModal(null)}
          onRetry={handleRetrySync}
          onEditAndRetry={handleEditAndRetrySync}
          onCreateManual={handleOpenManualFromFailure}
        />
      )}

      {createModal && (
        <CreateOrderModal
          hospitals={hospitals}
          stockists={stockists}
          reps={reps}
          divisions={divisions}
          prefill={manualPrefill || undefined}
          onClose={() => { setCreateModal(false); setManualPrefill(null); }}
          onSubmit={handleCreateOrder}
        />
      )}
    </div>
  );
}
