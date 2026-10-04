import { readApiResponse } from './client';

export type CommerceCopyData = { overrides: Record<string, string>; updatedAt: Record<string, string> };

export async function getCommerceCopy(token: string): Promise<CommerceCopyData> {
  return readApiResponse<CommerceCopyData>(await fetch('/api/automations/copy', {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  }));
}
export async function postCommerceCopy(token: string, command: { key: string; text: string | null }): Promise<string> {
  return readApiResponse<string>(await fetch('/api/automations/copy', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  }));
}
