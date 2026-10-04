import { getCurrentSession } from '@/platform/supabase/auth';
import { getCommerceCopy, postCommerceCopy } from '@/platform/api/commerce-copy-client';
import { assertOnlineMutation } from '@/platform/utils/online-mutation';

async function accessToken(): Promise<string> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Inicia sesión para editar los mensajes.');
  return session.access_token;
}
export async function fetchCommerceCopyUseCase() {
  return getCommerceCopy(await accessToken());
}
/** Guarda un texto; `text: null` restaura el original. */
export async function saveCommerceCopyClientUseCase(input: { key: string; text: string | null }) {
  assertOnlineMutation();
  return postCommerceCopy(await accessToken(), input);
}
