import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations',
  '20261006030000_repair_restored_rpc_idempotency_index.sql'), 'utf8');

describe('restored RPC idempotency compatibility', () => {
  it('adds a unique index for the conflict target shared by all five critical RPCs', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS rpc_idempotency_keys_actor_rpc_key_uidx\s+ON public\.rpc_idempotency_keys \(created_by, rpc_name, idempotency_key\)/);
    const restored = readFileSync(join(process.cwd(), 'supabase/migrations',
      '20261006010000_restore_pre_bot_v2_functions.sql'), 'utf8');
    expect(restored.match(/ON CONFLICT \(created_by, rpc_name, idempotency_key\) DO NOTHING/g)).toHaveLength(5);
  });

  it('preserves the existing primary key, data and authorization', () => {
    const statements = sql.replace(/--[^\n]*/g, '');
    expect(statements).not.toMatch(/DROP|DELETE|UPDATE|TRUNCATE|GRANT|REVOKE|ALTER/);
  });
});
