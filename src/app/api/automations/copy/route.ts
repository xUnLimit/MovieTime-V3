import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { apiErrorResponse, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { readCommerceCopyUseCase } from '@/application/use-cases/commerce-copy-server-use-case';

// Solo lectura: el lienzo muestra el texto que el bot usa hoy. Los textos de compras se cambian en los bloques del recorrido.
export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    return apiSuccess(await readCommerceCopyUseCase(), requestId);
  } catch (error) { return apiErrorResponse('CommerceCopy', requestId, error); }
}
