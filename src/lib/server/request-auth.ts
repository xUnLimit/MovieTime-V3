import type { User } from '@supabase/supabase-js';

import { createUserRequestClient } from './supabase-server';

type AuthenticatedAdmin = {
  user: User;
};

export async function requireAuthenticatedAdmin(request: Request): Promise<AuthenticatedAdmin> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const userClient = createUserRequestClient(authorization);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('active,role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile?.active) {
    throw new Error('Forbidden');
  }

  if (profile.role !== 'admin') {
    throw new Error('Forbidden');
  }

  return { user: userData.user };
}
