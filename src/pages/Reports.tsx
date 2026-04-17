import { useEffect, useState } from 'react';
import {
  TrendingUp, Activity, CheckCircle, XCircle,
  AlertTriangle, BarChart2, Users, Building2, ArrowRight, ScrollText,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, DivisionApproval, Division, RateContract, RateContractItem } from '../types';
import { formatINR, getOrderPricingMode, stageLabel, stageColor, rcUtilizationColor } from '../utils/formatters';
import Badge from '../components/ui/Badge';

function stageBarColor(stage: string): string {
  if (['final_approved', 'erp_sync_done', 'sent_to_supply_chain', 'sent_to_stockist', 'completed'].includes(stage))
    return 'bg-success-500';
  if (['final_rejected', 'erp_sync_failed', 'division_partially_rejected'].includes(stage))
    return 'bg-danger-500';
  if (['pending_erp_entry', 'pending_manager_approval', 'final_approval_pending'].includes(stage))
    return 'bg-warning-500';
  return 'bg-brand-blue';
}

const medalStyle = [
  'bg-brand-orange text-white',
  'bg-brand-blue text-white',
  'bg-ink-300 text-ink-700',
];

export default function Reports() {
  const [orders, setOrders]           = useState<Order[]>([]);
  const [divApprovals, setDivApprovals] = useState<DivisionApproval[]>([]);
  const [divisions, setDivisions]     = useState<Division[]>([]);
  const [rcs, setRCs]                 = useState<(RateContract & { items?: RateContractItem[] })[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: o }, { data: da }, { data: d }, { data: rcData }, { data: rcItems }] = await Promise.all([
      supabase.from('orders').select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*)').order('created_at', { ascending: false }),
      supabase.from('division_approvals').select('*, division:divisions(*)'),
      supabase.from('divisions').select('*'),
      supabase.from('rate_contracts').select('*, hospital:hospitals(*)').order('updated_at', { ascending: false }),
      supabase.from('rate_contract_items').select('*'),
    ]);
    if (o) setOrders(o as Order[]);
    if (da) setDivApprovals(da as DivisionApproval[]);
    if (d) setDivisions(d as Division[]);
    if (rcData) {
      const enriched = rcData.map(rc => ({
        ...rc as RateContract,
        items: (rcItems || []).filter(i => i.rc_id === rc.id) as RateContractItem[],
      }));
      setRCs(enriched);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-orange/30 border-t-brand-orange animate-spin" />
        <p className="text-sm text-ink-400">Loading reports…</p>
      </div>
    );
  }

  // ── Computed metrics ──
  const totalOrders     = orders.length;
  const completedOrders = orders.filter(o => ['completed', 'sent_to_stockist', 'sent_to_supply_chain', 'final_approved', 'erp_sync_done'].includes(o.stage)).length;
  const rejectedOrders  = orders.filter(o => o.stage === 'final_rejected').length;
  const slaBreached     = orders.filter(o => o.sla_breached).length;
  const totalValue      = orders.reduce((sum, o) => sum + o.total_value, 0);
  const avgValue        = totalOrders > 0 ? totalValue / totalOrders : 0;
  const completionRate  = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const rejectionRate   = totalOrders > 0 ? ((rejectedOrders / totalOrders) * 100).toFixed(1) : '0';
  const inProgressCount = orders.filter(o =>
    ['erp_entered', 'division_processing', 'division_partially_approved', 'division_partially_rejected', 'final_approval_pending'].includes(o.stage)
  ).length;

  // Pipeline funnel
  const funnelStages = [
    { label: 'Total Orders',     count: totalOrders,     color: 'bg-slate-300' },
    { label: 'ERP Processed',    count: orders.filter(o => !['created','hospital_confirmed','pending_manager_approval','manager_approved','pending_erp_entry'].includes(o.stage)).length, color: 'bg-brand-blue' },
    { label: 'Division Cleared', count: orders.filter(o => ['final_approval_pending','final_approved','erp_sync_done','final_rejected','sent_to_supply_chain','sent_to_stockist','completed'].includes(o.stage)).length, color: 'bg-brand-blue' },
    { label: 'Final Approved',   count: orders.filter(o => ['final_approved','erp_sync_done','sent_to_supply_chain','sent_to_stockist','completed'].includes(o.stage)).length, color: 'bg-success-500' },
    { label: 'Completed',        count: completedOrders, color: 'bg-success-600' },
  ].map(s => ({ ...s, pct: totalOrders > 0 ? Math.round((s.count / totalOrders) * 100) : 0 }));

  // Stage distribution
  const stageDistribution = [
    'pending_erp_entry','erp_entered','division_processing','division_partially_approved',
    'division_partially_rejected','final_approval_pending','final_approved',
    'final_rejected','erp_sync_done','sent_to_supply_chain','sent_to_stockist','completed',
  ].map(stage => ({ stage, count: orders.filter(o => o.stage === stage).length }))
    .filter(s => s.count > 0);
  const maxStageCount = Math.max(...stageDistribution.map(s => s.count), 1);

  // Division performance
  const divStats = divisions.map(div => {
    const divOrders = divApprovals.filter(da => da.division_id === div.id);
    const approved  = divOrders.filter(da => da.status === 'approved').length;
    const rejected  = divOrders.filter(da => da.status === 'rejected').length;
    const total     = divOrders.length;
    return { name: div.name, total, approved, rejected,
      approvalPct:  total > 0 ? Math.round((approved / total) * 100) : 0,
      rejectionPct: total > 0 ? Math.round((rejected / total) * 100) : 0,
    };
  }).filter(d => d.total > 0);

  // Leaderboards
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

  return (
    <div className="space-y-5 pb-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-ink-900 tracking-tight">Reports & Insights</h1>
          <p className="text-sm text-ink-400 mt-0.5">
            {totalOrders} total orders · {divisions.length} divisions · {orders.filter(o => o.stage === 'final_approval_pending').length} pending final approval
          </p>
        </div>
      </div>

      {/* ── SLA warning ── */}
      {slaBreached > 0 && (
        <div className="flex items-center gap-3 p-3.5 bg-danger-50 border border-danger-100 rounded-xl">
          <AlertTriangle size={16} className="text-danger-500 shrink-0" />
          <p className="text-sm text-danger-600 font-medium">
            <span className="font-bold">{slaBreached} order{slaBreached > 1 ? 's' : ''}</span> have breached SLA — immediate action required
          </p>
        </div>
      )}

      {/* ── Hero KPIs ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: 'Total GMV',
            value: formatINR(totalValue),
            sub: `avg ${formatINR(avgValue)} / order`,
            icon: TrendingUp,
            iconBg: 'bg-slate-100',
            iconColor: 'text-brand-blue',
            valueColor: 'text-brand-blue',
          },
          {
            label: 'In Pipeline',
            value: inProgressCount,
            sub: `${totalOrders} total orders`,
            icon: Activity,
            iconBg: 'bg-primary-50',
            iconColor: 'text-brand-orange',
            valueColor: 'text-brand-orange',
          },
          {
            label: 'Completion Rate',
            value: `${completionRate}%`,
            sub: `${completedOrders} orders finished`,
            icon: CheckCircle,
            iconBg: 'bg-success-50',
            iconColor: 'text-success-600',
            valueColor: 'text-success-600',
          },
          {
            label: 'Rejection Rate',
            value: `${rejectionRate}%`,
            sub: `${rejectedOrders} order${rejectedOrders !== 1 ? 's' : ''} rejected`,
            icon: XCircle,
            iconBg: rejectedOrders > 0 ? 'bg-danger-50' : 'bg-slate-100',
            iconColor: rejectedOrders > 0 ? 'text-danger-500' : 'text-ink-300',
            valueColor: rejectedOrders > 0 ? 'text-danger-500' : 'text-ink-300',
          },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{stat.label}</p>
              <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon size={15} className={stat.iconColor} />
              </div>
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums tracking-tight ${stat.valueColor}`}>{stat.value}</p>
              <p className="text-[11px] text-ink-400 mt-1">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pipeline funnel ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
            <ArrowRight size={14} className="text-ink-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink-900">Order Funnel</h2>
            <p className="text-[11px] text-ink-400">Conversion at each pipeline milestone</p>
          </div>
        </div>
        <div className="space-y-3">
          {funnelStages.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-4">
              <p className="text-xs font-medium text-ink-500 w-36 shrink-0 text-right">{stage.label}</p>
              <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${stage.color} rounded-lg transition-all duration-500 flex items-center px-3`}
                  style={{ width: `max(${stage.pct}%, 3%)` }}
                />
              </div>
              <div className="flex items-center gap-2 w-20 justify-end shrink-0">
                <span className="text-sm font-bold text-ink-900 tabular-nums">{stage.count}</span>
                <span className="text-[11px] text-ink-400 tabular-nums w-9">({stage.pct}%)</span>
              </div>
              {i < funnelStages.length - 1 && (
                <div className="absolute left-[calc(36px+theme(spacing.4)+theme(spacing.36))]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stage distribution + Division performance ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Stage distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <BarChart2 size={14} className="text-ink-500" />
            </div>
            <h2 className="text-sm font-bold text-ink-900">Orders by Stage</h2>
          </div>
          {stageDistribution.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-6">No data</p>
          ) : (
            <div className="space-y-2.5">
              {stageDistribution.map(s => (
                <div key={s.stage} className="flex items-center gap-3">
                  <p className="text-xs text-ink-600 w-40 truncate shrink-0">{stageLabel(s.stage as any)}</p>
                  <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className={`h-full ${stageBarColor(s.stage)} rounded-md transition-all duration-500`}
                      style={{ width: `max(${(s.count / maxStageCount) * 100}%, 4px)` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-ink-700 w-5 text-right tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Division performance */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <Activity size={14} className="text-ink-500" />
            </div>
            <h2 className="text-sm font-bold text-ink-900">Division Approval Rates</h2>
          </div>
          {divStats.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-6">No division data</p>
          ) : (
            <div className="space-y-4">
              {divStats.map(d => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-ink-800">{d.name}</p>
                    <div className="flex items-center gap-3 text-[11px] text-ink-400">
                      <span className="flex items-center gap-1 text-success-600 font-medium">
                        <CheckCircle size={10} /> {d.approved} ({d.approvalPct}%)
                      </span>
                      <span className="flex items-center gap-1 text-danger-500 font-medium">
                        <XCircle size={10} /> {d.rejected} ({d.rejectionPct}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-success-500 rounded-l-full transition-all" style={{ width: `${d.approvalPct}%` }} />
                    <div className="bg-danger-500 transition-all" style={{ width: `${d.rejectionPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Leaderboards ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Top field reps */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users size={14} className="text-ink-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-900">Top Field Reps</h2>
              <p className="text-[11px] text-ink-400">by order count</p>
            </div>
          </div>
          {repStats.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-6">No data</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {repStats.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3 py-2.5">
                  <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                    i < 3 ? medalStyle[i] : 'bg-slate-100 text-ink-400'
                  }`}>
                    {i + 1}
                  </div>
                  <p className="text-sm font-medium text-ink-800 flex-1 truncate">{name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-orange rounded-full" style={{ width: `${(count / repStats[0][1]) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-ink-700 tabular-nums w-5 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top hospitals */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <Building2 size={14} className="text-ink-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-900">Top Hospitals</h2>
              <p className="text-[11px] text-ink-400">by order volume</p>
            </div>
          </div>
          {hospitalStats.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-6">No data</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {hospitalStats.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3 py-2.5">
                  <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                    i < 3 ? medalStyle[i] : 'bg-slate-100 text-ink-400'
                  }`}>
                    {i + 1}
                  </div>
                  <p className="text-sm font-medium text-ink-800 flex-1 truncate">{name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-blue rounded-full" style={{ width: `${(count / hospitalStats[0][1]) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-ink-700 tabular-nums w-5 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Rate Contract analytics ── */}
      {rcs.length > 0 && (() => {
        const today = new Date();
        const approvedRCs = rcs.filter(r => r.status === 'APPROVED');
        const rcOrdersValue = orders.filter(o => getOrderPricingMode(o) === 'RC').reduce((s, o) => s + o.total_value, 0);
        const rcOrdersCount = orders.filter(o => getOrderPricingMode(o) === 'RC').length;
        const rcConversionPct = orders.length > 0 ? Math.round((rcOrdersCount / orders.length) * 100) : 0;
        const hospitalsWithOrders = new Set(orders.map(o => o.hospital_id));
        const hospitalsWithRC = new Set(rcs.filter(r => r.status === 'APPROVED').map(r => r.hospital_id));
        const coveredHospitals = [...hospitalsWithOrders].filter(h => hospitalsWithRC.has(h)).length;
        const hospitalCoveragePct = hospitalsWithOrders.size > 0 ? Math.round((coveredHospitals / hospitalsWithOrders.size) * 100) : 0;

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                <ScrollText size={14} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink-900">Rate Contract Analytics</h2>
                <p className="text-[11px] text-ink-400">{rcs.length} contracts · {approvedRCs.length} active</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-2xl font-bold text-indigo-700 tabular-nums">{rcConversionPct}%</p>
                <p className="text-xs text-indigo-500 mt-1">Orders using RC pricing</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{rcOrdersCount} of {orders.length} orders</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-2xl font-bold text-brand-blue tabular-nums">{formatINR(rcOrdersValue)}</p>
                <p className="text-xs text-ink-500 mt-1">Revenue via RC</p>
                <p className="text-[11px] text-ink-400 mt-0.5">RC-linked order value</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-2xl font-bold text-ink-900 tabular-nums">{hospitalCoveragePct}%</p>
                <p className="text-xs text-ink-500 mt-1">Hospital RC coverage</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{coveredHospitals} of {hospitalsWithOrders.size} hospitals with orders</p>
              </div>
            </div>

            <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-3">Contract Utilization</p>
            <div className="space-y-3">
              {approvedRCs.map(rc => {
                const items = rc.items || [];
                const usedVal = items.reduce((s, i) => s + i.negotiated_price * i.used_qty, 0);
                const expVal  = items.reduce((s, i) => s + i.negotiated_price * i.expected_qty, 0);
                const pct = expVal > 0 ? Math.round((usedVal / expVal) * 100) : 0;
                const daysLeft = Math.ceil((new Date(rc.valid_to).getTime() - today.getTime()) / 86400000);
                return (
                  <div key={rc.id} className="flex items-center gap-4">
                    <div className="w-36 shrink-0">
                      <p className="text-xs font-semibold text-ink-800 truncate">{rc.rc_code}</p>
                      <p className="text-[11px] text-ink-400 truncate">{(rc as any).hospital?.name}</p>
                    </div>
                    <div className="flex-1 h-5 bg-slate-100 rounded-lg overflow-hidden">
                      <div className={`h-full ${rcUtilizationColor(pct)} rounded-lg flex items-center px-2 transition-all`}
                        style={{ width: `max(${pct}%, 4px)` }}>
                        {pct > 20 && <span className="text-[10px] text-white font-bold">{pct}%</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-40 shrink-0 justify-end text-right">
                      <span className="text-xs font-bold text-ink-700 tabular-nums">{formatINR(usedVal)} / {formatINR(expVal)}</span>
                      <span className={`text-[11px] font-medium ${daysLeft <= 7 ? 'text-red-500' : daysLeft <= 14 ? 'text-amber-500' : 'text-ink-400'}`}>
                        {daysLeft >= 0 ? `${daysLeft}d` : 'Exp'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {approvedRCs.length === 0 && <p className="text-sm text-ink-300 text-center py-4">No active contracts</p>}
            </div>
          </div>
        );
      })()}

      {/* ── Orders table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink-900">All Orders</h2>
            <p className="text-[11px] text-ink-400 mt-0.5">Most recent {Math.min(orders.length, 15)}</p>
          </div>
          <span className="text-xs text-ink-300 tabular-nums">{orders.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Order ID</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Hospital</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Field Rep</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Value</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 15).map(o => (
                <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-bold text-ink-700 whitespace-nowrap">{o.order_id}</td>
                  <td className="px-5 py-3 text-sm text-ink-800 font-medium max-w-[180px]">
                    <span className="block truncate">{(o as any).hospital?.name}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-500 whitespace-nowrap">{(o as any).field_rep?.name}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-ink-900 tabular-nums whitespace-nowrap">{formatINR(o.total_value)}</td>
                  <td className="px-5 py-3">
                    <Badge className={stageColor(o.stage)}>{stageLabel(o.stage)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
