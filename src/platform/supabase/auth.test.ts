import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
      signOut: clientMocks.signOut,
      getUser: clientMocks.getUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: clientMocks.maybeSingle,
        })),
      })),
    })),
  },
}));

import {
  InvalidAuthSessionError,
  getCurrentProfile,
  getCurrentSupabaseUser,
  signOut,
} from './auth';

describe('Supabase auth adapter', () => {
  beforeEach(() => {
    clientMocks.signOut.mockReset().mockResolvedValue({ error: null });
    clientMocks.getUser.mockReset();
    clientMocks.maybeSingle.mockReset();
  });

  it('signs out only the current device', async () => {
    await signOut();

    expect(clientMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('propagates session validation failures instead of converting them to no user', async () => {
    const authError = new Error('network unavailable');
    clientMocks.getUser.mockResolvedValue({ data: { user: null }, error: authError });

    await expect(getCurrentSupabaseUser()).rejects.toBe(authError);
  });

  it('classifies a rejected token as an invalid local session', async () => {
    clientMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT', status: 401, code: 'bad_jwt' },
    });

    await expect(getCurrentSupabaseUser()).rejects.toBeInstanceOf(InvalidAuthSessionError);
  });

  it('propagates profile query failures instead of converting them to a missing profile', async () => {
    clientMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'admin@movietime.test' } },
      error: null,
    });
    const profileError = new Error('database timeout');
    clientMocks.maybeSingle.mockResolvedValue({ data: null, error: profileError });

    await expect(getCurrentProfile()).rejects.toBe(profileError);
  });
});
