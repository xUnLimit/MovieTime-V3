"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, MoreHorizontal, Power, RefreshCw, Trash2 } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/DataTable";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

import type { ReposoServicio } from "./reposo-helpers";

interface ReposoTableProps {
  isLoading: boolean;
  onActivate: (servicio: ReposoServicio) => void;
  onDelete: (servicio: ReposoServicio) => void;
  onRenew: (servicio: ReposoServicio) => void;
  servicios: ReposoServicio[];
}

function formatReposoDate(value?: Date | string | null, empty = "-") {
  return value
    ? format(new Date(value), "dd 'de' MMMM 'del' yyyy", { locale: es })
    : empty;
}

function renderDiasRestantes(item: ReposoServicio) {
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
}

function renderEstadoReposo(item: ReposoServicio) {
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
}

function renderProgreso(item: ReposoServicio) {
  const barColor =
    item.estadoReposo === "completado"
      ? "[&>div]:bg-green-500"
      : item.estadoReposo === "proximo_finalizar"
        ? "[&>div]:bg-yellow-500"
        : "[&>div]:bg-blue-500";

  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <Progress value={item.progreso} className={`h-2 flex-1 ${barColor}`} />
      <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
        {Math.round(item.progreso)}%
      </span>
    </div>
  );
}

export function ReposoTable({
  isLoading,
  onActivate,
  onDelete,
  onRenew,
  servicios,
}: ReposoTableProps) {
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
            {formatReposoDate(item.fechaInicioReposo, "—")}
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
            {formatReposoDate(item.fechaVencimiento, "—")}
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
            {formatReposoDate(item.fechaFinReposo)}
          </span>
        ),
      },
      {
        key: "diasRestantes",
        header: "Días Restantes",
        sortable: true,
        align: "center",
        render: renderDiasRestantes,
      },
      {
        key: "progreso",
        header: "Progreso",
        sortable: true,
        align: "center",
        render: renderProgreso,
      },
      {
        key: "estadoReposo",
        header: "Estado",
        sortable: true,
        align: "center",
        render: renderEstadoReposo,
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <DataTable
      data={servicios as unknown as Record<string, unknown>[]}
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
                <Link prefetch={false} href={`/servicios/detalle/${servicio.id}`}>
                  <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                  Ver detalles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onActivate(servicio)}>
                <Power className="h-4 w-4 mr-2 text-green-600" />
                Activar Servicio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRenew(servicio)}>
                <RefreshCw className="h-4 w-4 mr-2 text-blue-600" />
                Activar y Renovar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(servicio)}>
                <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
    />
  );
}
