import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, createRequestId } from '@/platform/server/api-response';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { CloudApiError } from '@/modules/whatsapp/cloud-api-client';
import { downloadCloudApiMedia } from '@/modules/whatsapp/media-download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tipos que el navegador puede mostrar en linea; cualquier otro se fuerza a descarga.
const INLINE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr',
  'video/mp4', 'video/3gpp',
  'application/pdf',
]);

export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);

    const { mediaId } = await params;
    if (!/^\d{1,32}$/.test(mediaId)) {
      return apiFailure(400, 'INVALID_REQUEST', 'Archivo no válido.', requestId);
    }
    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
    }

    // Solo se sirven archivos que pasaron por este numero: recibidos por el
    // webhook o subidos por el propio sistema, nunca un id arbitrario de Meta.
    const client = createServiceRoleClient();
    const [inbound, outbound] = await Promise.all([
      client.from('whatsapp_inbound_messages').select('media_filename').eq('media_id', mediaId).limit(1).maybeSingle(),
      client.from('whatsapp_outbound_messages').select('media_filename').eq('media_id', mediaId).limit(1).maybeSingle(),
    ]);
    if (inbound.error) throw new Error(`No se pudo verificar el archivo: ${inbound.error.code}`);
    if (outbound.error) throw new Error(`No se pudo verificar el archivo: ${outbound.error.code}`);
    const data = inbound.data ?? outbound.data;
    if (!data) return apiFailure(404, 'INVALID_REQUEST', 'Archivo no encontrado.', requestId);

    const { bytes, mimeType } = await downloadCloudApiMedia(
      { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId },
      mediaId
    );
    const inline = INLINE_TYPES.has(mimeType.split(';', 1)[0].trim().toLowerCase());
    const filename = (data.media_filename ?? `archivo-${mediaId}`).replace(/[^\w.\- ]/g, '_');

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': inline ? mimeType : 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    if (error instanceof CloudApiError) {
      return apiFailure(502, 'INTERNAL_ERROR', 'No se pudo descargar el archivo de WhatsApp.', requestId);
    }
    return apiErrorResponse('WhatsAppMediaRoute', requestId, error);
  }
}
