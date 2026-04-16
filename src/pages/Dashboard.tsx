import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Clock, CheckCircle, XCircle, Truck, GitBranch,
  CheckSquare, TrendingUp, Bell, ArrowRight, RefreshCw, TrendingDown,
  PackageSearch
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order } from '../types';
import { formatINR, stageLabel, stageColor, timeAgo } from '../utils/formatters';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard, SkeletonTable } from '../components/ui/SkeletonLoader';

interface KPI {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  trend: 'up' | 'down' | 'neutral';
  stage?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*)')
      .order('updated_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  const pendingERP = orders.filter(o => ['pending_erp_entry', 'manager_approved'].includes(o.stage));
  const divisionPending = orders.filter(o => ['division_processing', 'division_partially_approved', 'division_partially_rejected'].includes(o.stage));
  const finalPending = orders.filter(o => o.stage === 'final_approval_pending');
  const completedToday = orders.filter(o => {
    const d = new Date(o.updated_at);
    const today = new Date();
    return (o.stage === 'completed' || o.stage === 'sent_to_stockist') &&
      d.toDateString() === today.toDateString();
  });
  const rejected = orders.filter(o => o.stage === 'final_rejected');
  const slaBreached = orders.filter(o => o.sla_breached);
  const recentOrders = orders.slice(0, 8);

  const kpis: KPI[] = [
    { label: 'Pending ERP Entry', value: pendingERP.length, icon: Truck, color: 'text-warning-600', bg: 'bg-warning-50', border: 'border-t-warning-500', trend: 'neutral', stage: 'pending_erp_entry' },
    { label: 'Division Pending', value: divisionPending.length, icon: GitBranch, color: 'text-brand-blue', bg: 'bg-blue-50', border: 'border-t-brand-blue', trend: 'neutral', stage: 'division_processing' },
    { label: 'Final Approval Pending', value: finalPending.length, icon: CheckSquare, color: 'text-brand-blue', bg: 'bg-blue-50', border: 'border-t-brand-blue', trend: 'neutral', stage: 'final_approval_pending' },
    { label: 'Completed Today', value: completedToday.length, icon: CheckCircle, color: 'text-success-600', bg: 'bg-success-50', border: 'border-t-success-500', trend: 'up' },
    { label: 'Rejected Orders', value: rejected.length, icon: XCircle, color: 'text-danger-600', bg: 'bg-danger-50', border: 'border-t-danger-500', trend: 'down', stage: 'final_rejected' },
    { label: 'SLA Breached', value: slaBreached.length, icon: AlertTriangle, color: 'text-brand-orange', bg: 'bg-primary-50', border: 'border-t-brand-orange', trend: 'down' },
  ];

  const alerts = [
    ...slaBreached.map(o => ({
      id: o.id,
      type: 'danger' as const,
      message: `Order ${o.order_id} — ERP entry pending and SLA breached`,
      orderId: o.id,
    })),
    ...orders.filter(o => o.erp_status === 'sync_failed').map(o => ({
      id: o.id + '-erp',
      type: 'danger' as const,
      message: `Order ${o.order_id} — ERP sync failed. Manual intervention required`,
      orderId: o.id,
    })),
    ...divisionPending.filter(o => {
      const updated = new Date(o.updated_at);
      return Date.now() - updated.getTime() > 24 * 60 * 60 * 1000;
    }).map(o => ({
      id: o.id + '-div',
      type: 'warning' as const,
      message: `Order ${o.order_id} stuck in division approval for over 24 hours`,
      orderId: o.id,
    })),
    finalPending.length > 0 ? {
      id: 'final-pending',
      type: 'info' as const,
      message: `${finalPending.length} order${finalPending.length > 1 ? 's' : ''} awaiting final approval`,
      orderId: null,
    } : null,
  ].filter(Boolean) as { id: string; type: 'danger' | 'warning' | 'info'; message: string; orderId: string | null }[];

  const alertStyles = {
    danger: 'bg-red-50 border-l-4 border-red-400 text-red-700 hover:bg-red-100',
    warning: 'bg-amber-50 border-l-4 border-amber-400 text-amber-700 hover:bg-amber-100',
    info: 'bg-sky-50 border-l-4 border-sky-400 text-sky-700 hover:bg-sky-100',
  };

  const alertIcons = {
    danger: AlertTriangle,
    warning: AlertTriangle,
    info: Bell,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control Dashboard"
        description={`Live pipeline view — ${orders.length} total orders`}
        actions={
          <button
            onClick={loadOrders}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map(kpi => (
            <Card
              key={kpi.label}
              onClick={() => kpi.stage && navigate(`/orders?stage=${kpi.stage}`)}
              className={`p-4 border-t-2 ${kpi.border}`}
            >
              <div className={`w-9 h-9 ${kpi.bg} rounded-lg flex items-center justify-center mb-3`}>
                <kpi.icon size={18} className={kpi.color} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-1 leading-snug">{kpi.label}</p>
              {kpi.stage && kpi.value > 0 && (
                <p className="text-xs text-brand-orange mt-2 flex items-center gap-0.5 font-medium">
                  View all <ArrowRight size={10} />
                </p>
              )}
              {kpi.trend !== 'neutral' && (
                <div className={`mt-1 flex items-center gap-1 ${kpi.trend === 'up' ? 'text-emerald-500' : 'text-red-400'}`}>
                  {kpi.trend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                </div>
              )}
            </Card>
          ))
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="h-full">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Bell size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Alerts & Escalations</h2>
              {alerts.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm font-medium text-slate-600">No active alerts</p>
                  <p className="text-xs text-slate-400 mt-0.5">All systems running smoothly</p>
                </div>
              ) : alerts.map(alert => {
                const AlertIcon = alertIcons[alert.type];
                return (
                  <div
                    key={alert.id}
                    onClick={() => alert.orderId && navigate(`/orders/${alert.orderId}`)}
                    className={`p-3 rounded-lg text-xs cursor-pointer transition-colors ${alertStyles[alert.type]}`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertIcon size={12} className="mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{alert.message}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
              </div>
              <button
                onClick={() => navigate('/orders')}
                className="text-xs text-brand-orange hover:text-brand-orange-dark flex items-center gap-0.5 font-medium transition-colors"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            {loading ? (
              <div className="overflow-x-auto">
                <SkeletonTable rows={5} cols={5} />
              </div>
            ) : recentOrders.length === 0 ? (
              <EmptyState icon={PackageSearch} title="No orders yet" description="Orders will appear here once created" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Order ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Stage</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Value</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentOrders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="hover:bg-app-bg cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-700">{order.order_id}</span>
                            {order.sla_breached && (
                              <span className="text-xs text-red-500 font-semibold bg-red-50 px-1.5 py-0.5 rounded">SLA!</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{order.hospital?.name}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatINR(order.total_value)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-400 text-xs">{timeAgo(order.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock size={14} className="text-slate-500" /> Pipeline Stage Distribution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {([
            'pending_erp_entry', 'erp_entered', 'division_processing',
            'final_approval_pending', 'final_approved', 'sent_to_supply_chain',
            'sent_to_stockist', 'completed'
          ] as const).map(stage => {
            const count = orders.filter(o => o.stage === stage).length;
            const isActive = count > 0;
            return (
              <button
                key={stage}
                onClick={() => navigate(`/orders?stage=${stage}`)}
                className={`text-center p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-primary-50 border-primary-200 hover:bg-primary-100'
                    : 'bg-app-bg border-app-surface-dark hover:bg-app-surface-dark'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/30`}
              >
                <p className={`text-xl font-bold ${isActive ? 'text-brand-orange' : 'text-ink-500'}`}>{count}</p>
                <p className="text-xs text-slate-500 mt-1 leading-tight">{stageLabel(stage)}</p>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
