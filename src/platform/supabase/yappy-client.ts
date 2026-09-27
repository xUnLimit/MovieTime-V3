import { readApiResponse } from '@/platform/api/client';

export async function triggerYappySync(accessToken: string): Promise<{ errorCode: string | null }> {
  const response = await fetch('/api/yappy/sync-now', { method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
  return readApiResponse<{ errorCode: string | null }>(response);
}
