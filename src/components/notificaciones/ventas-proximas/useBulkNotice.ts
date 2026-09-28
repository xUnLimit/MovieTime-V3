'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useSendNotices } from '@/hooks/use-whatsapp-notices';
import type { NoticeResult } from '@/platform/api/whatsapp-notices-client';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';

import { openWhatsApp } from '@/platform/utils/whatsapp';

import { groupNotificationsByTipo, noticeTipoFor, resolveResultWaMe, type RuleTipo } from './notice-helpers';
import type { NotificacionVentaConId } from './types';

interface UseBulkNoticeParams {
  /** Notificaciones filtradas (todas las paginas): la seleccion sobrevive al cambio de pagina. */
  notificaciones: NotificacionVentaConId[];
  /** Notificaciones visibles en la pagina actual (para "seleccionar todo"). */
  pageNotificaciones: NotificacionVentaConId[];
  /** Respaldo wa.me para una venta (flujo existente). */
  onOpenWhatsApp: (notif: NotificacionVentaConId) => boolean | Promise<boolean>;
  /** Texto libre del tipo, para armar el respaldo wa.me de un resultado agrupado. */
  getContenido?: (tipo: RuleTipo) => string | undefined;
}

export function useBulkNotice({ notificaciones, pageNotificaciones, onOpenWhatsApp, getContenido }: UseBulkNoticeParams) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [results, setResults] = useState<NoticeResult[] | null>(null);
  const sendNotices = useSendNotices();

  const selected = useMemo(
    () => notificaciones.filter((notif) => selectedIds.has(notif.id)),
    [notificaciones, selectedIds],
  );

  const toggleSelected = useCallback((notifId: string, isSelected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isSelected) next.add(notifId); else next.delete(notifId);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback((isSelected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const notif of pageNotificaciones) {
        if (isSelected) next.add(notif.id); else next.delete(notif.id);
      }
      return next;
    });
  }, [pageNotificaciones]);

  const notifySelected = async () => {
    if (selected.length === 0) return;
    const collected: NoticeResult[] = [];
    for (const group of groupNotificationsByTipo(selected)) {
      try {
        collected.push(...await sendNotices.mutateAsync(group));
      } catch (error) {
        toast.error('No se pudo enviar por la API', {
          description: getPublicErrorMessage(error, 'Puedes abrirlos en WhatsApp.'),
        });
        for (const ventaId of group.ventaIds) {
          const notif = selected.find((item) => item.ventaId === ventaId);
          collected.push({
            noticeId: null,
            clienteNombre: notif?.clienteNombre ?? 'Cliente',
            ventaIds: [ventaId],
            status: 'failed',
            channel: null,
            waId: null,
            error: 'No se pudo contactar al servidor',
          });
        }
      }
    }
    setResults(collected);
    setSelectedIds(new Set());
  };

  const openResultWhatsApp = async (result: NoticeResult) => {
    const notif = selected.find((item) => result.ventaIds.includes(item.ventaId))
      ?? notificaciones.find((item) => result.ventaIds.includes(item.ventaId));
    const resolved = resolveResultWaMe(result, notificaciones, notif ? getContenido?.(noticeTipoFor(notif.diasRestantes)) : undefined);
    if (resolved) {
      openWhatsApp(resolved.phone, resolved.text);
      return;
    }
    if (notif) await onOpenWhatsApp(notif);
  };

  return {
    selectedIds,
    selectedCount: selected.length,
    isSending: sendNotices.isPending,
    results,
    toggleSelected,
    toggleAllOnPage,
    clearSelection: () => setSelectedIds(new Set()),
    notifySelected,
    openResultWhatsApp,
    closeSummary: () => setResults(null),
  };
}
