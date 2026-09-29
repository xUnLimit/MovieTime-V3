import { Activity, MessageSquare } from 'lucide-react';

import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import { Button } from '@/components/ui/button';

import { ESTADO_FILTER_OPTIONS } from './helpers';

interface VentasProximasToolbarProps {
  searchQuery: string;
  estadoFilter: string;
  onSearchChange: (value: string) => void;
  onEstadoFilterChange: (value: string) => void;
  selectedCount?: number;
  isNotifying?: boolean;
  onNotifySelected?: () => void;
  onClearSelection?: () => void;
}

export function VentasProximasToolbar({
  searchQuery,
  estadoFilter,
  onSearchChange,
  onEstadoFilterChange,
  selectedCount = 0,
  isNotifying = false,
  onNotifySelected,
  onClearSelection,
}: VentasProximasToolbarProps) {
  return (
    <TableToolbar
      actions={
        selectedCount > 0 && onNotifySelected ? (
          <>
            <Button type="button" disabled={isNotifying} onClick={onNotifySelected}>
              <MessageSquare />
              {isNotifying ? 'Enviando...' : `Notificar seleccionados (${selectedCount})`}
            </Button>
            <Button type="button" variant="ghost" disabled={isNotifying} onClick={onClearSelection}>
              Limpiar
            </Button>
          </>
        ) : undefined
      }
    >
      <TableSearch value={searchQuery} onChange={onSearchChange} placeholder="Buscar por cliente o categoría..." />
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
