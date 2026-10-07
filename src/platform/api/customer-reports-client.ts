import { readApiResponse } from './client';
import { reportPageSchema, reportQuerySchema, reportUpdateSchema, type ReportQuery, type ReportUpdate } from '@/platform/validation/customer-reports';

export async function fetchCustomerReports(accessToken: string, input: ReportQuery) {
  const parsed = reportQuerySchema.parse(input);
  const query = new URLSearchParams({ page: String(parsed.page), ...(parsed.status ? { status: parsed.status } : {}) });
  const response = await fetch(`/api/customer-reports?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  return reportPageSchema.parse(await readApiResponse<unknown>(response));
}

export async function postCustomerReport(accessToken: string, input: ReportUpdate) {
  const response = await fetch('/api/customer-reports', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(reportUpdateSchema.parse(input)), signal: AbortSignal.timeout(15000),
  });
  await readApiResponse<unknown>(response);
}
