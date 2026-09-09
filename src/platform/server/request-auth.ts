import type { User } from '@supabase/supabase-js';

import { createUserRequestClient } from './supabase-server';
import { ForbiddenError, UnauthorizedError } from './api-errors';

type AuthenticatedAdmin = {
  user: User;
};

export async function requireAuthenticatedAdmin(request: Request): Promise<AuthenticatedAdmin> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const userClient = createUserRequestClient(authorization);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    throw new UnauthorizedError();
  }

  const { data: profile, error: profileError } = await userClient
    .from('usuarios')
    .select('active,role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile?.active) {
    throw new ForbiddenError();
  }

  if (profile.role !== 'admin') {
    throw new ForbiddenError();
  }

  return { user: userData.user };
}
