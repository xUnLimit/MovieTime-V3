"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Copy,
  Monitor,
  MoreHorizontal,
  RefreshCw,
  ShoppingCart,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrencySymbol } from "@/platform/constants";
import { formatearFecha } from "@/platform/utils/calculations";

import type { TerceroDetailsRow } from "./useTerceroDetailsController";

interface TerceroVentasActiveTableProps {
  rows: TerceroDetailsRow[];
  onCopy: (value: string, label?: string) => void;
  onOpenEstadoDialog: (modo: "activar" | "inactivar", row: TerceroDetailsRow) => void;
}

function DiasRestantesBadge({ diasRestantes }: { diasRestantes: number }) {
  if (diasRestantes < 0) {
    const diasRetraso = Math.abs(diasRestantes);
    return (
      <Badge variant="outline" className="border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 gap-1">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {diasRetraso} día{diasRetraso !== 1 ? "s" : ""} de retraso
      </Badge>
    );
  }

  if (diasRestantes === 0) {
    return (
      <Badge variant="outline" className="border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
        Vence hoy
      </Badge>
    );
  }

  if (diasRestantes <= 7) {
    return (
      <Badge variant="outline" className="border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
        {diasRestantes} día{diasRestantes !== 1 ? "s" : ""} restante{diasRestantes !== 1 ? "s" : ""}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
      {diasRestantes} días restantes
    </Badge>
  );
}

export function TerceroVentasActiveTable({
  rows,
  onCopy,
  onOpenEstadoDialog,
}: TerceroVentasActiveTableProps) {
  return (
    <div className="rounded-md border bg-background overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground">Categoría</TableHead>
            <TableHead className="text-muted-foreground">Email</TableHead>
            <TableHead className="text-center text-muted-foreground">Contraseña</TableHead>
            <TableHead className="text-center text-muted-foreground">Ciclo de Pago</TableHead>
            <TableHead className="text-center text-muted-foreground">Fecha de Inicio</TableHead>
            <TableHead className="text-center text-muted-foreground">Fecha de Expiración</TableHead>
            <TableHead className="text-center text-muted-foreground">Monto Sin Consumir</TableHead>
            <TableHead className="text-center text-muted-foreground">Renovaciones</TableHead>
            <TableHead className="text-center text-muted-foreground">Días Restantes</TableHead>
            <TableHead className="text-center text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="font-medium">{row.categoriaNombre}</p>
                    <p className="text-xs text-muted-foreground">{row.servicioNombre}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="inline-flex items-center gap-2">
                  <span className="font-medium">{row.correo}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(row.correo, "Correo")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex w-full items-center justify-center gap-2">
                  <span className="font-medium">{row.contrasena}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(row.contrasena, "Contraseña")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{row.cicloPago}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{row.fechaInicio ? formatearFecha(row.fechaInicio) : "—"}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{row.fechaFin ? formatearFecha(row.fechaFin) : "—"}</span>
                </div>
              </TableCell>
              <TableCell className="text-center font-medium">
                <span className="text-green-500">{getCurrencySymbol(row.moneda)}</span>
                <span> {row.montoSinConsumir.toFixed(2)}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center justify-center gap-1 font-medium">
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  {row.renovaciones}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <DiasRestantesBadge diasRestantes={row.diasRestantes} />
              </TableCell>
              <TableCell className="text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link prefetch={false} href={`/ventas/${row.id}`}>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Ver Venta
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link prefetch={false} href={`/servicios/detalle/${row.servicioId}`}>
                        <Monitor className="h-4 w-4 mr-2" />
                        Ver Servicio
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onOpenEstadoDialog("inactivar", row)}>
                      <XCircle className="h-4 w-4 mr-2 text-red-600" />
                      <span className="text-red-600">Inactivar</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
