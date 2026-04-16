import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, X, ArrowUpRight, AlertTriangle, PackageSearch } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, OrderStage } from '../types';
import { formatINR, formatDateTime, stageLabel, stageColor, erpStatusLabel, erpStatusColor } from '../utils/formatters';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/SkeletonLoader';

const STAGES: OrderStage[] = [
  'created', 'hospital_confirmed', 'pending_manager_approval', 'manager_approved',
  'pending_erp_entry', 'erp_entered', 'division_processing',
  'division_partially_approved', 'division_partially_rejected',
  'final_approval_pending', 'final_approved', 'final_rejected',
  'sent_to_supply_chain', 'sent_to_stockist', 'fulfillment_pending', 'completed'
];

export default function OrdersList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || '');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*), cfa_user:app_users!orders_cfa_user_id_fkey(*)')
      .order('updated_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.order_id.toLowerCase().includes(q) ||
      o.hospital?.name.toLowerCase().includes(q) ||
      o.field_rep?.name.toLowerCase().includes(q) ||
      o.stockist?.name.toLowerCase().includes(q) ||
      o.cfa_user?.name.toLowerCase().includes(q);
    const matchStage = !stageFilter || o.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const activeFilters = (search ? 1 : 0) + (stageFilter ? 1 : 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description={`${filtered.length} order${filtered.length !== 1 ? 's' : ''} ${stageFilter ? `in "${stageLabel(stageFilter as OrderStage)}"` : 'total'}`}
        badge={activeFilters > 0 ? (
          <span className="text-xs bg-primary-50 text-brand-orange font-semibold px-2 py-0.5 rounded-full">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
          </span>
        ) : undefined}
      />

      <Card className="p-4">
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              placeholder="Search by Order ID, Hospital, Rep, Stockist, CFA..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-app-surface-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/40 transition-colors bg-white text-ink-900 placeholder:text-ink-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/30 ${
              showFilters || stageFilter
                ? 'bg-primary-50 border-primary-300 text-brand-orange'
                : 'border-app-surface-dark text-ink-700 hover:bg-app-bg'
            }`}
          >
            <Filter size={14} />
            Filters
            {stageFilter && <span className="ml-0.5 w-2 h-2 bg-brand-orange rounded-full" />}
          </button>
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(''); setStageFilter(''); setSearchParams({}); }}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900 px-2 py-2 rounded-lg hover:bg-app-bg transition-colors"
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-app-surface-dark flex gap-4 flex-wrap">
            <div>
              <label htmlFor="stage-filter" className="text-xs font-medium text-ink-500 block mb-1.5">
                Stage
              </label>
              <select
                id="stage-filter"
                value={stageFilter}
                onChange={e => { setStageFilter(e.target.value); setSearchParams(e.target.value ? { stage: e.target.value } : {}); }}
                className="text-sm border border-app-surface-dark rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/40 bg-white text-ink-900 transition-colors"
              >
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
              </select>
            </div>
          </div>
        )}
      </Card>

      <Card>
        {loading ? (
          <div className="overflow-x-auto">
            <SkeletonTable rows={8} cols={9} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No orders found"
            description={activeFilters > 0 ? 'Try adjusting your search or filter criteria' : 'No orders have been created yet'}
            action={activeFilters > 0 ? (
              <button
                onClick={() => { setSearch(''); setStageFilter(''); setSearchParams({}); }}
                className="text-sm text-brand-orange hover:text-brand-orange-dark font-medium underline underline-offset-2"
              >
                Clear all filters
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-app-bg border-b border-app-surface-dark">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">Hospital</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">Rep</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">Stockist</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">ERP</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500 uppercase tracking-wide">Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-ink-500 uppercase tracking-wide">Updated</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-app-surface-dark">
                {filtered.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="hover:bg-app-bg cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink-900">{order.order_id}</span>
                        {order.sla_breached && (
                          <span title="SLA Breached">
                            <AlertTriangle size={12} className="text-danger-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-700 font-medium">{order.hospital?.name}</td>
                    <td className="px-4 py-3 text-ink-500">{order.field_rep?.name}</td>
                    <td className="px-4 py-3 text-ink-500 max-w-[140px] truncate">{order.stockist?.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={erpStatusColor(order.erp_status)}>{erpStatusLabel(order.erp_status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900">{formatINR(order.total_value)}</td>
                    <td className="px-4 py-3 text-right text-xs text-ink-300">{formatDateTime(order.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <ArrowUpRight size={14} className="text-ink-300 group-hover:text-ink-500 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
