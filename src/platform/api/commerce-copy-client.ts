import { readApiResponse } from './client';

export type CommerceCopyData = { overrides: Record<string, string>; updatedAt: Record<string, string> };

export async function getCommerceCopy(token: string): Promise<CommerceCopyData> {
  return readApiResponse<CommerceCopyData>(await fetch('/api/automations/copy', {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  }));
}
