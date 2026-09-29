import { BellOff, BellRing, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hideBelowClass } from "@/components/shared/DataTable";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  formatearFechaReposo,
  getBellIconColor,
  getEstadoBadge,
  normalizeReposoDate,
} from "./reposo-notificaciones-table-helpers";
import type { ReposoRow } from "./reposo-notificaciones-table-types";

interface ReposoNotificacionesRowsProps {
  filteredCount: number;
  notificaciones: ReposoRow[];
  onToggleLeida: (notifId: string, leida: boolean) => void;
}

export function ReposoNotificacionesRows({
  filteredCount,
  notificaciones,
  onToggleLeida,
}: ReposoNotificacionesRowsProps) {
  if (filteredCount === 0) {
    return (
      <TableRow>
        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
          No hay notificaciones de servicios en reposo
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {notificaciones.map((notif) => (
        <ReposoNotificacionRow
          key={notif.id}
          notif={notif}
          onToggleLeida={onToggleLeida}
        />
      ))}
    </>
  );
}

function ReposoNotificacionRow({
  notif,
  onToggleLeida,
}: {
  notif: ReposoRow;
  onToggleLeida: (notifId: string, leida: boolean) => void;
}) {
  return (
    <TableRow className="border-b whitespace-nowrap transition-colors hover:bg-muted/50">
      <TableCell className="text-center">
        <BellToggleButton notif={notif} onToggleLeida={onToggleLeida} />
      </TableCell>
      <TableCell className="text-center">{notif.categoriaNombre}</TableCell>
      <TableCell className={`text-center text-sm ${hideBelowClass('lg')}`}>{notif.correo ?? "—"}</TableCell>
      <TableCell className={`text-center text-sm ${hideBelowClass('xl')}`}>
        <ReposoDateCell value={normalizeReposoDate(notif.fechaInicio)} emptyValue="-" />
      </TableCell>
      <TableCell className={`text-center text-sm ${hideBelowClass('xl')}`}>
        <ReposoDateCell value={normalizeReposoDate(notif.fechaFin)} emptyValue="-" />
      </TableCell>
      <TableCell className={`text-center text-sm ${hideBelowClass('md')}`}>
        <ReposoDateCell value={normalizeReposoDate(notif.fechaFinReposo)} emptyValue="—" />
      </TableCell>
      <TableCell className="text-center">
        {getEstadoBadge(notif.diasRestantes)}
      </TableCell>
      <TableCell className="text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" />
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function BellToggleButton({
  notif,
  onToggleLeida,
}: {
  notif: ReposoRow;
  onToggleLeida: (notifId: string, leida: boolean) => void;
}) {
  const bellColors = getBellIconColor(notif.diasRestantes);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`mx-auto size-7 rounded-full transition-all duration-200 ease-in-out ${
        notif.leida
          ? "bg-muted hover:bg-accent"
          : `${bellColors.bgColor} ${bellColors.hoverBgColor}`
      } hover:scale-105`}
      onClick={() => onToggleLeida(notif.id, !notif.leida)}
      title={notif.leida ? "Marcar como no leída" : "Marcar como leída"}
    >
      {notif.leida ? (
        <BellOff className="h-4 w-4 text-muted-foreground transition-all duration-200 ease-in-out" />
      ) : (
        <BellRing
          className={`h-4 w-4 transition-all duration-200 ease-in-out ${bellColors.textColor}`}
        />
      )}
    </Button>
  );
}

function ReposoDateCell({
  emptyValue,
  value,
}: {
  emptyValue: string;
  value: string | null;
}) {
  return value ? formatearFechaReposo(value) : emptyValue;
}
