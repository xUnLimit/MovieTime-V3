import Link from "next/link";
import {
  Eye,
  Monitor,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

import type { CategoriaRow } from "./useCategoriasTableController";

interface CategoriaTableRowProps {
  row: CategoriaRow;
  isLoadingVentas: boolean;
}

function getProgressPercentage(activos: number, total: number) {
  if (total === 0) return 0;
  return Math.round((activos / total) * 100);
}

export function CategoriaTableRow({
  row,
  isLoadingVentas,
}: CategoriaTableRowProps) {
  const progressPercentage = getProgressPercentage(
    row.serviciosActivos,
    row.totalServicios,
  );

  return (
    <TableRow>
      <TableCell className="pl-6">
        <span className="font-medium">{row.categoria.nombre}</span>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Monitor
            className={`h-4 w-4 ${row.serviciosActivos > 0 ? "text-green-500" : "text-muted-foreground"}`}
          />
          <span
            className={`font-medium ${row.serviciosActivos > 0 ? "" : "text-muted-foreground"}`}
          >
            {row.totalServicios}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center py-2">
        <div className="space-y-0.5">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp
              className={`h-3 w-3 ${row.serviciosActivos > 0 ? "text-green-500" : "text-muted-foreground"}`}
            />
            <span
              className={`font-medium text-sm ${row.serviciosActivos > 0 ? "" : "text-muted-foreground"}`}
            >
              {row.serviciosActivos} / {row.totalServicios}
            </span>
          </div>
          <div className="bg-neutral-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-green-500 h-full rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Users
            className={`h-4 w-4 ${row.perfilesDisponibles > 0 ? "text-green-500" : "text-muted-foreground"}`}
          />
          <span
            className={`font-medium ${row.perfilesDisponibles > 0 ? "" : "text-muted-foreground"}`}
          >
            {row.perfilesDisponibles}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <ShoppingCart
            className={`h-4 w-4 ${row.ventasTotales > 0 ? "text-purple-500" : "text-muted-foreground"}`}
          />
          <span
            className={`font-medium ${row.ventasTotales > 0 ? "" : "text-muted-foreground"}`}
          >
            {row.ventasTotales}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span
            className={`${row.ingresoTotal === 0 ? "text-muted-foreground" : "text-blue-500"}`}
          >
            $
          </span>
          <span
            className={`${row.ingresoTotal === 0 ? "text-muted-foreground" : ""}`}
          >
            {row.ingresoTotal.toFixed(2)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span
            className={`${row.gastosTotal === 0 ? "text-muted-foreground" : "text-red-500"}`}
          >
            $
          </span>
          <span
            className={`${row.gastosTotal === 0 ? "text-muted-foreground" : ""}`}
          >
            {row.gastosTotal.toFixed(2)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span
            className={`${row.gananciaTotal < 0 ? "text-red-500" : row.gananciaTotal === 0 ? "text-muted-foreground" : "text-green-500"}`}
          >
            $
          </span>
          <span
            className={`${row.gananciaTotal < 0 ? "text-red-500" : row.gananciaTotal === 0 ? "text-muted-foreground" : ""}`}
          >
            {row.gananciaTotal.toFixed(2)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {isLoadingVentas ? (
          <div className="flex items-center justify-center">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1">
            <span
              className={`${row.montoSinConsumir === 0 ? "text-muted-foreground" : "text-orange-500"}`}
            >
              $
            </span>
            <span
              className={`${row.montoSinConsumir === 0 ? "text-muted-foreground" : ""}`}
            >
              {row.montoSinConsumir.toFixed(2)}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center pr-6">
        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Link prefetch={false} href={`/servicios/${row.categoria.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
