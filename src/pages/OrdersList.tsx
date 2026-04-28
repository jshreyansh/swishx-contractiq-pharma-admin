import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, X, ArrowUpRight, AlertTriangle, PackageSearch } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, OrderStage } from '../types';
import { formatINR, formatDateTime, getOrderPricingMode, orderPricingColor, orderPricingLabel, stageLabel, stageColor, erpStatusLabel, erpStatusColor } from '../utils/formatters';
import { enrichOrdersWithLinkedRateContracts, hasRateContractSchemaError } from '../utils/orderRateContracts';
import { formatSupabaseError, RATE_CONTRACTS_SCHEMA_WARNING } from '../utils/supabaseSchema';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/SkeletonLoader';

const STAGES: OrderStage[] = [
  'created', 'hospital_confirmed',
  'pending_erp_entry', 'division_processing',
  'division_partially_approved', 'division_partially_rejected',
  'final_approval_pending', 'final_approved', 'final_rejected', 'completed'
];

export default function OrdersList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rcSchemaUnavailable, setRcSchemaUnavailable] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setRcSchemaUnavailable(false);

    try {
      const orderResponse = await supabase
        .from('orders')
        .select('*, hospital:hospitals(*), field_rep:field_reps(*), stockist:stockists(*), cfa_user:app_users!orders_cfa_user_id_fkey(*)')
        .order('updated_at', { ascending: false });

      if (orderResponse.error) {
        throw orderResponse.error;
      }

      const orderData = (orderResponse.data || []) as Order[];
      const linkedRateContracts = await enrichOrdersWithLinkedRateContracts(orderData);

      if (linkedRateContracts.error) {
        if (hasRateContractSchemaError(linkedRateContracts.error)) {
          setOrders(orderData);
          setRcSchemaUnavailable(true);
          return;
        }

        throw linkedRateContracts.error;
      }

      setOrders(linkedRateContracts.orders);
      setRcSchemaUnavailable(false);
    } catch (error) {
      setOrders([]);
      setLoadError(formatSupabaseError(error as { message?: string | null }, 'Orders could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.order_id.toLowerCase().includes(q) ||
      o.hospital?.name.toLowerCase().includes(q) ||
      o.field_rep?.name.toLowerCase().includes(q) ||
      o.stockist?.name.toLowerCase().includes(q) ||
      o.cfa_user?.name.toLowerCase().includes(q) ||
      o.linked_rate_contracts?.some(rc => rc.rc_code.toLowerCase().includes(q));
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

      {rcSchemaUnavailable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Rate contract addendum is not applied in this database</p>
            <p className="text-xs text-amber-700 mt-1">{RATE_CONTRACTS_SCHEMA_WARNING} Orders are still visible, but RC-linked context is unavailable for now.</p>
          </div>
        </div>
      )}

      <Card>
        {/* Search & filter bar */}
        <div className="p-3 border-b border-slate-100 flex gap-2.5 items-center">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Hospital, Rep, Stockist…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 transition-all bg-white text-ink-900 placeholder:text-ink-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-all whitespace-nowrap ${
              showFilters || stageFilter
                ? 'bg-primary-50 border-primary-200 text-brand-orange'
                : 'border-slate-200 text-ink-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={13} />
            Filter
            {stageFilter && <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />}
          </button>
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(''); setStageFilter(''); setSearchParams({}); }}
              className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="px-4 py-3 border-b border-slate-100 flex gap-4 flex-wrap bg-slate-50/50">
            <div>
              <label htmlFor="stage-filter" className="text-[11px] font-semibold text-ink-500 block mb-1 uppercase tracking-wide">
                Stage
              </label>
              <select
                id="stage-filter"
                value={stageFilter}
                onChange={e => { setStageFilter(e.target.value); setSearchParams(e.target.value ? { stage: e.target.value } : {}); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 bg-white text-ink-900 transition-colors"
              >
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto">
            <SkeletonTable rows={8} cols={8} />
          </div>
        ) : loadError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Orders could not be loaded"
            description={loadError}
            action={(
              <button
                onClick={loadOrders}
                className="text-sm text-brand-orange font-medium underline underline-offset-2"
              >
                Retry
              </button>
            )}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No orders found"
            description={activeFilters > 0 ? 'Try adjusting your search or filter' : 'No orders have been created yet'}
            action={activeFilters > 0 ? (
              <button
                onClick={() => { setSearch(''); setStageFilter(''); setSearchParams({}); }}
                className="text-sm text-brand-orange font-medium underline underline-offset-2"
              >
                Clear filters
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '860px' }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Order ID</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Hospital</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Field Rep</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Stockist</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Processing Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Order Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Rate Contract</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Value</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Updated</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(order => {
                  const pricingMode = getOrderPricingMode(order);
                  const linkedRateContracts = order.linked_rate_contracts || [];

                  return (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="hover:bg-slate-50 cursor-pointer group"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-ink-900">{order.order_id}</span>
                        {order.sla_breached && (
                          <span title="SLA Breached" className="inline-flex items-center">
                            <AlertTriangle size={11} className="text-danger-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-800 font-medium text-xs" title={order.hospital?.name}>
                        {order.hospital?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{order.field_rep?.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-ink-500 block max-w-[130px] truncate" title={order.stockist?.name}>
                        {order.stockist?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={stageColor(order.stage)}>{stageLabel(order.stage)}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={erpStatusColor(order.erp_status)}>{erpStatusLabel(order.erp_status)}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={orderPricingColor(pricingMode)}>{orderPricingLabel(pricingMode)}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {rcSchemaUnavailable ? (
                        <span className="text-xs text-amber-600">Unavailable</span>
                      ) : linkedRateContracts.length > 0 ? (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {linkedRateContracts.slice(0, 2).map(rateContract => (
                            <span
                              key={rateContract.id}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700"
                            >
                              {rateContract.rc_code}
                            </span>
                          ))}
                          {linkedRateContracts.length > 2 && (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              +{linkedRateContracts.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-semibold text-ink-900 tabular-nums">{formatINR(order.total_value)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-ink-400 tabular-nums">{formatDateTime(order.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <ArrowUpRight size={13} className="text-ink-300 group-hover:text-brand-orange transition-colors" />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
