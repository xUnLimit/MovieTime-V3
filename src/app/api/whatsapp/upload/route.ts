import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { CloudApiError, uploadCloudApiMedia } from '@/modules/whatsapp/cloud-api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel limita el cuerpo de una solicitud a ~4.5MB; se deja margen para el resto del multipart.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/webm',
]);

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\- ]/g, '_').slice(0, 200) || 'archivo';
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);

    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
    }

    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + 8 * 1024) {
      return apiFailure(413, 'PAYLOAD_TOO_LARGE', 'El archivo excede el tamaño permitido (4 MB).', requestId);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiFailure(400, 'INVALID_REQUEST', 'La solicitud debe ser multipart/form-data.', requestId);
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return apiFailure(400, 'INVALID_REQUEST', 'Falta el archivo a subir.', requestId);
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return apiFailure(413, 'PAYLOAD_TOO_LARGE', 'El archivo excede el tamaño permitido (4 MB).', requestId);
    }
    const mimeType = (form.get('mimeType') as string | null) || file.type;
    if (!ALLOWED_TYPES.has(mimeType)) {
      return apiFailure(400, 'INVALID_REQUEST', 'Tipo de archivo no permitido.', requestId);
    }

    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    const { mediaId } = await uploadCloudApiMedia(config, file, mimeType, sanitizeFilename(file.name || 'archivo'));

    return apiSuccess({ mediaId, mimeType, filename: sanitizeFilename(file.name || 'archivo') }, requestId);
  } catch (error) {
    if (error instanceof CloudApiError) {
      return apiFailure(502, 'INTERNAL_ERROR', 'No se pudo subir el archivo a WhatsApp.', requestId);
    }
    return apiErrorResponse('WhatsAppUploadRoute', requestId, error);
  }
}
