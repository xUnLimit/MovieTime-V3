import { sendDeviceTestPush } from '@/modules/notifications/device-test-push';
import { pushTestRequestSchema } from '@/modules/pwa/push-api-contracts';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    let endpoint: string | undefined;
    if (request.body !== null) {
      const parsed = await parseJsonRequest(request, pushTestRequestSchema, 4 * 1024, {
        emptyBodyAsObject: true,
      });
      if (!parsed.success) {
        return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
      }
      endpoint = parsed.data.endpoint;
    }
    const result = await sendDeviceTestPush(user.id, endpoint);
    if (result.skipped === 'not_subscribed') {
      return apiFailure(409, 'INVALID_REQUEST',
        'Este dispositivo no tiene una suscripción push activa en el servidor. Desactiva y vuelve a activar Push web.',
        requestId);
    }
    if (result.sent === 0) {
      return apiFailure(502, 'NO_SUCCESSFUL_DELIVERIES', result.disabled > 0
        ? 'La suscripción fue rechazada. Desactiva y vuelve a activar Push web en este dispositivo.'
        : 'El servicio push no aceptó la notificación. Intenta nuevamente.', requestId);
    }
    return apiSuccess(result, requestId);
  } catch (error) {
    return apiErrorResponse('PushTestRoute', requestId, error);
  }
}
