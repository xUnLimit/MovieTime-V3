"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MoreVertical, Users, Eye, Edit } from "lucide-react";
import { Servicio } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { calcularDiasRelativosCalendario } from "@/lib/utils/calculations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  PROFILE_ICON_LIMIT,
  getProfileIndicatorStates,
} from "@/lib/utils/perfiles";
import Link from "next/link";

interface ServiciosCategoriaTableProps {
  servicios: Servicio[];
}

export function ServiciosCategoriaTable({
  servicios,
}: ServiciosCategoriaTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredServicios = servicios.filter(
    (servicio) =>
      servicio.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      servicio.correo?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const calcularDiasRestantes = (fechaVencimiento?: Date) => {
    return calcularDiasRelativosCalendario(fechaVencimiento) ?? 0;
  };

  const getBadgeColor = (dias: number) => {
    if (dias < 0) return "destructive";
    if (dias <= 7) return "destructive";
    if (dias <= 30) return "default";
    return "default";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Todos los servicios</h2>
        <p className="text-sm text-muted-foreground">
          {filteredServicios.length} resultado(s)
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Fecha de Inicio</TableHead>
              <TableHead>Fecha de Vencimiento</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead>Dias Restantes</TableHead>
              <TableHead>Renovaciones</TableHead>
              <TableHead>Perfiles</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServicios.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground"
                >
                  No se encontraron servicios
                </TableCell>
              </TableRow>
            ) : (
              filteredServicios.map((servicio) => {
                const diasRestantes = calcularDiasRestantes(
                  servicio.fechaVencimiento,
                );
                const badgeColor = getBadgeColor(diasRestantes);
                const perfilesOcupados = servicio.perfilesOcupados || 0;
                const perfilesTotales = servicio.perfilesDisponibles || 0;
                const perfilesLibres = !servicio.activo
                  ? 0
                  : Math.max(perfilesTotales - perfilesOcupados, 0);
                const indicatorStates = getProfileIndicatorStates(
                  perfilesTotales,
                  perfilesOcupados,
                  servicio.activo,
                  PROFILE_ICON_LIMIT,
                );
                const perfilesRestantes = Math.max(
                  perfilesTotales - indicatorStates.length,
                  0,
                );

                return (
                  <TableRow key={servicio.id}>
                    <TableCell className="font-medium">
                      {servicio.nombre}
                    </TableCell>
                    <TableCell className="text-sm">{servicio.correo}</TableCell>
                    <TableCell>
                      {servicio.fechaInicio
                        ? format(
                            new Date(servicio.fechaInicio),
                            "d 'de' MMM 'del' yyyy",
                            { locale: es },
                          )
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {servicio.fechaVencimiento
                        ? format(
                            new Date(servicio.fechaVencimiento),
                            "d 'de' MMM 'del' yyyy",
                            { locale: es },
                          )
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${servicio.costoServicio * servicio.perfilesDisponibles}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeColor}>
                        {diasRestantes < 0
                          ? "Vencido"
                          : `${diasRestantes} dias restantes`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-lg">🔄</span>
                        <span className="font-medium">
                          {servicio.renovaciones || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {indicatorStates.map((state, index) => {
                            const iconColor =
                              state === "inactive"
                                ? "bg-gray-600"
                                : state === "occupied"
                                  ? "bg-red-600"
                                  : "bg-green-600";

                            return (
                              <div
                                key={`${servicio.id}-indicator-${index}`}
                                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-background ${iconColor}`}
                              >
                                <Users className="h-3 w-3 text-white" />
                              </div>
                            );
                          })}
                        </div>
                        {perfilesRestantes > 0 && (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            +{perfilesRestantes}
                          </span>
                        )}
                        <div className="text-xs leading-tight text-muted-foreground">
                          <span
                            className={`font-medium ${perfilesLibres > 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {perfilesLibres}
                          </span>
                          <span>/{perfilesTotales} disponibles</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          servicio.activo
                            ? "border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                            : "border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        }
                      >
                        {servicio.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link prefetch={false} href={`/servicios/detalle/${servicio.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalles
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link prefetch={false} href={`/servicios/${servicio.id}/editar?from=/servicios/${servicio.categoriaId}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
