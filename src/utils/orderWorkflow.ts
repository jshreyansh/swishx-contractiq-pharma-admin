import { supabase } from '../lib/supabase';
import { OrderStage } from '../types';
import { getMutationError } from './supabaseWrites';

async function isRateContractOrder(orderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('rc_id, pricing_mode')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Order routing details could not be loaded.');
  }

  return Boolean(data?.rc_id) || data?.pricing_mode === 'RC';
}

export async function ensureDivisionApprovalsForOrder(orderId: string): Promise<string[]> {
  if (await isRateContractOrder(orderId)) {
    return [];
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('division_id')
    .eq('order_id', orderId);

  if (itemsError) {
    throw new Error(itemsError.message || 'Order items could not be loaded for division routing.');
  }

  const divisionIds = [...new Set(
    (orderItems || [])
      .map(item => item.division_id)
      .filter((divisionId): divisionId is string => Boolean(divisionId))
  )];

  if (!divisionIds.length) return [];

  const { data: existingApprovals, error: approvalsError } = await supabase
    .from('division_approvals')
    .select('division_id')
    .eq('order_id', orderId);

  if (approvalsError) {
    throw new Error(approvalsError.message || 'Division approvals could not be checked.');
  }

  const existingDivisionIds = new Set(
    (existingApprovals || [])
      .map(approval => approval.division_id)
      .filter((divisionId): divisionId is string => Boolean(divisionId))
  );

  const missingDivisionIds = divisionIds.filter(divisionId => !existingDivisionIds.has(divisionId));
  if (!missingDivisionIds.length) return divisionIds;

  const { data: divisionApprovers, error: approversError } = await supabase
    .from('app_users')
    .select('id, division_id')
    .eq('role', 'division_approver')
    .eq('status', 'active')
    .in('division_id', missingDivisionIds)
    .order('created_at');

  if (approversError) {
    throw new Error(approversError.message || 'Division approvers could not be loaded.');
  }

  const defaultApproverByDivision = new Map<string, string>();
  for (const approver of divisionApprovers || []) {
    if (approver.division_id && !defaultApproverByDivision.has(approver.division_id)) {
      defaultApproverByDivision.set(approver.division_id, approver.id);
    }
  }

  const insertApprovals = await supabase
    .from('division_approvals')
    .insert(
      missingDivisionIds.map(divisionId => ({
        order_id: orderId,
        division_id: divisionId,
        approver_user_id: defaultApproverByDivision.get(divisionId) || null,
        status: 'pending',
      }))
    )
    .select('id');

  const insertError = getMutationError(insertApprovals, 'Division approvals could not be created.');
  if (insertError) throw new Error(insertError);

  return divisionIds;
}

export async function ensureFinalApprovalsForOrder(orderId: string): Promise<void> {
  const [{ data: finalApprovers, error: finalApproversError }, { data: existingApprovals, error: existingApprovalsError }] = await Promise.all([
    supabase
      .from('app_users')
      .select('id, name')
      .eq('role', 'final_approver')
      .eq('status', 'active')
      .order('created_at'),
    supabase
      .from('final_approvals')
      .select('approver_user_id')
      .eq('order_id', orderId),
  ]);

  if (finalApproversError) {
    throw new Error(finalApproversError.message || 'Final approvers could not be loaded.');
  }

  if (existingApprovalsError) {
    throw new Error(existingApprovalsError.message || 'Existing final approvals could not be checked.');
  }

  const existingApproverIds = new Set(
    (existingApprovals || [])
      .map(approval => approval.approver_user_id)
      .filter((approverUserId): approverUserId is string => Boolean(approverUserId))
  );

  const missingApprovers = (finalApprovers || []).filter(approver => !existingApproverIds.has(approver.id));
  if (!missingApprovers.length) return;

  const sequenceByApproverId = new Map(
    (finalApprovers || []).map((approver, index) => [approver.id, index + 1])
  );

  const insertApprovals = await supabase
    .from('final_approvals')
    .insert(
      missingApprovers.map(approver => ({
        order_id: orderId,
        approver_user_id: approver.id,
        approver_name: approver.name,
        sequence_order: sequenceByApproverId.get(approver.id) || 1,
        status: 'pending',
      }))
    )
    .select('id');

  const insertError = getMutationError(insertApprovals, 'Final approvals could not be created.');
  if (insertError) throw new Error(insertError);
}

export function getStageFromDivisionApprovalStatuses(statuses: Array<'pending' | 'approved' | 'rejected'>): OrderStage {
  if (!statuses.length || statuses.every(status => status === 'pending')) return 'division_processing';
  if (statuses.every(status => status === 'approved')) return 'pending_erp_entry';
  if (statuses.some(status => status === 'rejected')) return 'division_partially_rejected';
  return 'division_partially_approved';
}

export async function syncOrderStageAfterDivisionDecision(orderId: string): Promise<OrderStage> {
  const { data: approvals, error: approvalsError } = await supabase
    .from('division_approvals')
    .select('status')
    .eq('order_id', orderId);

  if (approvalsError) {
    throw new Error(approvalsError.message || 'Division approvals could not be reloaded.');
  }

  const statuses = (approvals || []).map(approval => approval.status as 'pending' | 'approved' | 'rejected');
  const nextStage = getStageFromDivisionApprovalStatuses(statuses);

  const orderUpdate = await supabase
    .from('orders')
    .update({ stage: nextStage, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('id');

  const orderUpdateError = getMutationError(orderUpdate, 'Order stage could not be updated.');
  if (orderUpdateError) throw new Error(orderUpdateError);

  return nextStage;
}
