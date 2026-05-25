"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ModuleErrorBoundary } from "@/components/shared/ModuleErrorBoundary";
import { PagoDialog, type EnrichedPagoDialogFormData } from "@/components/shared/PagoDialog";
import { queryKeys } from "@/lib/query-keys";
import {
  activateAndRenewReposoServicioUseCase,
  activateReposoServicioUseCase,
  deleteReposoServicioUseCase,
} from "@/lib/use-cases/notificaciones/notificaciones-reposo-use-cases";
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

  const handleActivar = async () => {
    if (!selectedServicio) return;
    setIsActivating(true);
    try {
      await activateReposoServicioUseCase({
        queryClient,
        servicio: selectedServicio,
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
      await activateAndRenewReposoServicioUseCase({
        pagoData,
        queryClient,
        servicio: selectedServicio,
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
      await deleteReposoServicioUseCase({
        deletePayments,
        queryClient,
        servicio: selectedServicio,
      });
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
