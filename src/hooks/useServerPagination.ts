'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const cursorsRef = useRef<(number | undefined)[]>([undefined]);
  const prevFiltersRef = useRef(JSON.stringify(filters));

  const filtersKey = JSON.stringify(filters);
  const prevPageSizeRef = useRef(pageSize);

  const prevOrderRef = useRef(`${orderByField}:${orderDirection}`);
  const orderKey = `${orderByField}:${orderDirection}`;

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setHasMore(false);
      setTotalCount(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let currentPageIndex = pageIndex;

    // Reset paginación si cambian los filtros, el pageSize o el orden
    const filtersChanged = prevFiltersRef.current !== filtersKey;
    const pageSizeChanged = prevPageSizeRef.current !== pageSize;
    const orderChanged = prevOrderRef.current !== orderKey;

    if (filtersChanged || pageSizeChanged || orderChanged) {
      prevFiltersRef.current = filtersKey;
      prevPageSizeRef.current = pageSize;
      prevOrderRef.current = orderKey;
      cursorsRef.current = [undefined];
      currentPageIndex = 0;
      if (pageIndex !== 0) {
        setPageIndex(0);
        return; // el cambio de pageIndex dispara otra ejecución
      }
    }

    const fetchPage = async () => {
      setIsLoading(true);
      try {
        const [result, count] = await Promise.all([
          getPaginated<T>(collectionName, {
            pageSize,
            startAfterDoc: cursorsRef.current[currentPageIndex],
            filters,
            orderByField,
            orderDirection,
          }),
          includeTotalCount
            ? getCount(collectionName, filters)
            : Promise.resolve<number | null>(null),
        ]);
        if (!cancelled) {
          const totalPagesFromCount =
            count === null ? null : Math.max(1, Math.ceil(count / pageSize));

          setData(result.docs);
          setTotalCount(count);
          setHasMore(
            totalPagesFromCount === null
              ? result.hasMore
              : currentPageIndex + 1 < totalPagesFromCount
          );
          if (result.lastDoc) {
            cursorsRef.current[currentPageIndex + 1] = result.lastDoc;
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching page:', error);
          setData([]);
          setTotalCount(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPage();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, filtersKey, pageSize, refreshKey, orderKey, enabled, includeTotalCount]);

  const totalPages =
    totalCount === null
      ? Math.max(1, hasMore ? pageIndex + 2 : pageIndex + 1)
      : Math.max(1, Math.ceil(totalCount / pageSize));

  const next = useCallback(() => setPageIndex(p => p + 1), []);
  const previous = useCallback(() => setPageIndex(p => Math.max(0, p - 1)), []);
  const refresh = useCallback(() => {
    // Reset cursors and go back to first page
    cursorsRef.current = [undefined];
    setPageIndex(0);
    setRefreshKey(k => k + 1);
  }, []);

  return {
    data,
    isLoading,
    hasMore,
    page: pageIndex + 1,
    totalCount,
    totalPages,
    hasPrevious: pageIndex > 0,
    next,
    previous,
    refresh,
  };
}
