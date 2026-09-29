import { Activity } from "lucide-react";

import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";
import { ESTADO_REPOSO_OPTIONS } from "./reposo-notificaciones-table-types";

interface ReposoNotificacionesToolbarProps {
  estadoFilter: string;
  onEstadoFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  search: string;
}

export function ReposoNotificacionesToolbar({
  estadoFilter,
  onEstadoFilterChange,
  onSearchChange,
  search,
}: ReposoNotificacionesToolbarProps) {
  return (
    <TableToolbar>
      <TableSearch value={search} onChange={onSearchChange} placeholder="Buscar por categoría o correo..." />
      <FilterMenu
        icon={Activity}
        ariaLabel="Estado"
        value={estadoFilter}
        options={ESTADO_REPOSO_OPTIONS}
        onChange={onEstadoFilterChange}
      />
    </TableToolbar>
  );
}
