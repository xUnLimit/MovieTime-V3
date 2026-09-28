"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchTemplatesUseCase } from "@/application/use-cases/templates-use-cases";
import {
  listMetaTemplatesUseCase,
  syncMetaTemplatesUseCase,
} from "@/application/use-cases/whatsapp-meta-template-use-cases";
import { queryKeys } from "@/platform/query-keys";

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: fetchTemplatesUseCase,
  });
}

// Cache de plantillas de Meta (texto, estado y botones sincronizados).
export function useMetaTemplates() {
  return useQuery({
    queryKey: queryKeys.whatsapp.metaTemplates(),
    queryFn: listMetaTemplatesUseCase,
  });
}

export function useSyncMetaTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncMetaTemplatesUseCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.metaTemplates() }),
  });
}
