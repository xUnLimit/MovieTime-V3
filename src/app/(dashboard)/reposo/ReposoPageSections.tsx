import Link from "next/link";
import { Activity, AlertTriangle, Check, CheckCircle2, Clock, Search } from "lucide-react";

import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReposoTable } from "./ReposoTable";
import { getReposoMetrics, type ReposoServicio } from "./reposo-helpers";

const ESTADO_REPOSO_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "en_proceso", label: "En proceso" },
  { value: "proximo_finalizar", label: "Por finalizar" },
  { value: "completado", label: "Completado" },
];

export function getEstadoReposoLabel(estadoFilter: string) {
  return ESTADO_REPOSO_OPTIONS.find((option) => option.value === estadoFilter)?.label ?? "Todos los estados";
}

export function ReposoPageHeader() {
  return (
    <div className="space-y-1">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Servicios en Reposo</h1>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/" className="transition-colors hover:text-foreground">
            Dashboard
          </Link>{" "}
          / <span className="text-foreground">Servicios en Reposo</span>
        </p>
      </div>
    </div>
  );
}

export function ServiciosReposoMetrics({ servicios }: { servicios: ReposoServicio[] }) {
  const { completados, enProceso, proximosFinalizar } = getReposoMetrics(servicios);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricCard
        title="En Proceso"
        value={enProceso}
        icon={Clock}
        iconColor="text-blue-500"
        underlineColor="bg-blue-500"
      />
      <MetricCard
        title="Próximos a Finalizar"
        value={proximosFinalizar}
        icon={AlertTriangle}
        iconColor="text-yellow-500"
        underlineColor="bg-yellow-500"
      />
      <MetricCard
        title="Completados"
        value={completados}
        icon={CheckCircle2}
        iconColor="text-green-500"
        underlineColor="bg-green-500"
      />
    </div>
  );
}

export function ReposoTableCard({
  search,
  estadoFilter,
  estadoFilterLabel,
  isLoading,
  servicios,
  onSearchChange,
  onEstadoFilterChange,
  onActivate,
  onRenew,
  onDelete,
}: {
  search: string;
  estadoFilter: string;
  estadoFilterLabel: string;
  isLoading: boolean;
  servicios: ReposoServicio[];
  onSearchChange: (value: string) => void;
  onEstadoFilterChange: (value: string) => void;
  onActivate: (servicio: ReposoServicio) => void;
  onRenew: (servicio: ReposoServicio) => void;
  onDelete: (servicio: ReposoServicio) => void;
}) {
  return (
    <Card className="p-4 pb-2">
      <h3 className="text-xl font-semibold">Servicios en reposo</h3>
      <div className="-mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between gap-2 font-normal sm:w-[180px]">
              <FilterTriggerContent icon={Activity} label={estadoFilterLabel} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
            {ESTADO_REPOSO_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => onEstadoFilterChange(option.value)}
                className="dashboard-toolbar-menu-item"
              >
                <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
                {estadoFilter === option.value && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ReposoTable
        isLoading={isLoading}
        servicios={servicios}
        onActivate={onActivate}
        onRenew={onRenew}
        onDelete={onDelete}
      />
    </Card>
  );
}

export function DeleteReposoPaymentsOption({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start space-x-2">
      <Checkbox
        id="delete-payments-reposo"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value as boolean)}
      />
      <div className="grid gap-1.5 leading-none">
        <Label
          htmlFor="delete-payments-reposo"
          className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Eliminar también los registros de pago
        </Label>
        <p className="text-sm text-muted-foreground">
          Al marcar esta opción, se eliminarán todos los registros de pago de la base de datos. Si no se marca, se
          conservarán para historial.
        </p>
      </div>
    </div>
  );
}
