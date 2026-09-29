import { Activity } from 'lucide-react';

import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';

import { ESTADO_FILTER_OPTIONS } from './helpers';

interface ServiciosProximosToolbarProps {
  searchQuery: string;
  estadoFilter: string;
  onSearchChange: (value: string) => void;
  onEstadoFilterChange: (value: string) => void;
}

export function ServiciosProximosToolbar({
  searchQuery,
  estadoFilter,
  onSearchChange,
  onEstadoFilterChange,
}: ServiciosProximosToolbarProps) {
  return (
    <TableToolbar>
      <TableSearch value={searchQuery} onChange={onSearchChange} placeholder="Buscar por categoría o email..." />
      <FilterMenu
        icon={Activity}
        ariaLabel="Estado"
        value={estadoFilter}
        options={ESTADO_FILTER_OPTIONS}
        onChange={onEstadoFilterChange}
      />
    </TableToolbar>
  );
}
