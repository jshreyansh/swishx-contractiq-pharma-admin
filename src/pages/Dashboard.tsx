import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle, XCircle, Truck, GitBranch,
  CheckSquare, ArrowRight, RefreshCw, Activity, Package,
  IndianRupee, Clock, ScrollText,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, RateContract } from '../types';
import { formatINR, getOrderPricingMode, stageLabel, stageColor, timeAgo } from '../utils/formatters';
import Badge from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/SkeletonLoader';

export default function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [rcs, setRCs]       = useState<RateContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const [{ data: ordersData }, { data: rcData }] = await Promise.all([
      supabase.from('orders').select('*, hospital:hospitals(*), field_rep:field_reps(*)').order('updated_at', { ascending: false }),
      supabase.from('rate_contracts').select('*'),
    ]);
    if (ordersData) setOrders(ordersData as Order[]);
    if (rcData) setRCs(rcData as RateContract[]);
    setLoading(false);
  }

  // RC signals
  const today = new Date();
  const activeRCs       = rcs.filter(r => r.status === 'APPROVED' && new Date(r.valid_to) >= today);
  const expiringSoonRCs = activeRCs.filter(r => {
    const days = Math.ceil((new Date(r.valid_to).getTime() - today.getTime()) / 86400000);
    return days <= 14;
  });
  const pendingRCs = rcs.filter(r => r.status === 'PENDING');
  const ordersWithRC = orders.filter(o => getOrderPricingMode(o) === 'RC').length;
  const activeManualOrders = orders.filter(
    o => getOrderPricingMode(o) === 'MANUAL' && ['final_approval_pending', 'final_approved'].includes(o.stage)
  ).length;
  const rcPct = orders.length > 0 ? Math.round((ordersWithRC / orders.length) * 100) : 0;

  // Pipeline segments
  const pendingERP    = orders.filter(o => ['pending_erp_entry', 'manager_approved'].includes(o.stage));
  const erpEntered    = orders.filter(o => o.stage === 'erp_entered');
  const divisionQ     = orders.filter(o => ['division_processing', 'division_partially_approved', 'division_partially_rejected'].includes(o.stage));
  const finalQ        = orders.filter(o => o.stage === 'final_approval_pending');
  const supplyChain   = orders.filter(o => ['final_approved', 'sent_to_supply_chain', 'sent_to_stockist', 'fulfillment_pending'].includes(o.stage));
  const completed     = orders.filter(o => o.stage === 'completed');
  const rejected      = orders.filter(o => ['final_rejected', 'erp_sync_failed'].includes(o.stage));
  const slaBreached   = orders.filter(o => o.sla_breached);

  const totalActive  = orders.filter(o => o.stage !== 'completed').length;
  const pipelineValue = orders.filter(o => o.stage !== 'completed' && o.stage !== 'final_rejected').reduce((s, o) => s + o.total_value, 0);
  const needsAction   = pendingERP.length + divisionQ.length + finalQ.length;
  const recentOrders  = orders.slice(0, 8);

  // Pipeline bar data
  const pipelineStages = [
    { label: 'ERP Entry',      count: pendingERP.length,  color: '#FD4B1B',  key: 'pending_erp_entry' },
    { label: 'ERP Done',       count: erpEntered.length,  color: '#0278FC',  key: 'erp_entered' },
    { label: 'Division',       count: divisionQ.length,   color: '#6366F1',  key: 'division_processing' },
    { label: 'Final Approval', count: finalQ.length,      color: '#F59E0B',  key: 'final_approval_pending' },
    { label: 'Supply Chain',   count: supplyChain.length, color: '#10B981',  key: 'sent_to_supply_chain' },
    { label: 'Completed',      count: completed.length,   color: '#059669',  key: 'completed' },
  ];
  const pipelineTotal = pipelineStages.reduce((s, p) => s + p.count, 0) || 1;

  const alerts = [
    ...slaBreached.map(o => ({
      id: o.id, type: 'danger' as const,
      message: `${o.order_id} — SLA breached, ERP entry pending`,
      orderId: o.id,
    })),
    ...orders.filter(o => o.erp_status === 'sync_failed').map(o => ({
      id: o.id + '-erp', type: 'danger' as const,
      message: `${o.order_id} — ERP sync failed, manual entry needed`,
      orderId: o.id,
    })),
    ...divisionQ.filter(o => Date.now() - new Date(o.updated_at).getTime() > 86400000).map(o => ({
      id: o.id + '-div', type: 'warning' as const,
      message: `${o.order_id} — stuck in division review for 24h+`,
      orderId: o.id,
    })),
  ].slice(0, 5) as { id: string; type: 'danger' | 'warning'; message: string; orderId: string }[];

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-ink-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-400 mt-0.5">{orders.length} orders in pipeline</p>
        </div>
        <button
          onClick={loadOrders}
          className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800 bg-white border border-slate-200 shadow-card px-3 py-1.5 rounded-lg transition-all"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Critical banner (only if issues exist) ── */}
      {(slaBreached.length > 0 || rejected.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle size={14} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              {slaBreached.length > 0 && `${slaBreached.length} SLA breach${slaBreached.length > 1 ? 'es'  : ''}`}
              {slaBreached.length > 0 && rejected.length > 0 && ' · '}
              {rejected.length > 0 && `${rejected.length} rejected order${rejected.length > 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-red-600 mt-0.5">Requires immediate attention</p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="text-xs text-red-700 font-semibold hover:text-red-900 flex items-center gap-1 shrink-0"
          >
            Review <ArrowRight size={11} />
          </button>
        </div>
      )}

      {/* ── Hero metrics (3 cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Pipeline value */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee size={14} className="text-ink-400" />
            <span className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Pipeline Value</span>
          </div>
          <p className="text-[32px] font-bold text-ink-900 leading-none tabular-nums">{formatINR(pipelineValue)}</p>
          <p className="text-xs text-ink-400 mt-2">{totalActive} active orders</p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-ink-400">Completed value</span>
            <span className="font-semibold text-ink-600 tabular-nums">
              {formatINR(completed.reduce((s, o) => s + o.total_value, 0))}
            </span>
          </div>
        </div>

        {/* Action required */}
        <div
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 cursor-pointer hover:shadow-card-hover transition-all duration-200 group"
          onClick={() => navigate('/orders')}
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-brand-orange" />
            <span className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Needs Action</span>
          </div>
          <p className={`text-[32px] font-bold leading-none tabular-nums ${needsAction > 0 ? 'text-brand-orange' : 'text-ink-900'}`}>
            {needsAction}
          </p>
          <p className="text-xs text-ink-400 mt-2">orders awaiting your team</p>
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-ink-400">Pending ERP entry</span>
              <span className="font-semibold text-ink-700 tabular-nums">{pendingERP.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink-400">Division review</span>
              <span className="font-semibold text-ink-700 tabular-nums">{divisionQ.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink-400">Final approval</span>
              <span className="font-semibold text-ink-700 tabular-nums">{finalQ.length}</span>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={14} className="text-ink-400" />
            <span className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Status</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-sm text-ink-600">Completed</span>
              </div>
              <span className="text-sm font-bold text-ink-900 tabular-nums">{completed.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle size={14} className="text-red-400" />
                <span className="text-sm text-ink-600">Rejected</span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${rejected.length > 0 ? 'text-red-500' : 'text-ink-900'}`}>
                {rejected.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-red-400" />
                <span className="text-sm text-ink-600">SLA Breached</span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${slaBreached.length > 0 ? 'text-red-500' : 'text-ink-900'}`}>
                {slaBreached.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-emerald-500" />
                <span className="text-sm text-ink-600">At Stockist</span>
              </div>
              <span className="text-sm font-bold text-ink-900 tabular-nums">{supplyChain.length}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Work queues (3 action cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div
          onClick={() => navigate('/cfa-queue')}
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 cursor-pointer hover:shadow-card-hover hover:border-slate-200 transition-all duration-200 group"
        >
          <div className="flex items-start justify-between">
            <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
              <Truck size={17} className="text-brand-orange" />
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${pendingERP.length > 0 ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
              {pendingERP.length > 0 ? `${pendingERP.length} pending` : 'Clear'}
            </span>
          </div>
          <p className="text-2xl font-bold text-ink-900 mt-3 tabular-nums">{pendingERP.length}</p>
          <p className="text-sm text-ink-500 mt-0.5">ERP Entry Queue</p>
          <p className="text-xs text-ink-400 mt-1">Orders awaiting CFA / ERP entry</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-orange group-hover:gap-2 transition-all">
            Go to CFA Queue <ArrowRight size={11} />
          </div>
        </div>

        <div
          onClick={() => navigate('/division')}
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 cursor-pointer hover:shadow-card-hover hover:border-slate-200 transition-all duration-200 group"
        >
          <div className="flex items-start justify-between">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <GitBranch size={17} className="text-brand-blue" />
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${divisionQ.length > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
              {divisionQ.length > 0 ? `${divisionQ.length} pending` : 'Clear'}
            </span>
          </div>
          <p className="text-2xl font-bold text-ink-900 mt-3 tabular-nums">{divisionQ.length}</p>
          <p className="text-sm text-ink-500 mt-0.5">Division Workspace</p>
          <p className="text-xs text-ink-400 mt-1">Orders in division-level review</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-blue group-hover:gap-2 transition-all">
            Go to Division <ArrowRight size={11} />
          </div>
        </div>

        <div
          onClick={() => navigate('/final-approval')}
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 cursor-pointer hover:shadow-card-hover hover:border-slate-200 transition-all duration-200 group"
        >
          <div className="flex items-start justify-between">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <CheckSquare size={17} className="text-amber-600" />
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${finalQ.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
              {finalQ.length > 0 ? `${finalQ.length} pending` : 'Clear'}
            </span>
          </div>
          <p className="text-2xl font-bold text-ink-900 mt-3 tabular-nums">{finalQ.length}</p>
          <p className="text-sm text-ink-500 mt-0.5">Final Approval</p>
          <p className="text-xs text-ink-400 mt-1">Orders awaiting final sign-off</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-amber-600 group-hover:gap-2 transition-all">
            Go to Approvals <ArrowRight size={11} />
          </div>
        </div>

      </div>

      {/* ── Pipeline flow bar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink-900">Pipeline Flow</h2>
          <span className="text-xs text-ink-400">{orders.length} total orders</span>
        </div>

        {/* Stacked bar */}
        <div className="flex h-2.5 rounded-full overflow-hidden gap-px bg-slate-100">
          {pipelineStages.filter(s => s.count > 0).map(seg => (
            <div
              key={seg.key}
              style={{ width: `${(seg.count / pipelineTotal) * 100}%`, backgroundColor: seg.color }}
              className="transition-all duration-500"
              title={`${seg.label}: ${seg.count}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
          {pipelineStages.map(seg => (
            <button
              key={seg.key}
              onClick={() => navigate(`/orders?stage=${seg.key}`)}
              className="text-left group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-[11px] text-ink-400 group-hover:text-ink-700 transition-colors truncate">{seg.label}</span>
              </div>
              <p className="text-lg font-bold text-ink-900 tabular-nums pl-3.5">{seg.count}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Rate Contract signals ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
              <ScrollText size={14} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Rate Contract Signals</h2>
              <p className="text-[11px] text-ink-400">{activeRCs.length} active contract{activeRCs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={() => navigate('/rate-contracts')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors">
            All RCs <ArrowRight size={11} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
            <p className="text-2xl font-bold text-indigo-700 tabular-nums">{rcPct}%</p>
            <p className="text-xs text-indigo-500 mt-1">Orders using RC pricing</p>
          </div>
          <div className={`p-3 rounded-xl border ${activeManualOrders > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-2xl font-bold tabular-nums ${activeManualOrders > 0 ? 'text-brand-orange' : 'text-ink-900'}`}>
              {activeManualOrders}
            </p>
            <p className="text-xs text-ink-400 mt-1">Active manual orders</p>
          </div>
          <div className={`p-3 rounded-xl border ${expiringSoonRCs.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-2xl font-bold tabular-nums ${expiringSoonRCs.length > 0 ? 'text-amber-600' : 'text-ink-900'}`}>{expiringSoonRCs.length}</p>
            <p className="text-xs text-ink-400 mt-1">RC expiring within 14 days</p>
          </div>
          <div className={`p-3 rounded-xl border ${pendingRCs.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-2xl font-bold tabular-nums ${pendingRCs.length > 0 ? 'text-brand-orange' : 'text-ink-900'}`}>{pendingRCs.length}</p>
            <p className="text-xs text-ink-400 mt-1">RC pending approval</p>
          </div>
        </div>
      </div>

      {/* ── Bottom: Recent orders + Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Recent Orders</h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-brand-orange hover:text-brand-orange-dark font-semibold flex items-center gap-1 transition-colors"
            >
              All orders <ArrowRight size={11} />
            </button>
          </div>
          <table className="w-full text-sm" style={{ minWidth: '480px' }}>
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Order</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Hospital</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Stage</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Value</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map(order => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-ink-800">{order.order_id}</span>
                      {order.sla_breached && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs text-ink-600 block max-w-[160px] truncate">{order.hospital?.name}</span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap text-xs font-semibold text-ink-900 tabular-nums">
                    {formatINR(order.total_value)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap text-xs text-ink-400 tabular-nums">
                    {timeAgo(order.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Alerts</h2>
            {alerts.length > 0 && (
              <span className="text-[11px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full tabular-nums">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle size={18} className="text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-ink-700">All clear</p>
                <p className="text-xs text-ink-400 mt-1">No active alerts or escalations</p>
              </div>
            ) : alerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => navigate(`/orders/${alert.orderId}`)}
                className="px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${alert.type === 'danger' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-ink-700 leading-relaxed">{alert.message}</p>
                    <p className={`text-[11px] font-semibold mt-0.5 ${alert.type === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
                      {alert.type === 'danger' ? 'Critical' : 'Warning'}
                    </p>
                  </div>
                  <ArrowRight size={12} className="text-ink-300 group-hover:text-ink-500 shrink-0 mt-0.5 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
