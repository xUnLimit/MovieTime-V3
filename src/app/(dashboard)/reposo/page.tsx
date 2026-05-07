"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { differenceInDays, format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  MoreHorizontal,
  Power,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { MetricCard } from "@/components/shared/MetricCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ModuleErrorBoundary } from "@/components/shared/ModuleErrorBoundary";
import { PagoDialog, type EnrichedPagoDialogFormData } from "@/components/shared/PagoDialog";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchMetodosPagoByFiltersUseCase } from "@/lib/use-cases/catalogos-use-cases";
import { fetchNotificacionesByFiltersUseCase } from "@/lib/use-cases/notificaciones-use-cases";
import { fetchServiciosByFiltersUseCase } from '@/lib/use-cases/servicios-use-cases';
import { renewServicioUseCase } from "@/lib/use-cases/servicios-use-cases";
import { useNotificacionesStore } from "@/store/notificacionesStore";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useServiciosStore } from "@/store/serviciosStore";
import type { Servicio } from "@/types/servicios";
import type { MetodoPago } from "@/types/metodos-pago";
import { toast } from "sonner";

interface ReposoServicio extends Servicio {
  diasRestantes: number;
  progreso: number;
  estadoReposo: "en_proceso" | "proximo_finalizar" | "completado";
}

function calcularReposoData(servicio: Servicio): ReposoServicio {
  const hoy = startOfDay(new Date());
  const fechaFin = servicio.fechaFinReposo
    ? startOfDay(new Date(servicio.fechaFinReposo))
    : hoy;
  const fechaInicio = servicio.fechaInicioReposo
    ? startOfDay(new Date(servicio.fechaInicioReposo))
    : hoy;
  const diasRestantes = differenceInDays(fechaFin, hoy);
  const diasTotales =
    servicio.diasReposo || differenceInDays(fechaFin, fechaInicio) || 1;
  const diasTranscurridos = diasTotales - diasRestantes;
  const progreso = Math.min(
    100,
    Math.max(0, (diasTranscurridos / diasTotales) * 100),
  );

  let estadoReposo: ReposoServicio["estadoReposo"] = "en_proceso";
  if (diasRestantes <= 0) estadoReposo = "completado";
  else if (diasRestantes <= 7) estadoReposo = "proximo_finalizar";

  return { ...servicio, diasRestantes, progreso, estadoReposo };
}

