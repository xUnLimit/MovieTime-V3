import { Repeat, UserRound } from "lucide-react";

import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";

const cicloOptions = [
  { value: "todos", label: "Todos los ciclos" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const perfilOptions = [
  { value: "todos", label: "Todos los perfiles" },
  { value: "con_disponibles", label: "Con perfiles disponibles" },
  { value: "sin_disponibles", label: "Sin perfiles disponibles" },
];

interface ServiciosCategoriaTableDetalleToolbarProps {
  cicloFilter: string;
  onCicloChange: (value: string) => void;
  onPerfilChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  perfilFilter: string;
  searchTerm: string;
}

export function ServiciosCategoriaTableDetalleToolbar({
  cicloFilter,
  onCicloChange,
  onPerfilChange,
  onSearchChange,
  perfilFilter,
  searchTerm,
}: ServiciosCategoriaTableDetalleToolbarProps) {
  return (
    <TableToolbar>
      <TableSearch value={searchTerm} onChange={onSearchChange} placeholder="Buscar por nombre o email..." />
      <FilterMenu icon={Repeat} ariaLabel="Ciclo de pago" value={cicloFilter} options={cicloOptions} onChange={onCicloChange} />
      <FilterMenu icon={UserRound} ariaLabel="Perfiles" value={perfilFilter} options={perfilOptions} onChange={onPerfilChange} />
    </TableToolbar>
  );
}
