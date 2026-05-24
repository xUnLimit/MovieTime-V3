"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Activity,
  Check,
  CheckCircle2,
  Clock,
  Search,
} from "lucide-react";

import { MetricCard } from "@/components/shared/MetricCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FilterTriggerContent } from "@/components/shared/FilterTriggerContent";
import { ModuleErrorBoundary } from "@/components/shared/ModuleErrorBoundary";
import { PagoDialog, type EnrichedPagoDialogFormData } from "@/components/shared/PagoDialog";
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
import { queryKeys } from "@/lib/query-keys";
import { queryNotifications } from "@/lib/supabase/notifications-repository";
import { renewServicioUseCase } from "@/lib/use-cases/servicios-use-cases";
import { useNotificacionesStore } from "@/store/notificacionesStore";
import { useServiciosStore } from "@/store/serviciosStore";
import type { Servicio } from "@/types/servicios";
import { toast } from "sonner";
import { ReposoTable } from "./ReposoTable";
import {
  fetchReposoServicesQuery,
  fetchServicioMetodosPagoQuery,
  filterReposoServicios,
  getReposoMetrics,
  type ReposoServicio,
} from "./reposo-helpers";

function ServiciosReposoMetrics({ servicios }: { servicios: ReposoServicio[] }) {
  const { completados, enProceso, proximosFinalizar } =
    getReposoMetrics(servicios);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

function ReposoPageContent() {
  const queryClient = useQueryClient();
  const { updateServicio, deleteServicio } = useServiciosStore();
  const deleteNotificacion = useNotificacionesStore((state) => state.deleteNotificacion);

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [activarDialogOpen, setActivarDialogOpen] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePayments, setDeletePayments] = useState(false);
  const [selectedServicio, setSelectedServicio] =
    useState<ReposoServicio | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const estadoOptions = [
    { value: "all", label: "Todos los estados" },
    { value: "en_proceso", label: "En proceso" },
    { value: "proximo_finalizar", label: "Por finalizar" },
    { value: "completado", label: "Completado" },
  ];
  const estadoFilterLabel =
    estadoOptions.find((option) => option.value === estadoFilter)?.label ?? "Todos los estados";
  const {
    data: serviciosReposo = [],
    isLoading,
  } = useQuery({
    queryKey: queryKeys.servicios.reposo(),
    queryFn: fetchReposoServicesQuery,
  });
  const { data: metodosPago = [] } = useQuery({
    queryKey: queryKeys.metodosPago.servicios(),
    queryFn: fetchServicioMetodosPagoQuery,
    enabled: renovarDialogOpen,
  });

  const filteredServicios = useMemo(
    () =>
      filterReposoServicios({
        estadoFilter,
        search,
        servicios: serviciosReposo,
      }),
    [serviciosReposo, search, estadoFilter],
  );

  const limpiarNotificacionesReposo = async (servicioId: string) => {
    try {
      const notifs = await queryNotifications<{ id: string }>([
        { field: "entidad", operator: "==", value: "reposo" },
        { field: "servicioId", operator: "==", value: servicioId },
      ]);
      await Promise.all(
        notifs.map((n) => deleteNotificacion(n.id)),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
    } catch {
      // Best-effort cleanup
    }
  };

  const invalidateReposoDependencies = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
    ]);
  };

  const handleActivar = async () => {
    if (!selectedServicio) return;
    setIsActivating(true);
    try {
      await updateServicio(selectedServicio.id, {
        ...selectedServicio,
        activo: true,
        enReposo: false,
        diasReposo: undefined,
        fechaInicioReposo: undefined,
        fechaFinReposo: undefined,
      });
      await Promise.all([
        invalidateReposoDependencies(),
        limpiarNotificacionesReposo(selectedServicio.id),
      ]);
      toast.success("Servicio activado", {
        description: `${selectedServicio.nombre} ha sido activado exitosamente.`,
      });
      setActivarDialogOpen(false);
      setSelectedServicio(null);
    } catch (error) {
      toast.error("Error al activar servicio", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsActivating(false);
    }
  };

  const handleActivarYRenovar = async (
    pagoData: EnrichedPagoDialogFormData,
  ) => {
    if (!selectedServicio) return;
    try {
      const notaPrincipal = pagoData.notas?.trim() ?? '';

      await updateServicio(selectedServicio.id, {
        ...selectedServicio,
        activo: true,
        enReposo: false,
        diasReposo: undefined,
        fechaInicioReposo: undefined,
        fechaFinReposo: undefined,
        cicloPago: pagoData.periodoRenovacion as Servicio["cicloPago"],
        fechaInicio: pagoData.fechaInicio,
        fechaVencimiento: pagoData.fechaVencimiento,
        metodoPagoId: pagoData.metodoPagoId,
        metodoPagoNombre: pagoData.metodoPagoNombre,
        moneda: pagoData.moneda,
        costoServicio: pagoData.costo,
        notas: notaPrincipal,
      });

      await renewServicioUseCase(selectedServicio, {
        ...pagoData,
        notas: notaPrincipal,
      }, {
        numeroRenovacion: (selectedServicio.renovaciones ?? 0) + 1,
      });

      await Promise.all([
        invalidateReposoDependencies(),
        limpiarNotificacionesReposo(selectedServicio.id),
      ]);
      toast.success("Servicio activado y renovado", {
        description: `${selectedServicio.nombre} ha sido activado y renovado.`,
      });
      setRenovarDialogOpen(false);
      setSelectedServicio(null);
    } catch (error) {
      toast.error("Error al activar y renovar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedServicio) return;
    try {
      await deleteServicio(selectedServicio.id, deletePayments);
      await limpiarNotificacionesReposo(selectedServicio.id);
      toast.success("Servicio eliminado", {
        description: deletePayments
          ? "El servicio y todos sus registros de pago han sido eliminados."
          : "El servicio fue eliminado. Los registros de pago se conservaron.",
      });
      await invalidateReposoDependencies();
      setDeleteDialogOpen(false);
      setSelectedServicio(null);
    } catch (error) {
      toast.error("Error al eliminar servicio", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Servicios en Reposo
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{" "}
            / <span className="text-foreground">Servicios en Reposo</span>
          </p>
        </div>
      </div>

      {/* Metrics */}
      <ServiciosReposoMetrics servicios={serviciosReposo} />

      {/* Table Card */}
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">Servicios en reposo</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center -mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              {estadoOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => setEstadoFilter(option.value)}
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
          servicios={filteredServicios}
          onActivate={(servicio) => {
            setSelectedServicio(servicio);
            setActivarDialogOpen(true);
          }}
          onRenew={(servicio) => {
            setSelectedServicio(servicio);
            setRenovarDialogOpen(true);
          }}
          onDelete={(servicio) => {
            setSelectedServicio(servicio);
            setDeletePayments(false);
            setDeleteDialogOpen(true);
          }}
        />
      </Card>

      {/* Activar Confirm Dialog */}
      <ConfirmDialog
        open={activarDialogOpen}
        onOpenChange={setActivarDialogOpen}
        title="Activar servicio"
        description={`¿Estás seguro de activar "${selectedServicio?.nombre}"? El servicio saldrá de reposo y volverá a estar activo.`}
        confirmText={isActivating ? "Activando..." : "Activar"}
        onConfirm={handleActivar}
        variant="info"
      />

      {/* Activar y Renovar PagoDialog */}
      {selectedServicio && (
        <PagoDialog
          context="servicio"
          open={renovarDialogOpen}
          onOpenChange={(open) => {
            setRenovarDialogOpen(open);
            if (!open) setSelectedServicio(null);
          }}
          servicio={selectedServicio}
          metodosPago={metodosPago}
          mode="renew"
          onConfirm={handleActivarYRenovar}
        />
      )}

      {/* Eliminar Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Eliminar Servicio"
        description={`¿Estás seguro de que quieres eliminar el servicio "${selectedServicio?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      >
        <div className="flex items-start space-x-2">
          <Checkbox
            id="delete-payments-reposo"
            checked={deletePayments}
            onCheckedChange={(checked) => setDeletePayments(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label
              htmlFor="delete-payments-reposo"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Eliminar también los registros de pago
            </Label>
            <p className="text-sm text-muted-foreground">
              Al marcar esta opción, se eliminarán todos los registros de pago
              de la base de datos. Si no se marca, se conservarán para
              historial.
            </p>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default function ReposoPage() {
  return (
    <ModuleErrorBoundary moduleName="Servicios en Reposo">
      <ReposoPageContent />
    </ModuleErrorBoundary>
  );
}
