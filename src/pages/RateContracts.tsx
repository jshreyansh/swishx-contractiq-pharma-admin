import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowUpRight, PackageSearch, AlertTriangle, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RateContract, RateContractItem, RCStatus } from '../types';
import { loadLinkedOrdersForRateContracts } from '../utils/orderRateContracts';
import { formatINR, formatDate, rcStatusLabel, rcStatusColor, rcWorkflowStageLabel, rcWorkflowStageColor } from '../utils/formatters';
import { formatSupabaseError, isMissingRateContractsSchema, RATE_CONTRACTS_SCHEMA_WARNING } from '../utils/supabaseSchema';
import { getMutationError } from '../utils/supabaseWrites';
import { useApp } from '../context/AppContext';
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
  // workflow_stage and negotiation_round come from RateContract base type
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
  const { currentRole, currentUser, addToast } = useApp();
  const [rcs, setRCs] = useState<RCWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

      const [{ data: itemData, error: itemError }, linkedOrders] = await Promise.all([
        supabase.from('rate_contract_items').select('*, division:divisions(*)'),
        loadLinkedOrdersForRateContracts((rcResponse.data || []).map(rc => rc.id)),
      ]);

      if (itemError && isMissingRateContractsSchema(itemError)) {
        setRCs([]);
        setSchemaUnavailable(true);
        return;
      }

      if (itemError) {
        throw itemError;
      }

      if (linkedOrders.error) {
        if (isMissingRateContractsSchema(linkedOrders.error)) {
          setRCs([]);
          setSchemaUnavailable(true);
          return;
        }

        throw linkedOrders.error;
      }

      const enriched: RCWithStats[] = (rcResponse.data || []).map(rc => {
        const items = (itemData || []).filter(i => i.rc_id === rc.id) as RateContractItem[];
        const ordersCount = (linkedOrders.linkedOrdersByRcId.get(rc.id) || []).length;
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

  async function handleFieldRepResubmit(rc: RCWithStats) {
    if (actionLoading) return;
    setActionLoading(rc.id);
    try {
      const newRound = 2;
      const now = new Date().toISOString();

      const contractUpdate = await supabase.from('rate_contracts').update({
        workflow_stage: 'division_review',
        negotiation_round: newRound,
        updated_at: now,
      }).eq('id', rc.id).select('id');
      const contractError = getMutationError(contractUpdate, 'RC could not be updated for resubmission.');
      if (contractError) throw new Error(contractError);

      // Get all unique division IDs from RC items
      const { data: items } = await supabase.from('rate_contract_items').select('division_id').eq('rc_id', rc.id);
      const divisionIds = [...new Set((items || []).map(i => i.division_id).filter(Boolean))] as string[];

      // Fetch round-1 approvals to copy approver info into new round-2 rows
      const { data: round1 } = await supabase.from('rate_contract_approvals')
        .select('*').eq('rc_id', rc.id).eq('approval_stage', 'division').eq('negotiation_round', 1);

      // Insert fresh pending approval rows for round 2
      const round2Rows = divisionIds.map(divId => {
        const prev = round1?.find(a => a.division_id === divId);
        return {
          rc_id: rc.id,
          approval_stage: 'division',
          division_id: divId,
          approver_user_id: prev?.approver_user_id || null,
          approver_name: prev?.approver_name || '',
          sequence_order: prev?.sequence_order || 1,
          status: 'pending',
          negotiation_round: newRound,
        };
      });
      if (round2Rows.length > 0) {
        await supabase.from('rate_contract_approvals').insert(round2Rows);
      }

      // Capture item history snapshot for the resubmit
      const { data: allItems } = await supabase.from('rate_contract_items').select('id, negotiated_price, expected_qty').eq('rc_id', rc.id);
      const { data: lastHistory } = await supabase.from('rate_contract_item_history')
        .select('rc_item_id, price_after, qty_after')
        .eq('rc_id', rc.id)
        .eq('negotiation_round', 1)
        .order('created_at', { ascending: false });

      const lastByItem = new Map<string, { price_after: number; qty_after: number }>();
      for (const h of lastHistory || []) {
        if (!lastByItem.has(h.rc_item_id)) lastByItem.set(h.rc_item_id, h);
      }

      if (allItems && allItems.length > 0) {
        const historyRows = allItems.map(item => ({
          rc_item_id: item.id,
          rc_id: rc.id,
          negotiation_round: newRound,
          actor_name: 'Field Rep',
          actor_role: 'Field Rep',
          action_type: 'resubmitted',
          price_before: lastByItem.get(item.id)?.price_after ?? null,
          price_after: item.negotiated_price,
          qty_before: lastByItem.get(item.id)?.qty_after ?? null,
          qty_after: item.expected_qty,
        }));
        await supabase.from('rate_contract_item_history').insert(historyRows);
      }

      await supabase.from('rate_contract_timeline').insert({
        rc_id: rc.id, actor_name: currentUser?.name || 'Admin', actor_role: 'Admin',
        action: 'Field rep accepted negotiated terms and resubmitted. Round 2 division review started.',
        action_type: 'resubmitted',
      });

      addToast({ type: 'success', title: 'RC Resubmitted', message: `${rc.rc_code} is back in division review (Round 2).` });
      loadRCs();
    } catch (err) {
      addToast({ type: 'error', title: 'Resubmit Failed', message: err instanceof Error ? err.message : 'Could not resubmit RC.' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFieldRepDiscard(rc: RCWithStats) {
    if (actionLoading) return;
    setActionLoading(rc.id + '-discard');
    try {
      const contractUpdate = await supabase.from('rate_contracts').update({
        workflow_stage: 'discarded',
        status: 'REJECTED',
        updated_at: new Date().toISOString(),
      }).eq('id', rc.id).select('id');
      const contractError = getMutationError(contractUpdate, 'RC could not be discarded.');
      if (contractError) throw new Error(contractError);

      await supabase.from('rate_contract_timeline').insert({
        rc_id: rc.id, actor_name: currentUser?.name || 'Admin', actor_role: 'Admin',
        action: 'Field rep chose not to renegotiate. RC discarded.',
        action_type: 'discarded',
      });

      addToast({ type: 'warning', title: 'RC Discarded', message: `${rc.rc_code} has been discarded.` });
      loadRCs();
    } catch (err) {
      addToast({ type: 'error', title: 'Discard Failed', message: err instanceof Error ? err.message : 'Could not discard RC.' });
    } finally {
      setActionLoading(null);
    }
  }

  const sendBackRCs = rcs.filter(rc => rc.workflow_stage === 'sent_back_to_field_rep');

  const filtered = rcs.filter(rc => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      rc.rc_code.toLowerCase().includes(q) ||
      rc.hospital?.name.toLowerCase().includes(q) ||
      rc.field_rep?.name.toLowerCase().includes(q);
    const matchStatus = !statusFilter || rc.workflow_stage === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeFilters = (search ? 1 : 0) + (statusFilter ? 1 : 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rate Contracts"
        description={`${filtered.length} contract${filtered.length !== 1 ? 's' : ''} ${statusFilter ? `in stage "${rcWorkflowStageLabel(statusFilter as any)}"` : 'total'}`}
        badge={activeFilters > 0 ? (
          <span className="text-xs bg-primary-50 text-brand-orange font-semibold px-2 py-0.5 rounded-full">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
          </span>
        ) : undefined}
      />

      {/* ── Field Rep Response Panel (admin only, when RCs are waiting) ── */}
      {!schemaUnavailable && sendBackRCs.length > 0 && currentRole === 'admin' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <RefreshCw size={14} className="text-amber-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Waiting for Field Rep Response</h2>
              <p className="text-[11px] text-ink-400 mt-0.5">
                Division review complete — field rep must accept negotiated terms or drop the RC
              </p>
            </div>
            <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold tabular-nums">
              {sendBackRCs.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sendBackRCs.map(rc => (
              <div key={rc.id} className="bg-white rounded-xl border border-amber-100 p-4 shadow-card">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-ink-800">{rc.rc_code}</span>
                  <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                    Resubmit → Round 2 Final
                  </span>
                </div>
                <p className="text-sm font-semibold text-ink-900 truncate">{rc.hospital?.name}</p>
                <p className="text-xs text-ink-400 mt-0.5 mb-3">{rc.items.length} product(s) · {formatINR(rc.totalExpectedValue)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFieldRepDiscard(rc)}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                  >
                    <Trash2 size={11} /> Discard
                  </button>
                  <button
                    onClick={() => handleFieldRepResubmit(rc)}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50"
                  >
                    <RotateCcw size={11} className={actionLoading === rc.id ? 'animate-spin' : ''} />
                    Field Rep Resubmitted
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <option value="">All Stages</option>
            <option value="division_review">Division Review</option>
            <option value="resubmitted">Resubmitted (Round 2)</option>
            <option value="sent_back_to_field_rep">Back With Field Rep</option>
            <option value="final_approval_pending">Ready for Final Approval</option>
            <option value="approved">Approved</option>
            <option value="hospital_acceptance_pending">Awaiting Hospital Acceptance</option>
            <option value="final_rejected">Final Rejected</option>
            <option value="discarded">Discarded</option>
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
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Workflow Stage</th>
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
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={rcWorkflowStageColor(rc.workflow_stage)}>{rcWorkflowStageLabel(rc.workflow_stage)}</Badge>
                        {(rc.negotiation_round || 1) >= 2 && (
                          <span className="text-[10px] text-indigo-500 font-semibold">Round 2</span>
                        )}
                      </div>
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
