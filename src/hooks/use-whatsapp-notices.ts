"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getVentaNoticeStatusUseCase,
  sendWhatsAppNoticesUseCase,
} from "@/application/use-cases/whatsapp-notices-use-cases";
import { queryKeys } from "@/platform/query-keys";

export function useSendNotices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendWhatsAppNoticesUseCase,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.noticeStatus() }),
  });
}

// Ultimo aviso por venta y respuesta "no desea continuar".
export function useVentaNoticeStatus(ventaIds: string[]) {
  const ids = [...new Set(ventaIds)].sort();
  return useQuery({
    queryKey: queryKeys.whatsapp.noticeStatus(ids),
    queryFn: () => getVentaNoticeStatusUseCase(ids),
    enabled: ids.length > 0,
    staleTime: 15_000,
  });
}
