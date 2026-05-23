import { supabase } from './client';

export type FeatureFlagMap = Record<string, boolean>;

type FeatureFlagRow = {
  key: string;
  enabled: boolean;
};

type SupabaseRowsResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchFeatureFlags(): Promise<FeatureFlagMap> {
  const query = supabase
    .from('feature_flags' as never)
    .select('key, enabled') as unknown as PromiseLike<SupabaseRowsResult<FeatureFlagRow>>;

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return Object.fromEntries((data ?? []).map((row) => [row.key, Boolean(row.enabled)]));
}
