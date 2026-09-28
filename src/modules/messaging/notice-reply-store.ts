import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { NoticeRecord } from './notice-store';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
export type NoticeReplyAction = 'RENOVAR' | 'NO_CONTINUAR' | 'DATOS';
export type NoticeReplyStore = {
  findNotice(id: string): Promise<NoticeRecord | null>;
  ventaIds(noticeId: string): Promise<string[]>;
  claim(noticeId: string, action: NoticeReplyAction, inboundWaMessageId: string): Promise<boolean>;
  declineVentas(ventaIds: string[], at: string): Promise<void>;
  finish(noticeId: string, action: NoticeReplyAction, result: 'accepted' | 'failed'): Promise<void>;
};

function check(error: { code?: string } | null, operation: string): void {
  if (error) throw new Error(`Notice reply store ${operation} failed: ${error.code ?? 'unknown'}`);
}

export function createNoticeReplyStore(client: ServiceClient = createServiceRoleClient()): NoticeReplyStore {
  return {
    async findNotice(id) {
      const { data, error } = await client.from('whatsapp_notices').select('*').eq('id', id).maybeSingle();
      check(error, 'find notice');
      return data;
    },
    async ventaIds(noticeId) {
      const { data, error } = await client.from('whatsapp_notice_ventas').select('venta_id').eq('notice_id', noticeId);
      check(error, 'load sales');
      return (data ?? []).map((row) => row.venta_id);
    },
    async claim(noticeId, action, inboundWaMessageId) {
      const { error } = await client.from('whatsapp_notice_replies').insert({
        notice_id: noticeId, action, inbound_wa_message_id: inboundWaMessageId,
      });
      if (error?.code === '23505') return false;
      check(error, 'claim action');
      return true;
    },
    async declineVentas(ventaIds, at) {
      const { error } = await client.from('ventas').update({
        respuesta_cliente: 'no_continuar', respuesta_cliente_at: at,
      }).in('id', ventaIds);
      check(error, 'decline sales');
    },
    async finish(noticeId, action, result) {
      const { error } = await client.from('whatsapp_notice_replies').update({
        result, handled_at: new Date().toISOString(),
      }).eq('notice_id', noticeId).eq('action', action);
      check(error, 'finish action');
    },
  };
}
