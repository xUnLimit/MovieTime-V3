import { changeUsuarioEstado, UsuarioEstadoError } from '@/application/use-cases/usuarios-estado-use-case';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { createUsuarioEstadoRepository } from '@/platform/server/usuarios-estado-repository';
import { isUuid } from '@/platform/utils/safety';
import { z } from '@/platform/validation/zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.strictObject({ active: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const { id } = await context.params;
    if (!isUuid(id)) return apiFailure(400, 'INVALID_REQUEST', 'ID de usuario invalido.', requestId);
    const parsed = await parseJsonRequest(request, requestSchema, 1024);
    if (!parsed.success) {
      return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    }
    const result = await changeUsuarioEstado(
      { actorId: user.id, id, active: parsed.data.active },
      createUsuarioEstadoRepository(),
    );
    return apiSuccess(result, requestId);
  } catch (error) {
    if (error instanceof UsuarioEstadoError) {
      return apiFailure(error.status, 'INVALID_REQUEST', error.message, requestId);
    }
    return apiErrorResponse('UsuariosEstadoRoute', requestId, error);
  }
}
