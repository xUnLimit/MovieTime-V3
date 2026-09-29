import { Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { MetricCard } from "@/components/shared/MetricCard";
import { MetricGrid } from "@/components/shared/MetricGrid";
import { PageHeader } from "@/components/shared/PageHeader";
import { TableCard } from "@/components/shared/TableCard";
import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ReposoTable } from "./ReposoTable";
import { getReposoMetrics, type ReposoServicio } from "./reposo-helpers";

const ESTADO_REPOSO_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "en_proceso", label: "En proceso" },
  { value: "proximo_finalizar", label: "Por finalizar" },
  { value: "completado", label: "Completado" },
];

export function ReposoPageHeader() {
  return (
    <PageHeader
      title="Servicios en Reposo"
    />
  );
}

export function ServiciosReposoMetrics({ servicios }: { servicios: ReposoServicio[] }) {
  const { completados, enProceso, proximosFinalizar } = getReposoMetrics(servicios);

  return (
    <MetricGrid>
      <MetricCard
        title="En Proceso"
        value={enProceso}
        icon={Clock}
        tone="info"
      />
      <MetricCard
        title="Próximos a Finalizar"
        value={proximosFinalizar}
        icon={AlertTriangle}
        tone="warning"
      />
      <MetricCard
        title="Completados"
        value={completados}
        icon={CheckCircle2}
        tone="success"
      />
    </MetricGrid>
  );
}

export function ReposoTableCard({
  search,
  estadoFilter,
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
  isLoading: boolean;
  servicios: ReposoServicio[];
  onSearchChange: (value: string) => void;
  onEstadoFilterChange: (value: string) => void;
  onActivate: (servicio: ReposoServicio) => void;
  onRenew: (servicio: ReposoServicio) => void;
  onDelete: (servicio: ReposoServicio) => void;
}) {
  return (
    <TableCard
      title="Servicios en reposo"
      toolbar={
        <TableToolbar>
          <TableSearch value={search} onChange={onSearchChange} placeholder="Buscar por nombre o email..." />
          <FilterMenu
            icon={Activity}
            ariaLabel="Estado"
            value={estadoFilter}
            options={ESTADO_REPOSO_OPTIONS}
            onChange={onEstadoFilterChange}
          />
        </TableToolbar>
      }
    >
      <ReposoTable
        isLoading={isLoading}
        servicios={servicios}
        onActivate={onActivate}
        onRenew={onRenew}
        onDelete={onDelete}
      />
    </TableCard>
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
