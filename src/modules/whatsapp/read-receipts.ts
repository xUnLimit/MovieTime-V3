import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { markCloudApiMessageRead, type CloudApiConfig } from './cloud-api-client';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

// Marca el chat como leido en el sistema y, si el cliente escribio antes,
// muestra los ✓✓ azules en su telefono sobre su ultimo mensaje.
export async function markConversationRead(
  config: CloudApiConfig,
  waId: string,
  readAt: string,
  client: ServiceClient = createServiceRoleClient(),
  markReadOnMeta: typeof markCloudApiMessageRead = markCloudApiMessageRead
): Promise<void> {
  const { data, error } = await client
    .from('whatsapp_inbound_messages')
    .select('wa_message_id')
    .eq('from_wa_id', waId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el último mensaje: ${error.code}`);

  if (data?.wa_message_id) {
    // Un fallo al avisar a Meta no debe impedir marcar el chat como leido localmente.
    await markReadOnMeta(config, data.wa_message_id).catch(() => undefined);
  }

  const { error: upsertError } = await client
    .from('whatsapp_conversation_reads')
    .upsert({ wa_id: waId, last_read_at: readAt }, { onConflict: 'wa_id' });
  if (upsertError) throw new Error(`No se pudo guardar la marca de leido: ${upsertError.code}`);
}
