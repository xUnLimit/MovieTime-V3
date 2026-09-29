import { CreditCard } from 'lucide-react';

import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import type { MetodoPagoFilterOption } from './todos-terceros-table-types';

interface TodosTercerosTableToolbarProps {
  metodoPagoFilter: string;
  metodoPagoOptions: MetodoPagoFilterOption[];
  onMetodoPagoFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
}

export function TodosTercerosTableToolbar({
  metodoPagoFilter,
  metodoPagoOptions,
  onMetodoPagoFilterChange,
  onSearchChange,
  searchQuery,
}: TodosTercerosTableToolbarProps) {
  return (
    <TableToolbar>
      <TableSearch value={searchQuery} onChange={onSearchChange} placeholder="Buscar por nombre o teléfono..." />
      <FilterMenu
        icon={CreditCard}
        ariaLabel="Método de pago"
        value={metodoPagoFilter}
        options={metodoPagoOptions}
        onChange={onMetodoPagoFilterChange}
      />
    </TableToolbar>
  );
}
