import { createServiceRoleClient } from '@/platform/server/supabase-server';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
type ClaimResult = 'claimed' | 'mine' | 'taken';
export type NetflixClaimStore = {
  claim(mailKey: string, waId: string): Promise<ClaimResult>;
  // Only the number that holds the claim can release it.
  release(mailKey: string, waId: string): Promise<boolean>;
  // Who already received each mail; keys nobody received are absent.
  owners(mailKeys: string[]): Promise<Map<string, string>>;
  delivered(replyKey: string): Promise<boolean>;
};

function check(error: { code?: string } | null, operation: string): void {
  if (error) throw new Error(`Netflix claim store ${operation} failed: ${error.code ?? 'unknown'}`);
}

function isClaimResult(value: unknown): value is ClaimResult {
  return value === 'claimed' || value === 'mine' || value === 'taken';
}

export function createNetflixClaimStore(client: ServiceClient = createServiceRoleClient()): NetflixClaimStore {
  return {
    async delivered(replyKey) {
      const { data, error } = await client.from('whatsapp_outbound_messages').select('id')
        .eq('idempotency_key', replyKey).eq('send_status', 'accepted').maybeSingle();
      check(error, 'delivery lookup');
      return data !== null;
    },
    async claim(mailKey, waId) {
      const { data, error } = await client.rpc('claim_netflix_code', { p_mail_key: mailKey, p_wa_id: waId });
      check(error, 'claim');
      if (!isClaimResult(data)) throw new Error('Netflix claim store claim returned an unknown result');
      return data;
    },
    async release(mailKey, waId) {
      const { data, error } = await client.rpc('release_netflix_code', { p_mail_key: mailKey, p_wa_id: waId });
      check(error, 'release');
      return data === true;
    },
    async owners(mailKeys) {
      if (mailKeys.length === 0) return new Map();
      const { data, error } = await client.from('netflix_code_claims').select('mail_key,wa_id').in('mail_key', mailKeys);
      check(error, 'owner lookup');
      return new Map((data ?? []).map((row) => [row.mail_key, row.wa_id]));
    },
  };
}
