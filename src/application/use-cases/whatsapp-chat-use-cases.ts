import { deliveryPassword } from '@/platform/utils/code-access';
import {
  fetchWhatsAppMedia,
  postMarkConversationRead,
  postWhatsAppMessage,
  uploadWhatsAppMedia,
  type WhatsAppSendMessage,
  type WhatsAppSendResult,
  type WhatsAppUploadResult,
} from '@/platform/api/whatsapp-messages-client';
import { getCurrentSession } from '@/platform/supabase/auth';
import { subscribeToWhatsAppChanges, type WhatsAppRealtimeListener } from '@/platform/supabase/whatsapp-realtime';
import { createIdempotencyKey } from '@/platform/supabase/idempotency';
import {
  hideWhatsAppMessage,
  listWhatsAppConversations,
  listWhatsAppMessages,
  markWhatsAppConversationUnread,
  setWhatsAppConversationArchived,
  setWhatsAppConversationPinned,
} from '@/platform/supabase/whatsapp-chat-repository';
import type { VentaMessageContext } from '@/platform/utils/whatsapp-template-render';
import { fetchVentaDetalleQuery } from './ventas/venta-detail-query-use-cases';

export type { VentaMessageContext } from '@/platform/utils/whatsapp-template-render';

export type { WhatsAppConversation, WhatsAppChatMessage } from '@/platform/supabase/whatsapp-chat-repository';
export type { WhatsAppSendMessage, WhatsAppSendResult, WhatsAppUploadResult } from '@/platform/api/whatsapp-messages-client';
export type { WhatsAppRealtimeEvent, WhatsAppRealtimeStatus, WhatsAppRealtimeListener } from '@/platform/supabase/whatsapp-realtime';

export function subscribeToWhatsAppChatChangesUseCase(listener: WhatsAppRealtimeListener): () => void {
  return subscribeToWhatsAppChanges(listener);
}

export function fetchWhatsAppConversationsUseCase() {
  return listWhatsAppConversations();
}

export function fetchWhatsAppMessagesUseCase(waId: string) {
  return listWhatsAppMessages(waId);
}

async function requireAccessToken(action: string): Promise<string> {
  const session = await getCurrentSession();
  if (!session?.access_token) {
    throw new Error(`No hay una sesión activa para ${action}.`);
  }
  return session.access_token;
}

export async function fetchWhatsAppMediaUseCase(mediaId: string): Promise<Blob> {
  const accessToken = await requireAccessToken('ver archivos');
  return fetchWhatsAppMedia(accessToken, mediaId);
}

// Pasa por el servidor (no un write directo) para avisarle tambien a Meta y
// mostrar los ✓✓ azules en el telefono del cliente.
export async function markWhatsAppConversationReadUseCase(waId: string, readAt: string) {
  const accessToken = await requireAccessToken('marcar la conversación como leída');
  await postMarkConversationRead(accessToken, waId, readAt);
}

export async function markWhatsAppConversationUnreadUseCase(waId: string, lastInboundAt: string) {
  await markWhatsAppConversationUnread(waId, lastInboundAt);
}

const WA_ID_PATTERN = /^[0-9]{8,15}$/;

function assertWaId(waId: string): string {
  if (!WA_ID_PATTERN.test(waId)) throw new Error('El número de WhatsApp no es válido.');
  return waId;
}

export async function setWhatsAppConversationPinnedUseCase(waId: string, pinned: boolean) {
  await setWhatsAppConversationPinned(assertWaId(waId), pinned ? new Date().toISOString() : null);
}

export async function setWhatsAppConversationArchivedUseCase(waId: string, archived: boolean) {
  await setWhatsAppConversationArchived(assertWaId(waId), archived ? new Date().toISOString() : null);
}

// Solo oculta el mensaje en esta bandeja; el cliente lo sigue viendo en su WhatsApp.
export async function hideWhatsAppMessageUseCase(messageId: string, direction: 'inbound' | 'outbound') {
  await hideWhatsAppMessage(messageId, direction);
}

export async function uploadWhatsAppMediaUseCase(file: Blob, filename: string): Promise<WhatsAppUploadResult> {
  const accessToken = await requireAccessToken('subir un archivo');
  return uploadWhatsAppMedia(accessToken, file, filename);
}

// Datos de la venta para llenar mensajes; la contrasena se lee igual que en el
// detalle de la venta (solo admins, por RLS).
export async function fetchVentaMessageContextUseCase(ventaId: string): Promise<VentaMessageContext | null> {
  const { venta, servicioContrasena } = await fetchVentaDetalleQuery(ventaId);
  if (!venta) return null;
  return {
    clienteNombre: venta.clienteNombre,
    categoriaNombre: venta.categoriaNombre || venta.servicioNombre,
    servicioNombre: venta.servicioNombre,
    perfilNombre: venta.perfilNombre ?? '',
    correo: venta.servicioCorreo ?? '',
    contrasena: deliveryPassword(venta.servicioContrasena || servicioContrasena, venta.accesoPorCodigo),
    codigo: venta.codigo ?? '',
    fechaVencimiento: venta.fechaFin ?? null,
    monto: venta.precioFinal ?? venta.precio ?? 0,
  };
}

// La clave de idempotencia la genera quien llama (una por intento del usuario),
// para que un reintento de red devuelva el mismo envio en vez de duplicarlo.
export async function sendWhatsAppMessageUseCase(input: {
  to: string;
  message: WhatsAppSendMessage;
  idempotencyKey?: string;
}): Promise<WhatsAppSendResult> {
  const accessToken = await requireAccessToken('enviar mensajes');
  return postWhatsAppMessage(accessToken, {
    idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(),
    to: input.to,
    message: input.message,
  });
}
