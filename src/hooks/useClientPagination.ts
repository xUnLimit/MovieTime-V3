'use client';

import { useCallback, useMemo, useState } from 'react';

interface UseClientPaginationOptions<T> {
  data: T[];
  initialPageSize?: number;
}

export function useClientPagination<T>({
  data,
  initialPageSize = 10,
}: UseClientPaginationOptions<T>) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);

  const paginatedData = useMemo(() => {
    const startIndex = safePageIndex * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, safePageIndex, pageSize]);

  const next = useCallback(() => {
    setPageIndex((current) => Math.min(totalPages - 1, current + 1));
  }, [totalPages]);

  const previous = useCallback(() => {
    setPageIndex((current) => Math.max(0, current - 1));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageIndex(0);
  }, []);

  const reset = useCallback(() => {
    setPageIndex(0);
  }, []);

  return {
    data: paginatedData,
    page: safePageIndex + 1,
    totalPages,
    hasPrevious: safePageIndex > 0,
    hasMore: safePageIndex + 1 < totalPages,
    pageSize,
    setPageSize,
    next,
    previous,
    reset,
  };
}
