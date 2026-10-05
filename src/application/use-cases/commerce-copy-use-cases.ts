import { getCurrentSession } from '@/platform/supabase/auth';
import { getCommerceCopy } from '@/platform/api/commerce-copy-client';

async function accessToken(): Promise<string> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Inicia sesión para ver los textos de compras.');
  return session.access_token;
}
/** Textos de compras que el bot usa hoy fuera del recorrido (guardados antes en la pestaña Compras). */
export async function fetchCommerceCopyUseCase() {
  return getCommerceCopy(await accessToken());
}
