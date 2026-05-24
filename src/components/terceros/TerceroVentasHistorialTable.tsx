"use client";

import Link from "next/link";
import {
  Calendar,
  Clock,
  Monitor,
  MoreHorizontal,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { formatearFecha } from "@/lib/utils/calculations";

import type { TerceroDetailsRow } from "./useTerceroDetailsController";

interface TerceroVentasHistorialTableProps {
  rows: TerceroDetailsRow[];
}

export function TerceroVentasHistorialTable({ rows }: TerceroVentasHistorialTableProps) {
  return (
    <div className="rounded-md border bg-background overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground">Categoría</TableHead>
            <TableHead className="text-center text-muted-foreground">Ciclo de Pago</TableHead>
            <TableHead className="text-center text-muted-foreground">Fecha de Inicio</TableHead>
            <TableHead className="text-center text-muted-foreground">Fecha de Expiración</TableHead>
            <TableHead className="text-center text-muted-foreground">Renovaciones</TableHead>
            <TableHead className="text-center text-muted-foreground">Estado</TableHead>
            <TableHead className="text-center text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="opacity-70">
              <TableCell>
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="font-medium">{row.categoriaNombre}</p>
                    <p className="text-xs text-muted-foreground">{row.servicioNombre}</p>
                  </div>
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
              <TableCell className="text-center">
                <span className="inline-flex items-center justify-center gap-1 font-medium">
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  {row.renovaciones}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={row.cortadaAt
                    ? "border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
                    : "border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  }
                >
                  {row.cortadaAt ? "Cortada" : "Inactiva"}
                </Badge>
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
