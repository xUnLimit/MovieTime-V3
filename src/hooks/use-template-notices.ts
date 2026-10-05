'use client';

import { useCallback, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listRecentNoticesUseCase, loadNoticeActivityUseCase } from '@/application/use-cases/automation-use-cases';
import type { TipoActivity } from '@/modules/messaging/automation-activity';
import { queryKeys } from '@/platform/query-keys';
import type { RecentNoticeFilters, RecentNoticePage } from '@/types/automation';

const NO_ACTIVITY: Record<string, TipoActivity> = {};

export type NoticeActivityApi = {
  loading: boolean;
  failed: boolean;
  /** Conteos de los ultimos 30 dias por tipo; un tipo sin avisos no aparece. */
  byTipo: Record<string, TipoActivity>;
  retry: () => void;
};

/** Actividad de 30 dias de cada plantilla (enviados, fallidos, omitidos y ultimo envio). */
export function useNoticeActivity(): NoticeActivityApi {
  const query = useQuery({ queryKey: queryKeys.whatsapp.noticeActivity(), queryFn: () => loadNoticeActivityUseCase(), retry: false });
  const { refetch } = query;
  const retry = useCallback(() => { void refetch(); }, [refetch]);
  return { loading: query.isLoading, failed: query.isError, byTipo: query.data ?? NO_ACTIVITY, retry };
}

export type RecentNoticesApi = {
  loading: boolean;
  error: string | null;
  data: RecentNoticePage | null;
  filters: RecentNoticeFilters;
  /** Cambiar un filtro vuelve a la primera pagina. */
  setFilters: (filters: RecentNoticeFilters) => void;
  setPage: (page: number) => void;
  retry: () => void;
};

/**
 * Historial de envios paginado en el servidor. Los filtros y la pagina viven aqui para que sobrevivan al cambio de
 * pestaña; `enabled` evita consultar mientras la tabla no se mira.
 */
export function useRecentNotices({ enabled = true }: { enabled?: boolean } = {}): RecentNoticesApi {
  const [page, setPage] = useState(1);
  const [filters, setFiltersState] = useState<RecentNoticeFilters>({});
  const query = useQuery({
    queryKey: queryKeys.whatsapp.recentNotices(page, filters.tipo ?? '', filters.status ?? ''),
    queryFn: () => listRecentNoticesUseCase(page, filters),
    placeholderData: keepPreviousData,
    retry: false,
    enabled,
  });

  const setFilters = useCallback((next: RecentNoticeFilters) => { setFiltersState(next); setPage(1); }, []);
  const { refetch } = query;
  const retry = useCallback(() => { void refetch(); }, [refetch]);

  return {
    loading: query.isLoading,
    error: query.isError ? 'No se pudo cargar el historial de envíos. Inténtalo de nuevo.' : null,
    data: query.data ?? null,
    filters,
    setFilters,
    setPage,
    retry,
  };
}
