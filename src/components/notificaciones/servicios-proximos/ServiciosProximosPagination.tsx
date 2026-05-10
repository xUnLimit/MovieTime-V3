import { PaginationFooter } from '@/components/shared/PaginationFooter';

import { ITEMS_PER_PAGE_OPTIONS } from './helpers';

interface ServiciosProximosPaginationProps {
  itemsPerPage: number;
  safeCurrentPage: number;
  totalPages: number;
  onItemsPerPageChange: (value: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function ServiciosProximosPagination({
  itemsPerPage,
  safeCurrentPage,
  totalPages,
  onItemsPerPageChange,
  onPreviousPage,
  onNextPage,
}: ServiciosProximosPaginationProps) {
  return (
    <PaginationFooter
      page={safeCurrentPage}
      totalPages={totalPages}
      hasPrevious={safeCurrentPage > 1}
      hasMore={safeCurrentPage < totalPages}
      onPrevious={onPreviousPage}
      onNext={onNextPage}
      pageSize={itemsPerPage}
      onPageSizeChange={(size) => onItemsPerPageChange(size.toString())}
      pageSizeOptions={ITEMS_PER_PAGE_OPTIONS}
      className="px-2 py-2"
    />
  );
}
