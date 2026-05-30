import { supabase } from './client';

export type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export function typedRpcClient<TClient>() {
  return supabase as unknown as TClient;
}
