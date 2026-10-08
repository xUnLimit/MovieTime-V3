import { fetchCustomerReports, postCustomerReport } from '@/platform/api/customer-reports-client';
import { getCurrentSession } from '@/platform/supabase/auth';
import { assertOnlineMutation } from '@/platform/utils/online-mutation';
import type { ReportQuery, ReportUpdate } from '@/platform/validation/customer-reports';
export { subscribeToReportChanges } from '@/platform/supabase/customer-reports-realtime';

async function token() {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Debes iniciar sesión para consultar reportes.');
  return session.access_token;
}
export async function listCustomerReportsUseCase(query: ReportQuery) {
  return fetchCustomerReports(await token(), query);
}
export async function updateCustomerReportUseCase(input: ReportUpdate) {
  assertOnlineMutation();
  await postCustomerReport(await token(), input);
}
