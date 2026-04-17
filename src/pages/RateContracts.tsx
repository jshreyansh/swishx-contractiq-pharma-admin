import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowUpRight, PackageSearch, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RateContract, RateContractItem, RCStatus } from '../types';
import { formatINR, formatDate, rcStatusLabel, rcStatusColor } from '../utils/formatters';
import { formatSupabaseError, isMissingRateContractsSchema, RATE_CONTRACTS_SCHEMA_WARNING } from '../utils/supabaseSchema';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/SkeletonLoader';

interface RCWithStats extends RateContract {
  items: RateContractItem[];
  ordersCount: number;
  usedValue: number;
  totalExpectedValue: number;
  utilizationPct: number;
  effectiveStatus: RCStatus;
  daysLeft: number;
}

function effectiveStatus(rc: RateContract): RCStatus {
  if (rc.status === 'APPROVED' && new Date(rc.valid_to) < new Date()) return 'EXPIRED';
  return rc.status;
}

function daysLeft(rc: RateContract): number {
  return Math.ceil((new Date(rc.valid_to).getTime() - Date.now()) / 86400000);
}

function computeStats(rc: RateContract, items: RateContractItem[], ordersCount: number): RCWithStats {
  const usedValue    = items.reduce((s, i) => s + i.negotiated_price * i.used_qty, 0);
  const expectedVal  = items.reduce((s, i) => s + i.negotiated_price * i.expected_qty, 0);
  const utilPct      = expectedVal > 0 ? Math.round((usedValue / expectedVal) * 100) : 0;
  return {
    ...rc,
    items,
    ordersCount,
    usedValue,
    totalExpectedValue: expectedVal,
    utilizationPct: utilPct,
    effectiveStatus: effectiveStatus(rc),
    daysLeft: daysLeft(rc),
  };
}

export default function RateContracts() {
  const navigate = useNavigate();
  const [rcs, setRCs] = useState<RCWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  useEffect(() => { loadRCs(); }, []);

  const loadRCs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSchemaUnavailable(false);

    try {
      const rcResponse = await supabase
        .from('rate_contracts')
        .select('*, hospital:hospitals(*), field_rep:field_reps(*)')
        .order('updated_at', { ascending: false });

      if (rcResponse.error && isMissingRateContractsSchema(rcResponse.error)) {
        setRCs([]);
        setSchemaUnavailable(true);
        return;
      }

      if (rcResponse.error) {
        throw rcResponse.error;
      }

      const [{ data: itemData, error: itemError }, { data: orderData, error: orderError }] = await Promise.all([
        supabase.from('rate_contract_items').select('*, division:divisions(*)'),
        supabase.from('orders').select('id, rc_id, total_value').not('rc_id', 'is', null),
      ]);

      if ((itemError && isMissingRateContractsSchema(itemError)) || (orderError && isMissingRateContractsSchema(orderError))) {
        setRCs([]);
        setSchemaUnavailable(true);
        return;
      }

      if (itemError) {
        throw itemError;
      }

      if (orderError) {
        throw orderError;
      }

      const enriched: RCWithStats[] = (rcResponse.data || []).map(rc => {
        const items = (itemData || []).filter(i => i.rc_id === rc.id) as RateContractItem[];
        const ordersCount = (orderData || []).filter(o => o.rc_id === rc.id).length;
        return computeStats(rc as RateContract, items, ordersCount);
      });

      setRCs(enriched);
    } catch (error) {
      setRCs([]);
      setLoadError(formatSupabaseError(error as { message?: string | null }, 'Rate contracts could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = rcs.filter(rc => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      rc.rc_code.toLowerCase().includes(q) ||
      rc.hospital?.name.toLowerCase().includes(q) ||
      rc.field_rep?.name.toLowerCase().includes(q);
    const matchStatus = !statusFilter || rc.effectiveStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeFilters = (search ? 1 : 0) + (statusFilter ? 1 : 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rate Contracts"
        description={`${filtered.length} contract${filtered.length !== 1 ? 's' : ''} ${statusFilter ? `with status "${rcStatusLabel(statusFilter as RCStatus)}"` : 'total'}`}
        badge={activeFilters > 0 ? (
          <span className="text-xs bg-primary-50 text-brand-orange font-semibold px-2 py-0.5 rounded-full">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
          </span>
        ) : undefined}
      />

      {schemaUnavailable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Rate contract tables are missing in the connected database</p>
            <p className="text-xs text-amber-700 mt-1">{RATE_CONTRACTS_SCHEMA_WARNING}</p>
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
              placeholder="Search by RC Code, Hospital, Field Rep…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange/50 transition-all bg-white text-ink-900 placeholder:text-ink-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-colors"
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Active</option>
            <option value="PENDING">Pending Approval</option>
            <option value="DRAFT">Draft</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-700 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto">
            <SkeletonTable rows={8} cols={7} />
          </div>
        ) : loadError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Rate contracts could not be loaded"
            description={loadError}
            action={(
              <button
                onClick={loadRCs}
                className="text-sm text-brand-orange font-medium underline underline-offset-2"
              >
                Retry
              </button>
            )}
          />
        ) : schemaUnavailable ? (
          <EmptyState
            icon={AlertTriangle}
            title="Rate contract schema is not available"
            description="The connected Supabase project does not have the addendum tables and columns yet, so this page cannot read RC data."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No rate contracts found"
            description={activeFilters > 0 ? 'Try adjusting your search or filter' : 'No rate contracts have been created yet'}
            action={activeFilters > 0 ? (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); }}
                className="text-sm text-brand-orange font-medium underline underline-offset-2"
              >
                Clear filters
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '800px' }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">RC Code</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Hospital</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Field Rep</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Validity</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Value</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-400 uppercase tracking-wider whitespace-nowrap">Utilization</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(rc => (
                  <tr
                    key={rc.id}
                    onClick={() => navigate(`/rate-contracts/${rc.id}`)}
                    className="hover:bg-slate-50 cursor-pointer group"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-ink-900">{rc.rc_code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-800 font-medium text-xs" title={rc.hospital?.name}>
                        {rc.hospital?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{rc.field_rep?.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={rcStatusColor(rc.effectiveStatus)}>{rcStatusLabel(rc.effectiveStatus)}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">
                      {formatDate(rc.valid_from)} – {formatDate(rc.valid_to)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-semibold text-ink-900 tabular-nums">
                      {formatINR(rc.totalExpectedValue)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-semibold text-ink-700 tabular-nums">{rc.utilizationPct}%</span>
                        {rc.effectiveStatus === 'APPROVED' && rc.daysLeft >= 0 && (
                          <span className={`text-[10px] ${rc.daysLeft <= 7 ? 'text-red-500' : 'text-ink-400'}`}>
                            {rc.daysLeft}d left
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ArrowUpRight size={13} className="text-ink-300 group-hover:text-brand-orange transition-colors" />
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
