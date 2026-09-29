import { CalendarClock, Check } from "lucide-react";

import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { PagerControls } from "@/components/shared/PagerControls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  PERIOD_OPTIONS,
  type CrecimientoVista,
} from "./crecimiento-terceros-config";
import type { CrecimientoPeriod } from "./crecimiento-terceros-helpers";

interface CrecimientoTercerosControlsProps {
  animacionIdle: boolean;
  isLoading: boolean;
  puedeIrAdelante: boolean;
  puedeIrAtras: boolean;
  selectedPeriod: CrecimientoPeriod;
  selectedPeriodLabel: string;
  totalVistas: number;
  vista: CrecimientoVista;
  vistaIndex: number;
  navegar: (direction: 1 | -1) => void;
  setSelectedPeriod: (period: CrecimientoPeriod) => void;
}

/** Acciones del encabezado del panel: filtro de periodo (solo en crecimiento) y paginador de vistas. */
export function CrecimientoTercerosControls({
  animacionIdle,
  isLoading,
  puedeIrAdelante,
  puedeIrAtras,
  selectedPeriod,
  selectedPeriodLabel,
  totalVistas,
  vista,
  vistaIndex,
  navegar,
  setSelectedPeriod,
}: CrecimientoTercerosControlsProps) {
  return (
    <>
      {vista.id === "crecimiento" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-[150px] justify-between gap-2 font-normal"
            >
              <FilterTriggerContent icon={CalendarClock} label={selectedPeriodLabel} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="dashboard-toolbar-menu">
            {PERIOD_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => setSelectedPeriod(option.value)}
                className="dashboard-toolbar-menu-item"
              >
                <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
                {selectedPeriod === option.value && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <PagerControls
        index={vistaIndex}
        total={totalVistas}
        onPrevious={() => navegar(-1)}
        onNext={() => navegar(1)}
        previousDisabled={!puedeIrAtras || isLoading || !animacionIdle}
        nextDisabled={!puedeIrAdelante || isLoading || !animacionIdle}
      />
    </>
  );
}

export function getVistaDescription(
  vistaId: CrecimientoVista["id"],
  selectedPeriod: CrecimientoPeriod,
) {
  if (vistaId === "crecimiento") {
    return selectedPeriod === "actual"
      ? "Clientes y revendedores nuevos por dia en el mes actual."
      : "Clientes y revendedores nuevos por mes.";
  }
  if (vistaId === "bajas") {
    return "Clientes que perdieron su ultimo servicio por mes.";
  }
  return "Terceros ganados frente a bajas registradas por mes.";
}
