import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { reportQuerySchema, reportUpdateSchema } from '@/platform/validation/customer-reports';
import { createCustomerReportsStore, updateCustomerReport } from '@/modules/customer-reports/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed = reportQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return apiFailure(400, 'INVALID_REQUEST', 'Los filtros no son válidos.', requestId);
    return apiSuccess(await createCustomerReportsStore().list(parsed.data), requestId);
  } catch (error) { return apiErrorResponse('CustomerReports', requestId, error); }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, reportUpdateSchema, 2048);
    if (!parsed.success) return apiFailure(parsed.status, parsed.code, parsed.message, requestId);
    if (!await updateCustomerReport(request.headers.get('authorization') ?? '', parsed.data)) {
      return apiFailure(409, 'INVALID_REQUEST', 'El reporte cambió. Actualiza la lista.', requestId);
    }
    return apiSuccess({ updated: true }, requestId);
  } catch (error) { return apiErrorResponse('CustomerReports', requestId, error); }
}
