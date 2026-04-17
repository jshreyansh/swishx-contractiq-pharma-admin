interface SupabaseErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

function errorText(error: SupabaseErrorLike | null | undefined): string {
  return `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase();
}

export function isMissingRateContractsSchema(error: SupabaseErrorLike | null | undefined): boolean {
  const text = errorText(error);

  return (
    (error?.code === 'PGRST205' && text.includes('rate_contract')) ||
    (error?.code === 'PGRST200' && text.includes("'orders' and 'rate_contracts'")) ||
    (error?.code === '42703' &&
      (text.includes('orders.rc_id') ||
        text.includes('order_items.rc_item_id') ||
        text.includes('pricing_mode')))
  );
}

export function isMissingOrderRateContractLinksSchema(error: SupabaseErrorLike | null | undefined): boolean {
  const text = errorText(error);

  return (
    (error?.code === 'PGRST205' && text.includes('order_rate_contract_links')) ||
    (error?.code === '42p01' && text.includes('order_rate_contract_links')) ||
    (error?.code === '42703' && text.includes('order_rate_contract_links'))
  );
}

export function formatSupabaseError(error: SupabaseErrorLike | null | undefined, fallback: string): string {
  return error?.message || fallback;
}

export const RATE_CONTRACTS_SCHEMA_WARNING =
  'This environment is missing the rate contract database addendum, so RC data cannot be loaded yet.';