function ServiciosReposoMetrics({ servicios }: { servicios: ReposoServicio[] }) {
  const enProceso = servicios.filter(
    (s) => s.estadoReposo === "en_proceso",
  ).length;
  const proximosFinalizar = servicios.filter(
    (s) => s.estadoReposo === "proximo_finalizar",
  ).length;
  const completados = servicios.filter(
    (s) => s.estadoReposo === "completado",
  ).length;

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
  const { updateServicio, deleteServicio, fetchCounts } = useServiciosStore();
  const { fetchCategorias } = useCategoriasStore();
  const { deleteNotificacion, fetchNotificaciones } = useNotificacionesStore();

  const [serviciosReposo, setServiciosReposo] = useState<ReposoServicio[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [activarDialogOpen, setActivarDialogOpen] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePayments, setDeletePayments] = useState(false);
  const [selectedServicio, setSelectedServicio] =
    useState<ReposoServicio | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const loadMetodosPago = useCallback(async () => {
    if (metodosPago.length > 0) return;
    try {
      const methods = await fetchMetodosPagoByFiltersUseCase<MetodoPago>([
        { field: "asociadoA", operator: "==", value: "servicio" },
      ]);
      setMetodosPago(methods);
    } catch {
      setMetodosPago([]);
    }
  }, [metodosPago.length]);

  const fetchReposoServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const servicios = await fetchServiciosByFiltersUseCase<Servicio>([
        { field: "enReposo", operator: "==", value: true },
      ]);
      const enriched = servicios.map(calcularReposoData);
      enriched.sort((a, b) => {
        if (a.estadoReposo === "completado" && b.estadoReposo !== "completado")
          return -1;
        if (a.estadoReposo !== "completado" && b.estadoReposo === "completado")
          return 1;
        return a.diasRestantes - b.diasRestantes;
      });
      setServiciosReposo(enriched);
    } catch (error) {
      console.error("Error fetching reposo services:", error);
      toast.error("Error al cargar servicios en reposo");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReposoServices();
  }, [fetchReposoServices]);

  const filteredServicios = useMemo(() => {
    let result = serviciosReposo;
    if (estadoFilter !== "all") {
      result = result.filter((s) => s.estadoReposo === estadoFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          s.correo.toLowerCase().includes(q),
      );
    }
    return result;
  }, [serviciosReposo, search, estadoFilter]);

  const limpiarNotificacionesReposo = async (servicioId: string) => {
    try {
      const notifs = await fetchNotificacionesByFiltersUseCase<{ id: string }>([
        { field: "entidad", operator: "==", value: "reposo" },
        { field: "servicioId", operator: "==", value: servicioId },
      ]);
      await Promise.all(
        notifs.map((n) => deleteNotificacion(n.id)),
      );
      fetchNotificaciones(true);
    } catch {
      // Best-effort cleanup
    }
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
        fetchCategorias(true),
        fetchCounts(true),
        limpiarNotificacionesReposo(selectedServicio.id),
      ]);
      toast.success("Servicio activado", {
        description: `${selectedServicio.nombre} ha sido activado exitosamente.`,
      });
      setActivarDialogOpen(false);
      setSelectedServicio(null);
      fetchReposoServices();
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
        fetchCategorias(true),
        fetchCounts(true),
        limpiarNotificacionesReposo(selectedServicio.id),
      ]);
      toast.success("Servicio activado y renovado", {
        description: `${selectedServicio.nombre} ha sido activado y renovado.`,
      });
      setRenovarDialogOpen(false);
      setSelectedServicio(null);
      fetchReposoServices();
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
      await Promise.all([fetchCategorias(true), fetchCounts(true)]);
      setDeleteDialogOpen(false);
      setSelectedServicio(null);
      fetchReposoServices();
    } catch (error) {
      toast.error("Error al eliminar servicio", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const columns: Column<ReposoServicio>[] = useMemo(
    () => [
      {
        key: "nombre",
        header: "Nombre",
        sortable: true,
        render: (item) => <div className="font-medium">{item.nombre}</div>,
      },
      {
        key: "correo",
        header: "Email",
        sortable: true,
        render: (item) => <span className="text-sm">{item.correo}</span>,
      },
      {
        key: "fechaInicioReposo",
        header: "Fecha Inicio",
        sortable: true,
        align: "center",
        render: (item) => (
          <span className="text-sm text-white">
            {item.fechaInicioReposo
              ? format(
                  new Date(item.fechaInicioReposo),
                  "dd 'de' MMMM 'del' yyyy",
                  { locale: es },
                )
              : "—"}
          </span>
        ),
      },
      {
        key: "fechaVencimiento",
        header: "Fecha Fin",
        sortable: true,
        align: "center",
        render: (item) => (
          <span className="text-sm text-white">
            {item.fechaVencimiento
              ? format(
                  new Date(item.fechaVencimiento),
                  "dd 'de' MMMM 'del' yyyy",
                  { locale: es },
                )
              : "—"}
          </span>
        ),
      },
      {
        key: "fechaFinReposo",
        header: "Fecha Fin Reposo",
        sortable: true,
        align: "center",
        render: (item) => (
          <span className="text-sm text-white">
            {item.fechaFinReposo
              ? format(
                  new Date(item.fechaFinReposo),
                  "dd 'de' MMMM 'del' yyyy",
                  { locale: es },
                )
              : "-"}
          </span>
        ),
      },
      {
        key: "diasRestantes",
        header: "Días Restantes",
        sortable: true,
        align: "center",
        render: (item) => {
          switch (item.estadoReposo) {
            case "completado":
              return (
                <Badge
                  variant="outline"
                  className="border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 font-semibold"
                >
                  {item.diasRestantes <= 0
                    ? "Listo"
                    : `${item.diasRestantes} día${item.diasRestantes !== 1 ? "s" : ""}`}
                </Badge>
              );
            case "proximo_finalizar":
              return (
                <Badge
                  variant="outline"
                  className="border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-semibold"
                >
                  {item.diasRestantes} día{item.diasRestantes !== 1 ? "s" : ""}
                </Badge>
              );
            default:
              return (
                <Badge
                  variant="outline"
                  className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                >
                  {item.diasRestantes} días
                </Badge>
              );
          }
        },
      },
      {
        key: "progreso",
        header: "Progreso",
        sortable: true,
        align: "center",
        render: (item) => {
          const barColor =
            item.estadoReposo === "completado"
              ? "[&>div]:bg-green-500"
              : item.estadoReposo === "proximo_finalizar"
                ? "[&>div]:bg-yellow-500"
                : "[&>div]:bg-blue-500";
          return (
            <div className="flex items-center gap-2 min-w-[130px]">
              <Progress
                value={item.progreso}
                className={`h-2 flex-1 ${barColor}`}
              />
              <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                {Math.round(item.progreso)}%
              </span>
            </div>
          );
        },
      },
      {
        key: "estadoReposo",
        header: "Estado",
        sortable: true,
        align: "center",
        render: (item) => {
          switch (item.estadoReposo) {
            case "en_proceso":
              return (
                <Badge
                  variant="outline"
                  className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                >
                  En proceso
                </Badge>
              );
            case "proximo_finalizar":
              return (
                <Badge
                  variant="outline"
                  className="border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                >
                  Por finalizar
                </Badge>
              );
            case "completado":
              return (
                <Badge
                  variant="outline"
                  className="border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                >
                  Completado
                </Badge>
              );
          }
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Servicios en Reposo
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{" "}
            / <span className="text-foreground">Servicios en Reposo</span>
          </p>
        </div>
        <Button
          onClick={fetchReposoServices}
          variant="outline"
          className="shrink-0 whitespace-nowrap"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
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
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="en_proceso">En proceso</SelectItem>
              <SelectItem value="proximo_finalizar">Por finalizar</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <DataTable
            data={filteredServicios as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            emptyMessage="No hay servicios en reposo"
            pagination
            itemsPerPageOptions={[10, 25, 50]}
            actions={(item) => {
              const servicio = item as unknown as ReposoServicio;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/servicios/detalle/${servicio.id}`}>
                        <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                        Ver detalles
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedServicio(servicio);
                        setActivarDialogOpen(true);
                      }}
                    >
                      <Power className="h-4 w-4 mr-2 text-green-600" />
                      Activar Servicio
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedServicio(servicio);
                        loadMetodosPago();
                        setRenovarDialogOpen(true);
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2 text-blue-600" />
                      Activar y Renovar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedServicio(servicio);
                        setDeletePayments(false);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
        )}
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
