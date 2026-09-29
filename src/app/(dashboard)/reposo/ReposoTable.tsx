"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, MoreHorizontal, Power, RefreshCw, Trash2 } from "lucide-react";

import { DataTable, defineDataTableColumns } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  const dias = `${item.diasRestantes} día${item.diasRestantes !== 1 ? "s" : ""}`;
  switch (item.estadoReposo) {
    case "completado":
      return <StatusBadge tone="success">{item.diasRestantes <= 0 ? "Listo" : dias}</StatusBadge>;
    case "proximo_finalizar":
      return <StatusBadge tone="warning">{dias}</StatusBadge>;
    default:
      return <StatusBadge tone="info">{item.diasRestantes} días</StatusBadge>;
  }
}

function renderEstadoReposo(item: ReposoServicio) {
  switch (item.estadoReposo) {
    case "en_proceso":
      return <StatusBadge tone="info">En proceso</StatusBadge>;
    case "proximo_finalizar":
      return <StatusBadge tone="warning">Por finalizar</StatusBadge>;
    case "completado":
      return <StatusBadge tone="success">Completado</StatusBadge>;
  }
}

function renderProgreso(item: ReposoServicio) {
  const barColor =
    item.estadoReposo === "completado"
      ? "[&>div]:bg-success"
      : item.estadoReposo === "proximo_finalizar"
        ? "[&>div]:bg-warning"
        : "[&>div]:bg-info";

  return (
    <div className="flex min-w-24 items-center gap-2">
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
  const columns = useMemo(
    () => defineDataTableColumns<ReposoServicio>([
      {
        key: "nombre",
        header: "Nombre",
        sortable: true,
        render: (item) => <div className="font-medium">{item.nombre}</div>,
      },
      {
        key: "correo",
        hideBelow: "lg",
        header: "Email",
        sortable: true,
        render: (item) => <span className="text-sm">{item.correo}</span>,
      },
      {
        key: "fechaInicioReposo",
        hideBelow: "2xl",
        header: "Fecha Inicio",
        sortable: true,
        align: "center",
        render: (item) => (
          <span className="text-sm">
            {formatReposoDate(item.fechaInicioReposo, "—")}
          </span>
        ),
      },
      {
        key: "fechaVencimiento",
        hideBelow: "2xl",
        header: "Fecha Fin",
        sortable: true,
        align: "center",
        render: (item) => (
          <span className="text-sm">
            {formatReposoDate(item.fechaVencimiento, "—")}
          </span>
        ),
      },
      {
        key: "fechaFinReposo",
        hideBelow: "xl",
        header: "Fecha Fin Reposo",
        sortable: true,
        align: "center",
        render: (item) => (
          <span className="text-sm">
            {formatReposoDate(item.fechaFinReposo)}
          </span>
        ),
      },
      {
        key: "diasRestantes",
        hideBelow: "sm",
        header: "Días Restantes",
        sortable: true,
        align: "center",
        render: renderDiasRestantes,
      },
      {
        key: "progreso",
        hideBelow: "md",
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
    ]),
    [],
  );

  return (
    <DataTable
      bare
      autoPageSize
      pagination
      loading={isLoading}
      data={servicios}
      columns={columns}
      emptyMessage="No hay servicios en reposo"
      actions={(item) => {
        const servicio = item;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acciones del servicio">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link prefetch={false} href={`/servicios/detalle/${servicio.id}`}>
                  <Eye className="text-muted-foreground" />
                  Ver detalles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onActivate(servicio)}>
                <Power className="text-success" />
                Activar Servicio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRenew(servicio)}>
                <RefreshCw className="text-info" />
                Activar y Renovar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(servicio)}>
                <Trash2 className="text-danger" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
    />
  );
}
