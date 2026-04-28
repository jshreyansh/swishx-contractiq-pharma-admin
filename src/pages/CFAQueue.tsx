import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, ArrowUpRight, X, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, Division, Hospital, FieldRep, Stockist } from '../types';
import { formatINR, stageLabel, stageColor, erpStatusColor, erpStatusLabel, timeAgo } from '../utils/formatters';
import { ensureDivisionApprovalsForOrder, ensureFinalApprovalsForOrder } from '../utils/orderWorkflow';
import { getMutationError } from '../utils/supabaseWrites';
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

  const pending = orders.filter(o => o.stage === 'pending_erp_entry' && !['sync_failed', 'resync_required'].includes(o.erp_status));
  const failed = orders.filter(o => o.stage === 'pending_erp_entry' && ['sync_failed', 'resync_required'].includes(o.erp_status));
  const history = orders.filter(o => ['final_approval_pending', 'final_approved', 'final_rejected', 'completed'].includes(o.stage));

  async function handleMarkERP() {
    if (!erpModal || !erpInput.trim() || !currentUser) return;
    try {
      await ensureFinalApprovalsForOrder(erpModal.orderId);

      const orderUpdate = await supabase.from('orders').update({
        erp_status: 'synced',
        erp_order_id: erpInput,
        erp_synced_at: new Date().toISOString(),
        stage: 'final_approval_pending',
        updated_at: new Date().toISOString(),
      }).eq('id', erpModal.orderId).select('id');
      const orderUpdateError = getMutationError(orderUpdate, 'The CFA / CNF processing update could not be saved for this order.');
      if (orderUpdateError) throw new Error(orderUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: erpModal.orderId,
        actor_name: currentUser.name,
        actor_role: 'CFA / CNF',
        action: `CFA / CNF processing completed. Reference ${erpInput}. Sent to final approval.`,
        action_type: 'erp_synced',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated after CFA / CNF processing.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'success', title: 'Processing Completed', message: `Order ${erpModal.orderNum} moved to final approval.` });
      setERPModal(null);
      setErpInput('');
      loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Processing Update Failed',
        message: error instanceof Error ? error.message : 'The CFA / CNF processing update could not be completed.',
      });
    }
  }

  async function handleMarkSyncFailed(order: Order) {
    if (!currentUser) return;
    try {
      const orderUpdate = await supabase.from('orders').update({
        erp_status: 'sync_failed',
        stage: 'pending_erp_entry',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id).select('id');
      const orderUpdateError = getMutationError(orderUpdate, 'The processing exception could not be saved.');
      if (orderUpdateError) throw new Error(orderUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: order.id,
        actor_name: currentUser.name,
        actor_role: 'CFA / CNF',
        action: `Processing exception raised by ${currentUser.name}. Recovery action required.`,
        action_type: 'erp_sync_failed',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated for the processing exception.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'error', title: 'Exception Logged', message: `Order ${order.order_id} was moved to the exception queue.` });
      loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'The processing exception could not be recorded.',
      });
    }
  }

  async function handleRetrySync(order: Order) {
    if (!currentUser) return;
    try {
      const orderUpdate = await supabase.from('orders').update({
        erp_status: 'pending_sync',
        stage: 'pending_erp_entry',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id).select('id');
      const orderUpdateError = getMutationError(orderUpdate, 'The retry status could not be saved.');
      if (orderUpdateError) throw new Error(orderUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: order.id,
        actor_name: currentUser.name,
        actor_role: 'CFA / CNF',
        action: 'Processing retry initiated. Order returned to the active CFA / CNF queue.',
        action_type: 'erp_retry',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated for the retry.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'info', title: 'Retry Initiated', message: `Order ${order.order_id} returned to the active processing queue.` });
      setSyncFailModal(null);
      loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Retry Failed',
        message: error instanceof Error ? error.message : 'The processing retry could not be queued.',
      });
    }
  }

  async function handleEditAndRetrySync(order: Order, newErpId: string) {
    if (!currentUser) return;
    try {
      const orderUpdate = await supabase.from('orders').update({
        erp_order_id: newErpId,
        erp_status: 'pending_sync',
        stage: 'pending_erp_entry',
        updated_at: new Date().toISOString(),
      }).eq('id', order.id).select('id');
      const orderUpdateError = getMutationError(orderUpdate, 'The processing reference could not be updated.');
      if (orderUpdateError) throw new Error(orderUpdateError);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: order.id,
        actor_name: currentUser.name,
        actor_role: 'CFA / CNF',
        action: `Processing reference updated to ${newErpId} and retry initiated.`,
        action_type: 'erp_retry',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'Order history could not be updated for the processing retry.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'info', title: 'Reference Updated', message: `Order ${order.order_id} was updated and returned to the active queue.` });
      setSyncFailModal(null);
      loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Retry Failed',
        message: error instanceof Error ? error.message : 'The processing retry could not be updated.',
      });
    }
  }

  function handleOpenManualFromFailure(order: Order) {
    setManualPrefill({
      hospitalId: order.hospital_id,
      stockistId: order.stockist_id,
      repId: order.field_rep_id,
      notes: `Created as an exception order for ${order.order_id}`,
    });
    setCreateModal(true);
  }

  async function handleCreateOrder(params: {
    hospitalId: string; stockistId: string; repId: string; notes: string;
    items: { productId: string; productName: string; divisionId: string; quantity: number; unitPrice: number }[];
  }) {
    if (!currentUser) return;
    try {
      const orderId = `ORD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000 + 10000))}`;
      const totalValue = params.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const orderInsert = await supabase.from('orders').insert({
        order_id: orderId,
        hospital_id: params.hospitalId,
        stockist_id: params.stockistId,
        field_rep_id: params.repId,
        cfa_user_id: currentUser.id,
        stage: 'division_processing',
        erp_status: 'manual_added',
        manager_name: `${currentUser.name} (Exception Order)`,
        manager_approved_at: new Date().toISOString(),
        total_value: totalValue,
        notes: `[Exception Order] ${params.notes}`,
      }).select('id').maybeSingle();
      const orderInsertError = getMutationError(orderInsert, 'The exception order could not be created.');
      if (orderInsertError || !orderInsert.data) throw new Error(orderInsertError || 'The exception order could not be created.');
      const createdOrderId = orderInsert.data.id;

      const itemInsert = await supabase.from('order_items').insert(
        params.items.map(item => ({
          order_id: createdOrderId,
          product_name: item.productName,
          division_id: item.divisionId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          status: 'pending',
        }))
      ).select('id');
      const itemInsertError = getMutationError(itemInsert, 'The exception order items could not be created.');
      if (itemInsertError) throw new Error(itemInsertError);

      await ensureDivisionApprovalsForOrder(createdOrderId);

      const timelineInsert = await supabase.from('order_timeline').insert({
        order_id: createdOrderId,
        actor_name: currentUser.name,
        actor_role: 'CFA / CNF',
        action: `Exception order created with ${params.items.length} product(s) totalling ${formatINR(totalValue)}. Routed to division review.`,
        action_type: 'created',
      }).select('id');
      const timelineInsertError = getMutationError(timelineInsert, 'The exception order history could not be created.');
      if (timelineInsertError) throw new Error(timelineInsertError);

      addToast({ type: 'success', title: 'Exception Order Created', message: `Order ${orderId} was created and sent to division review.` });
      setCreateModal(false);
      setManualPrefill(null);
      loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'The exception order could not be created.',
      });
    }
  }

  const displayOrders = activeTab === 'pending' ? pending : activeTab === 'failed' ? failed : history;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">CFA / CNF Queue</h1>
          <p className="text-sm text-ink-500 mt-0.5">Processing queue after division clearance, plus exception recovery</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-warning-50 rounded-lg flex items-center justify-center">
              <AlertTriangle size={16} className="text-warning-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-ink-900">{pending.length}</p>
              <p className="text-xs text-ink-500">Pending Processing</p>
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
              <p className="text-xs text-ink-500">Exceptions</p>
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
              <p className="text-xs text-ink-500">Processed Orders</p>
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
                 Exceptions
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase">Processing Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500 uppercase">Value</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500 uppercase">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-surface-dark">
              {displayOrders.map(order => (
                <tr key={order.id} className={`hover:bg-app-bg ${order.sla_breached ? 'bg-danger-50/20' : ''} ${order.erp_status === 'sync_failed' ? 'bg-danger-50/30' : ''}`}>
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
                            Complete Processing
                          </button>
                          <button
                            onClick={() => handleMarkSyncFailed(order)}
                            className="text-xs bg-white hover:bg-danger-50 border border-danger-200 text-danger-600 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Log Exception
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
                    {activeTab === 'failed' ? 'No processing exceptions' : 'No orders in this list'}
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
              <h3 className="text-base font-bold text-ink-900">Complete CFA / CNF Processing</h3>
              <button onClick={() => setERPModal(null)}><X size={16} className="text-ink-300" /></button>
            </div>
            <p className="text-sm text-ink-700 mb-3">Order: <span className="font-mono font-medium">{erpModal.orderNum}</span></p>
            <input
              type="text"
              value={erpInput}
              onChange={e => setErpInput(e.target.value)}
              placeholder="Enter processing reference (e.g. CFA-24018)"
              className="w-full border border-app-surface-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/40 bg-white text-ink-900"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setERPModal(null)} className="flex-1 py-2 text-sm border border-app-surface-dark rounded-lg text-ink-700 hover:bg-app-bg">Cancel</button>
              <button onClick={handleMarkERP} disabled={!erpInput.trim()} className="flex-1 py-2 text-sm bg-warning-500 text-white rounded-lg hover:bg-warning-600 font-medium disabled:opacity-50">
                Move to Final Approval
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
