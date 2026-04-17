export type UserRole = 'admin' | 'cfa' | 'division_approver' | 'final_approver' | 'viewer';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  division_id: string | null;
  region: string;
  warehouse_code: string;
  status: 'active' | 'inactive';
  created_at: string;
  division?: Division;
}

export interface Division {
  id: string;
  name: string;
  code: string;
  approver_name: string;
  approver_email: string;
}

export interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
}

export interface Stockist {
  id: string;
  name: string;
  city: string;
  region: string;
  warehouse_code: string;
}

export interface FieldRep {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  region: string;
  manager_name: string;
}

export type OrderStage =
  | 'created'
  | 'hospital_confirmed'
  | 'pending_manager_approval'
  | 'manager_approved'
  | 'pending_erp_entry'
  | 'erp_entered'
  | 'erp_sync_failed'
  | 'division_processing'
  | 'division_partially_approved'
  | 'division_partially_rejected'
  | 'final_approval_pending'
  | 'final_approved'
  | 'final_rejected'
  | 'erp_sync_done'
  | 'sent_to_supply_chain'
  | 'sent_to_stockist'
  | 'fulfillment_pending'
  | 'completed';

export type ERPStatus = 'pending_sync' | 'synced' | 'manual_added' | 'sync_failed' | 'resync_required';
export type OrderPricingMode = 'RC' | 'MANUAL';

export interface Order {
  id: string;
  order_id: string;
  hospital_id: string;
  field_rep_id: string;
  stockist_id: string;
  cfa_user_id: string | null;
  stage: OrderStage;
  erp_status: ERPStatus;
  erp_order_id: string;
  erp_synced_at: string | null;
  total_value: number;
  sla_deadline: string | null;
  sla_breached: boolean;
  manager_name: string;
  manager_approved_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  rc_id: string | null;
  pricing_mode: OrderPricingMode | null;
  hospital?: Hospital;
  field_rep?: FieldRep;
  stockist?: Stockist;
  cfa_user?: AppUser;
  rc?: RateContract;
  order_items?: OrderItem[];
  division_approvals?: DivisionApproval[];
  final_approvals?: FinalApproval[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  division_id: string;
  quantity: number;
  unit_price: number;
  final_quantity: number | null;
  final_price: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  rejection_reason: string;
  notes: string;
  rc_item_id: string | null;
  pricing_source: 'RC' | 'MANUAL' | null;
  locked_price: boolean;
  division?: Division;
}

export interface DivisionApproval {
  id: string;
  order_id: string;
  division_id: string;
  approver_user_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string;
  decided_at: string | null;
  division?: Division;
  approver_user?: AppUser;
}

export interface FinalApproval {
  id: string;
  order_id: string;
  approver_user_id: string;
  approver_name: string;
  sequence_order: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string;
  decided_at: string | null;
  approver_user?: AppUser;
}

export interface OrderTimeline {
  id: string;
  order_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  action_type: string;
  old_value: string;
  new_value: string;
  field_changed: string;
  notes: string;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  order_id: string;
  notification_type: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string;
}

export interface SystemConfig {
  id: string;
  config_key: string;
  config_value: string;
  config_type: string;
  label: string;
  description: string;
  updated_by: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  division_id: string;
  unit_price: number;
  unit: string;
  status: string;
  division?: Division;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

// ─── Rate Contracts ───────────────────────────────────────────────────────────

export type RCStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface RateContract {
  id: string;
  rc_code: string;
  hospital_id: string;
  rep_id: string | null;
  status: RCStatus;
  valid_from: string;
  valid_to: string;
  total_value: number;
  notes: string;
  created_at: string;
  updated_at: string;
  hospital?: Hospital;
  field_rep?: FieldRep;
  items?: RateContractItem[];
}

export interface RateContractItem {
  id: string;
  rc_id: string;
  product_id: string | null;
  product_name: string;
  division_id: string | null;
  negotiated_price: number;
  expected_qty: number;
  cap_qty: number | null;
  used_qty: number;
  division?: Division;
}

export interface RateContractApproval {
  id: string;
  rc_id: string;
  approval_stage: 'division' | 'final';
  division_id: string | null;
  approver_user_id: string | null;
  approver_name: string;
  sequence_order: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string;
  decided_at: string | null;
  division?: Division;
  approver_user?: AppUser;
}

export interface RCTimeline {
  id: string;
  rc_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  action_type: string;
  created_at: string;
}
