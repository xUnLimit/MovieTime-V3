import { readApiResponse } from './client';

// Pide al servidor refrescar la cache de plantillas desde Meta (solo admin).
export async function postSyncMetaTemplates(accessToken: string): Promise<{ count: number }> {
  const response = await fetch('/api/whatsapp/templates/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return readApiResponse<{ count: number }>(response);
}
