import { supabase } from '../lib/supabase';
import { Order, RateContract } from '../types';
import { isMissingOrderRateContractLinksSchema, isMissingRateContractsSchema } from './supabaseSchema';

type ErrorLike = { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };

export interface LinkedOrderSummary {
  id: string;
  order_id: string;
  total_value: number;
  stage: Order['stage'];
  updated_at: string;
}

interface LinkQueryResult {
  orderIdToRateContracts: Map<string, RateContract[]>;
  rcIdToOrders: Map<string, LinkedOrderSummary[]>;
  schemaUnavailable: boolean;
  error: ErrorLike | null;
}

function sortRateContracts(rateContracts: RateContract[]): RateContract[] {
  return [...rateContracts].sort((left, right) => left.rc_code.localeCompare(right.rc_code));
}

function sortOrders(orders: LinkedOrderSummary[]): LinkedOrderSummary[] {
  return [...orders].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

async function fetchRateContractsById(rateContractIds: string[]): Promise<Map<string, RateContract>> {
  if (rateContractIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('rate_contracts')
    .select('id, rc_code, hospital_id, rep_id, status, valid_from, valid_to, total_value, notes, created_at, updated_at, hospital:hospitals(*)')
    .in('id', rateContractIds);

  if (error) {
    throw error;
  }

  return new Map(((data || []) as RateContract[]).map(rateContract => [rateContract.id, rateContract]));
}

async function fetchOrdersById(orderIds: string[]): Promise<Map<string, LinkedOrderSummary>> {
  if (orderIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_id, total_value, stage, updated_at')
    .in('id', orderIds);

  if (error) {
    throw error;
  }

  return new Map(((data || []) as LinkedOrderSummary[]).map(order => [order.id, order]));
}

async function loadOrderRateContractLinks(
  orders: Array<Pick<Order, 'id' | 'rc_id'>>
): Promise<LinkQueryResult> {
  const orderIds = [...new Set(orders.map(order => order.id))];
  if (orderIds.length === 0) {
    return {
      orderIdToRateContracts: new Map(),
      rcIdToOrders: new Map(),
      schemaUnavailable: false,
      error: null,
    };
  }

  const linksResponse = await supabase
    .from('order_rate_contract_links')
    .select('order_id, rc_id')
    .in('order_id', orderIds);

  if (linksResponse.error) {
    if (isMissingOrderRateContractLinksSchema(linksResponse.error)) {
      const fallbackRcIds = [...new Set(orders.map(order => order.rc_id).filter((rcId): rcId is string => Boolean(rcId)))];

      try {
        const rateContractsById = await fetchRateContractsById(fallbackRcIds);
        const orderIdToRateContracts = new Map<string, RateContract[]>();
        const rcIdToOrders = new Map<string, LinkedOrderSummary[]>();

        for (const order of orders) {
          const linked = order.rc_id ? rateContractsById.get(order.rc_id) : null;
          orderIdToRateContracts.set(order.id, linked ? [linked] : []);
        }

        return {
          orderIdToRateContracts,
          rcIdToOrders,
          schemaUnavailable: true,
          error: null,
        };
      } catch (fallbackError) {
        return {
          orderIdToRateContracts: new Map(),
          rcIdToOrders: new Map(),
          schemaUnavailable: true,
          error: fallbackError as ErrorLike,
        };
      }
    }

    return {
      orderIdToRateContracts: new Map(),
      rcIdToOrders: new Map(),
      schemaUnavailable: false,
      error: linksResponse.error,
    };
  }

  try {
    const linkRows = (linksResponse.data || []) as Array<{ order_id: string; rc_id: string }>;
    const rateContractIds = [...new Set(linkRows.map(link => link.rc_id))];
    const rateContractsById = await fetchRateContractsById(rateContractIds);
    const ordersById = await fetchOrdersById(orderIds);

    const orderIdToRateContracts = new Map<string, RateContract[]>();
    const rcIdToOrders = new Map<string, LinkedOrderSummary[]>();

    for (const order of orders) {
      orderIdToRateContracts.set(order.id, []);
    }

    for (const link of linkRows) {
      const rateContract = rateContractsById.get(link.rc_id);
      if (rateContract) {
        const linkedRateContracts = orderIdToRateContracts.get(link.order_id) || [];
        linkedRateContracts.push(rateContract);
        orderIdToRateContracts.set(link.order_id, linkedRateContracts);
      }

      const orderSummary = ordersById.get(link.order_id);
      if (orderSummary) {
        const linkedOrders = rcIdToOrders.get(link.rc_id) || [];
        linkedOrders.push(orderSummary);
        rcIdToOrders.set(link.rc_id, linkedOrders);
      }
    }

    for (const [orderId, rateContracts] of orderIdToRateContracts.entries()) {
      orderIdToRateContracts.set(orderId, sortRateContracts(rateContracts));
    }

    for (const [rcId, linkedOrders] of rcIdToOrders.entries()) {
      const uniqueOrders = [...new Map(linkedOrders.map(order => [order.id, order])).values()];
      rcIdToOrders.set(rcId, sortOrders(uniqueOrders));
    }

    return {
      orderIdToRateContracts,
      rcIdToOrders,
      schemaUnavailable: false,
      error: null,
    };
  } catch (error) {
    return {
      orderIdToRateContracts: new Map(),
      rcIdToOrders: new Map(),
      schemaUnavailable: false,
      error: error as ErrorLike,
    };
  }
}

export async function enrichOrdersWithLinkedRateContracts<T extends Order>(
  orders: T[]
): Promise<{ orders: T[]; schemaUnavailable: boolean; error: ErrorLike | null }> {
  if (orders.length === 0) {
    return { orders, schemaUnavailable: false, error: null };
  }

  if (orders.every(order => !order.rc_id && order.pricing_mode !== 'RC')) {
    return { orders, schemaUnavailable: false, error: null };
  }

  const result = await loadOrderRateContractLinks(orders);
  const enrichedOrders = orders.map(order => {
    const linkedRateContracts = result.orderIdToRateContracts.get(order.id) || [];
    return {
      ...order,
      linked_rate_contracts: linkedRateContracts,
      rc: linkedRateContracts[0] || order.rc,
    };
  });

  return {
    orders: enrichedOrders as T[],
    schemaUnavailable: result.schemaUnavailable,
    error: result.error,
  };
}

export async function loadLinkedOrdersForRateContracts(
  rcIds: string[]
): Promise<{ linkedOrdersByRcId: Map<string, LinkedOrderSummary[]>; schemaUnavailable: boolean; error: ErrorLike | null }> {
  if (rcIds.length === 0) {
    return { linkedOrdersByRcId: new Map(), schemaUnavailable: false, error: null };
  }

  const { data, error } = await supabase
    .from('order_rate_contract_links')
    .select('order_id, rc_id')
    .in('rc_id', rcIds);

  if (error) {
    if (isMissingOrderRateContractLinksSchema(error)) {
      const fallbackOrdersResponse = await supabase
        .from('orders')
        .select('id, order_id, total_value, stage, updated_at, rc_id')
        .in('rc_id', rcIds);

      if (fallbackOrdersResponse.error) {
        return {
          linkedOrdersByRcId: new Map(),
          schemaUnavailable: true,
          error: fallbackOrdersResponse.error,
        };
      }

      const linkedOrdersByRcId = new Map<string, LinkedOrderSummary[]>();
      for (const row of fallbackOrdersResponse.data || []) {
        if (!row.rc_id) continue;
        const linkedOrders = linkedOrdersByRcId.get(row.rc_id) || [];
        linkedOrders.push({
          id: row.id,
          order_id: row.order_id,
          total_value: row.total_value,
          stage: row.stage,
          updated_at: row.updated_at,
        } as LinkedOrderSummary);
        linkedOrdersByRcId.set(row.rc_id, sortOrders(linkedOrders));
      }

      return {
        linkedOrdersByRcId,
        schemaUnavailable: true,
        error: null,
      };
    }

    return {
      linkedOrdersByRcId: new Map(),
      schemaUnavailable: false,
      error,
    };
  }

  try {
    const linkRows = (data || []) as Array<{ order_id: string; rc_id: string }>;
    const orderIds = [...new Set(linkRows.map(link => link.order_id))];
    const ordersById = await fetchOrdersById(orderIds);
    const linkedOrdersByRcId = new Map<string, LinkedOrderSummary[]>();

    for (const link of linkRows) {
      const order = ordersById.get(link.order_id);
      if (!order) continue;

      const linkedOrders = linkedOrdersByRcId.get(link.rc_id) || [];
      linkedOrders.push(order);
      linkedOrdersByRcId.set(link.rc_id, linkedOrders);
    }

    for (const [rcId, linkedOrders] of linkedOrdersByRcId.entries()) {
      const uniqueOrders = [...new Map(linkedOrders.map(order => [order.id, order])).values()];
      linkedOrdersByRcId.set(rcId, sortOrders(uniqueOrders));
    }

    return {
      linkedOrdersByRcId,
      schemaUnavailable: false,
      error: null,
    };
  } catch (queryError) {
    return {
      linkedOrdersByRcId: new Map(),
      schemaUnavailable: false,
      error: queryError as ErrorLike,
    };
  }
}

export function hasRateContractSchemaError(error: ErrorLike | null | undefined): boolean {
  return isMissingRateContractsSchema(error) || isMissingOrderRateContractLinksSchema(error);
}
