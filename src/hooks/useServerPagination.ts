'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { getPaginated, getCount, FilterOption } from '@/lib/supabase/pagination';

interface UseServerPaginationOptions {
  collectionName: string;
  filters: FilterOption[];
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  enabled?: boolean;
  includeTotalCount?: boolean;
}

interface PaginationState {
  signature: string;
  pageIndex: number;
  cursors: (number | undefined)[];
}

/**
 * Hook para paginación server-side con cursores.
 * Solo trae pageSize docs por página desde Supabase.
 * Se resetea automáticamente cuando cambian los filtros.
 */
export function useServerPagination<T>({
  collectionName,
  filters,
  pageSize = 10,
  orderByField,
  orderDirection,
  enabled = true,
  includeTotalCount = false,
}: UseServerPaginationOptions) {
  const queryClient = useQueryClient();
  const filtersKey = JSON.stringify(filters);
  const orderKey = `${orderByField}:${orderDirection}`;
  const paginationSignature = `${filtersKey}:${pageSize}:${orderKey}`;
  const [paginationState, setPaginationState] = useState<PaginationState>(() => ({
    signature: paginationSignature,
    pageIndex: 0,
    cursors: [undefined],
  }));

  const signatureChanged = paginationState.signature !== paginationSignature;
  if (signatureChanged) {
    setPaginationState({
      signature: paginationSignature,
      pageIndex: 0,
      cursors: [undefined],
    });
  }

  const effectivePageIndex = signatureChanged ? 0 : paginationState.pageIndex;
  const effectiveCursors = signatureChanged ? [undefined] : paginationState.cursors;

  const queryKey = useMemo(
    () =>
      queryKeys.pagination.page(
        collectionName,
        filtersKey,
        pageSize,
        effectivePageIndex,
        orderKey,
        includeTotalCount,
      ),
    [
      collectionName,
      effectivePageIndex,
      filtersKey,
      includeTotalCount,
      orderKey,
      pageSize,
    ],
  );

  const { data: pageResult, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const [result, count] = await Promise.all([
        getPaginated<T>(collectionName, {
          pageSize,
          startAfterDoc: effectiveCursors[effectivePageIndex],
          filters,
          orderByField,
          orderDirection,
        }),
        includeTotalCount
          ? getCount(collectionName, filters)
          : Promise.resolve<number | null>(null),
      ]);

      return { result, count };
    },
    enabled,
    retry: 1,
  });

  const data = enabled ? pageResult?.result.docs ?? [] : [];
  const totalCount = enabled ? pageResult?.count ?? null : null;
  const totalPagesFromCount =
    totalCount === null ? null : Math.max(1, Math.ceil(totalCount / pageSize));
  const hasMore = !enabled
    ? false
    : totalPagesFromCount === null
      ? pageResult?.result.hasMore ?? false
      : effectivePageIndex + 1 < totalPagesFromCount;

  const totalPages =
    totalCount === null
      ? Math.max(1, hasMore ? effectivePageIndex + 2 : effectivePageIndex + 1)
      : Math.max(1, Math.ceil(totalCount / pageSize));

  const next = useCallback(() => {
    setPaginationState((current) => {
      const cursors = current.signature === paginationSignature ? [...current.cursors] : [undefined];
      const lastDoc = pageResult?.result.lastDoc;
      if (typeof lastDoc === 'number') {
        cursors[effectivePageIndex + 1] = lastDoc;
      }

      return {
        signature: paginationSignature,
        pageIndex: effectivePageIndex + 1,
        cursors,
      };
    });
  }, [effectivePageIndex, pageResult?.result.lastDoc, paginationSignature]);
  const previous = useCallback(() => {
    setPaginationState((current) => ({
      signature: paginationSignature,
      pageIndex: Math.max(0, effectivePageIndex - 1),
      cursors: current.signature === paginationSignature ? current.cursors : [undefined],
    }));
  }, [effectivePageIndex, paginationSignature]);
  const refresh = useCallback(() => {
    setPaginationState({
      signature: paginationSignature,
      pageIndex: 0,
      cursors: [undefined],
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.pagination.all });
  }, [paginationSignature, queryClient]);

  return {
    data,
    isLoading: enabled ? isLoading || isFetching : false,
    hasMore,
    page: effectivePageIndex + 1,
    totalCount,
    totalPages,
    hasPrevious: effectivePageIndex > 0,
    next,
    previous,
    refresh,
  };
}
