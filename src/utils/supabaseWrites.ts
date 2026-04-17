import { formatSupabaseError } from './supabaseSchema';

interface SupabaseMutationResult<T = unknown> {
  error?: {
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  } | null;
  data?: T[] | T | null;
}

function hasAffectedRows(data: unknown): boolean {
  if (Array.isArray(data)) return data.length > 0;
  return data !== null && data !== undefined;
}

export function getMutationError<T>(
  result: SupabaseMutationResult<T>,
  fallback: string,
  requireAffectedRows = true
): string | null {
  if (result.error) return formatSupabaseError(result.error, fallback);
  if (requireAffectedRows && !hasAffectedRows(result.data)) return fallback;
  return null;
}
