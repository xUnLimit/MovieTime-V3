// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  randomBytes: vi.fn(() => Buffer.alloc(24, 7)),
  randomUUID: vi.fn(() => '12345678-1234-4321-9876-123456789abc'),
  createUser: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('node:crypto', () => ({ randomBytes: mocks.randomBytes, randomUUID: mocks.randomUUID }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { createUser: mocks.createUser } }, from: () => ({ upsert: mocks.upsert }) }),
}));

import { uniqueId } from '../../e2e/authenticated/helpers/env';
import { createTempUser, serviceClient } from '../../e2e/authenticated/helpers/supabase';

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('ephemeral E2E users', () => {
  it('uses a cryptographic UUID for names', () => {
    expect(uniqueId()).toBe('12345678123443219876123456789abc');
    expect(mocks.randomUUID).toHaveBeenCalledOnce();
  });

  it('generates passwords with independent cryptographic entropy', async () => {
    for (const name of [
      'E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY',
      'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_OPERATOR_EMAIL', 'E2E_OPERATOR_PASSWORD',
      'E2E_WHATSAPP_APP_SECRET',
    ]) vi.stubEnv(name, name === 'E2E_SUPABASE_URL' ? 'http://localhost:54321' : 'test-value');
    mocks.createUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    const user = await createTempUser(serviceClient(), 'operador', false);
    expect(mocks.randomBytes).toHaveBeenCalledWith(24);
    expect(mocks.createUser).toHaveBeenCalledWith({ email: user.email, password: user.password, email_confirm: true });
    expect(user.password).toMatch(/^E2e-[A-Za-z0-9_-]{32}-Pass1!$/);
    expect(user.password).not.toContain('12345678');
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ role: 'operador', active: false }), { onConflict: 'id' });
    expect(user.id).toBe('test-user-id');
  });
});
