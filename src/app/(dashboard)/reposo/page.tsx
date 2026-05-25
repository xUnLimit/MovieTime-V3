"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ModuleErrorBoundary } from "@/components/shared/ModuleErrorBoundary";
import { PagoDialog, type EnrichedPagoDialogFormData } from "@/components/shared/PagoDialog";
import { queryKeys } from "@/lib/query-keys";
import { queryNotifications } from "@/lib/supabase/notifications-repository";
import { renewServicioUseCase } from "@/lib/use-cases/servicios/servicios-payment-use-cases";
import { useNotificacionesStore } from "@/store/notificacionesStore";
import { useServiciosStore } from "@/store/serviciosStore";
import type { Servicio } from "@/types/servicios";
import { toast } from "sonner";
import {
  fetchReposoServicesQuery,
  fetchServicioMetodosPagoQuery,
  filterReposoServicios,
  type ReposoServicio,
} from "./reposo-helpers";
import {
  DeleteReposoPaymentsOption,
  getEstadoReposoLabel,
  ReposoPageHeader,
  ReposoTableCard,
  ServiciosReposoMetrics,
} from "./ReposoPageSections";

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
  const estadoFilterLabel = getEstadoReposoLabel(estadoFilter);
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
      <ReposoPageHeader />
      <ServiciosReposoMetrics servicios={serviciosReposo} />

      <ReposoTableCard
        search={search}
        estadoFilter={estadoFilter}
        estadoFilterLabel={estadoFilterLabel}
        isLoading={isLoading}
        servicios={filteredServicios}
        onSearchChange={setSearch}
        onEstadoFilterChange={setEstadoFilter}
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
        <DeleteReposoPaymentsOption checked={deletePayments} onCheckedChange={setDeletePayments} />
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
