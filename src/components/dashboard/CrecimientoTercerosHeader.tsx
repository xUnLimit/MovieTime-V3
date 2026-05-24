import { CalendarClock, Check, ChevronLeft, ChevronRight } from "lucide-react";

import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

interface CrecimientoTercerosHeaderProps {
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

export function CrecimientoTercerosHeader({
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
}: CrecimientoTercerosHeaderProps) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-2 pt-3 pb-2 px-6">
      <div className="space-y-0.5 min-w-0">
        <CardTitle className="text-base">{vista.title}</CardTitle>
        <CardDescription className="text-sm">
          {getVistaDescription(vista.id, selectedPeriod)}
        </CardDescription>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {vista.id === "crecimiento" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-[140px] justify-between gap-2 text-xs font-normal"
              >
                <FilterTriggerContent
                  icon={CalendarClock}
                  label={selectedPeriodLabel}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
              {PERIOD_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => setSelectedPeriod(option.value)}
                  className="dashboard-toolbar-menu-item text-xs"
                >
                  <span className="dashboard-toolbar-menu-item-label">
                    {option.label}
                  </span>
                  {selectedPeriod === option.value && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="text-[11px] tabular-nums text-muted-foreground px-1">
          {vistaIndex + 1}/{totalVistas}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => navegar(-1)}
          disabled={!puedeIrAtras || isLoading || !animacionIdle}
          aria-label="Vista anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => navegar(1)}
          disabled={!puedeIrAdelante || isLoading || !animacionIdle}
          aria-label="Vista siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );
}

function getVistaDescription(
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
