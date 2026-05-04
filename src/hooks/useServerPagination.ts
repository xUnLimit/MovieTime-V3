'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { getPaginated, FilterOption } from '@/lib/firebase/pagination';

interface UseServerPaginationOptions {
  collectionName: string;
  filters: FilterOption[];
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  realtime?: boolean; // Nuevo parámetro para activar listeners en tiempo real
}

/**
 * Hook para paginación server-side con cursores.
 * Solo trae pageSize docs por página desde Firestore.
 * Se resetea automáticamente cuando cambian los filtros.
 */
export function useServerPagination<T>({
  collectionName,
  filters,
  pageSize = 10,
  orderByField,
  orderDirection,
}: UseServerPaginationOptions) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const cursorsRef = useRef<(QueryDocumentSnapshot<DocumentData> | undefined)[]>([undefined]);
  const prevFiltersRef = useRef(JSON.stringify(filters));

  const filtersKey = JSON.stringify(filters);
  const prevPageSizeRef = useRef(pageSize);

  const prevOrderRef = useRef(`${orderByField}:${orderDirection}`);
  const orderKey = `${orderByField}:${orderDirection}`;

  useEffect(() => {
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
        const result = await getPaginated<T>(collectionName, {
          pageSize,
          startAfterDoc: cursorsRef.current[currentPageIndex],
          filters,
          orderByField,
          orderDirection,
        });
        if (!cancelled) {
          setData(result.docs);
          setHasMore(result.hasMore);
          if (result.lastDoc) {
            cursorsRef.current[currentPageIndex + 1] = result.lastDoc;
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching page:', error);
          setData([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPage();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, filtersKey, pageSize, refreshKey, orderKey]);

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
    hasPrevious: pageIndex > 0,
    next,
    previous,
    refresh,
  };
}
