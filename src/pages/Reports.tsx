import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, DivisionApproval, Division } from '../types';
import { formatINR, stageLabel } from '../utils/formatters';
import Card from '../components/ui/Card';

interface Stat {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export default function Reports() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [divApprovals, setDivApprovals] = useState<DivisionApproval[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: o }, { data: da }, { data: d }] = await Promise.all([
      supabase.from('orders').select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*)').order('created_at', { ascending: false }),
      supabase.from('division_approvals').select('*, division:divisions(*)'),
      supabase.from('divisions').select('*'),
    ]);
    if (o) setOrders(o as Order[]);
    if (da) setDivApprovals(da as DivisionApproval[]);
    if (d) setDivisions(d as Division[]);
    setLoading(false);
  }

  if (loading) return <div className="py-20 text-center text-ink-300">Loading reports...</div>;

  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => ['completed', 'sent_to_stockist', 'sent_to_supply_chain', 'final_approved'].includes(o.stage)).length;
  const rejectedOrders = orders.filter(o => o.stage === 'final_rejected').length;
  const slaBreached = orders.filter(o => o.sla_breached).length;
  const totalValue = orders.reduce((sum, o) => sum + o.total_value, 0);
  const avgValue = totalOrders > 0 ? totalValue / totalOrders : 0;
  const rejectionRate = totalOrders > 0 ? ((rejectedOrders / totalOrders) * 100).toFixed(1) : '0';

  const stageDistribution = [
    'pending_erp_entry', 'erp_entered', 'division_processing', 'division_partially_approved',
    'division_partially_rejected', 'final_approval_pending', 'final_approved',
    'final_rejected', 'sent_to_supply_chain', 'sent_to_stockist', 'completed'
  ].map(stage => ({
    stage,
    count: orders.filter(o => o.stage === stage).length,
  })).filter(s => s.count > 0);

  const maxStageCount = Math.max(...stageDistribution.map(s => s.count), 1);

  const divStats = divisions.map(div => {
    const divOrders = divApprovals.filter(da => da.division_id === div.id);
    const approved = divOrders.filter(da => da.status === 'approved').length;
    const rejected = divOrders.filter(da => da.status === 'rejected').length;
    const total = divOrders.length;
    return {
      name: div.name,
      total,
      approved,
      rejected,
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(0) : '0',
      rejectionRate: total > 0 ? ((rejected / total) * 100).toFixed(0) : '0',
    };
  }).filter(d => d.total > 0);

  const repStats = Object.entries(
    orders.reduce((acc, o) => {
      const name = (o as any).field_rep?.name || 'Unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const hospitalStats = Object.entries(
    orders.reduce((acc, o) => {
      const name = (o as any).hospital?.name || 'Unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const summaryStats: Stat[] = [
    { label: 'Total Orders', value: totalOrders, color: 'text-brand-blue' },
    { label: 'Completed', value: completedOrders, color: 'text-success-600' },
    { label: 'Rejection Rate', value: `${rejectionRate}%`, color: 'text-danger-600' },
    { label: 'SLA Breached', value: slaBreached, color: 'text-brand-orange' },
    { label: 'Total Value', value: formatINR(totalValue), color: 'text-ink-900' },
    { label: 'Avg Order Value', value: formatINR(avgValue), color: 'text-ink-900' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Reports & Insights</h1>
        <p className="text-sm text-ink-500 mt-0.5">Operational analytics for order movement and approvals</p>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {summaryStats.map(stat => (
          <Card key={stat.label} className="p-4 text-center">
            <p className={`text-xl font-bold ${stat.color || 'text-ink-900'}`}>{stat.value}</p>
            <p className="text-xs text-ink-500 mt-1">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={14} className="text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">Orders by Stage</h2>
          </div>
          <div className="space-y-2">
            {stageDistribution.map(s => (
              <div key={s.stage} className="flex items-center gap-3">
                <p className="text-xs text-ink-700 w-44 truncate shrink-0">{stageLabel(s.stage as any)}</p>
                <div className="flex-1 h-5 bg-app-surface-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-blue rounded-full transition-all"
                    style={{ width: `${(s.count / maxStageCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-ink-700 w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">Division Approval Rates</h2>
          </div>
          {divStats.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-6">No division data available</p>
          ) : (
            <div className="space-y-3">
              {divStats.map(d => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-ink-700">{d.name}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-success-600 flex items-center gap-0.5"><CheckCircle size={10} /> {d.approved} ({d.approvalRate}%)</span>
                      <span className="text-danger-500 flex items-center gap-0.5"><XCircle size={10} /> {d.rejected} ({d.rejectionRate}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-app-surface-dark rounded-full overflow-hidden">
                    <div className="h-full flex">
                      <div className="bg-success-400 rounded-l-full" style={{ width: `${d.approvalRate}%` }} />
                      <div className="bg-danger-400" style={{ width: `${d.rejectionRate}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">Top Field Reps by Orders</h2>
          </div>
          <div className="space-y-2">
            {repStats.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-ink-300 w-4">{i + 1}</span>
                <p className="text-sm text-ink-700 flex-1">{name}</p>
                <div className="w-24 h-1.5 bg-app-surface-dark rounded-full overflow-hidden">
                  <div className="h-full bg-brand-orange rounded-full" style={{ width: `${(count / repStats[0][1]) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-ink-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-900">Top Hospitals by Orders</h2>
          </div>
          <div className="space-y-2">
            {hospitalStats.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-ink-300 w-4">{i + 1}</span>
                <p className="text-sm text-ink-700 flex-1">{name}</p>
                <div className="w-24 h-1.5 bg-app-surface-dark rounded-full overflow-hidden">
                  <div className="h-full bg-success-500 rounded-full" style={{ width: `${(count / hospitalStats[0][1]) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-ink-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-app-surface-dark flex items-center gap-2">
          <Clock size={14} className="text-ink-500" />
          <h2 className="text-sm font-semibold text-ink-900">All Orders Summary</h2>
          <span className="ml-auto text-xs text-ink-300">{orders.length} orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-bg border-b border-app-surface-dark">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-500">Order ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-500">Hospital</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-500">Rep</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-ink-500">Value</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-500">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-surface-dark">
              {orders.slice(0, 10).map(o => (
                <tr key={o.id} className="hover:bg-app-bg">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-ink-700">{o.order_id}</td>
                  <td className="px-4 py-2.5 text-ink-700">{(o as any).hospital?.name}</td>
                  <td className="px-4 py-2.5 text-ink-500">{(o as any).field_rep?.name}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-ink-900">{formatINR(o.total_value)}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-500">{stageLabel(o.stage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
