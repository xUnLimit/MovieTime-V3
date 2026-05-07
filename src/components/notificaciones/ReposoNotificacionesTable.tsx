'use client';

import { useMemo, useState } from 'react';
import { Search, MoreHorizontal, BellRing, BellOff, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import type { NotificacionReposo } from '@/types/notificaciones';

type ReposoRow = NotificacionReposo & { id: string };

function getBellIconColor(diasRestantes: number): {
  bgColor: string;
  hoverBgColor: string;
  textColor: string;
} {
  if (diasRestantes <= 0) {
    return {
      bgColor: 'bg-green-100 dark:bg-green-500/20',
      hoverBgColor: 'hover:bg-green-200 dark:hover:bg-green-500/30',
      textColor: 'text-green-600 dark:text-green-400',
    };
  } else if (diasRestantes <= 7) {
    return {
      bgColor: 'bg-yellow-100 dark:bg-yellow-500/20',
      hoverBgColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-500/30',
      textColor: 'text-yellow-600 dark:text-yellow-400',
    };
  } else {
    return {
      bgColor: 'bg-blue-100 dark:bg-blue-500/20',
      hoverBgColor: 'hover:bg-blue-200 dark:hover:bg-blue-500/30',
      textColor: 'text-blue-600 dark:text-blue-400',
    };
  }
}

function getEstadoBadge(diasRestantes: number) {
  if (diasRestantes <= 0) {
    return (
      <Badge variant="outline" className="border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
        Completado
      </Badge>
    );
  }
  if (diasRestantes <= 7) {
    return (
      <Badge variant="outline" className="border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
        {diasRestantes} día{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-blue-500/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
      {diasRestantes} días restantes
    </Badge>
  );
}

function formatearFecha(fechaStr: string): string {
  const fecha = new Date(fechaStr);
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${fecha.getDate()} de ${meses[fecha.getMonth()]} del ${fecha.getFullYear()}`;
}

export function ReposoNotificacionesTable() {
  const { notificaciones, toggleLeida } = useNotificacionesStore();
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const reposoNotificaciones = useMemo(() => {
    return notificaciones
      .filter((n): n is ReposoRow => n.entidad === 'reposo')
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [notificaciones]);

  const filtered = useMemo(() => {
    let result = reposoNotificaciones;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.categoriaNombre?.toLowerCase().includes(q) ||
          n.correo?.toLowerCase().includes(q)
      );
    }

    if (estadoFilter !== 'todos') {
      if (estadoFilter === 'completado') {
        result = result.filter((n) => n.diasRestantes <= 0);
      } else if (estadoFilter === 'proximos') {
        result = result.filter((n) => n.diasRestantes > 0 && n.diasRestantes <= 7);
      } else if (estadoFilter === 'en_reposo') {
        result = result.filter((n) => n.diasRestantes > 7);
      }
    }

    return result;
  }, [reposoNotificaciones, search, estadoFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  return (
    <Card className="p-4 pb-2">
      <h3 className="text-xl font-semibold">Servicios en Reposo</h3>
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por categoría o correo..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>

        <Select value={estadoFilter} onValueChange={(v) => { setEstadoFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="dashboard-toolbar-control-wide">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="en_reposo">En reposo (&gt;7 días)</SelectItem>
            <SelectItem value="proximos">Próximos (≤7 días)</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="rounded-md border">
          <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-muted/50">
                <TableHead className="h-12 px-4 text-center text-muted-foreground w-[80px]">
                  Tipo
                </TableHead>
                <TableHead className="h-12 px-4 text-center text-muted-foreground">
                  Categoría
                </TableHead>
                <TableHead className="h-12 px-4 text-center text-muted-foreground">
                  Correo
                </TableHead>
                <TableHead className="h-12 px-4 text-center text-muted-foreground">
                  Fecha Inicio
                </TableHead>
                <TableHead className="h-12 px-4 text-center text-muted-foreground">
                  Fecha Fin
                </TableHead>
                <TableHead className="h-12 px-4 text-center text-muted-foreground">
                  Fecha Fin Reposo
                </TableHead>
                <TableHead className="h-12 px-4 text-center text-muted-foreground">
                  Estado
                </TableHead>
                <TableHead className="h-12 px-4 text-center text-muted-foreground">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No hay notificaciones de servicios en reposo
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((notif) => {
                  const bellColors = getBellIconColor(notif.diasRestantes);
                  return (
                    <TableRow key={notif.id} className="border-b transition-colors hover:bg-muted/50">
                      {/* Tipo - Bell icon */}
                      <TableCell className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`mx-auto h-8 w-8 rounded-full transition-all duration-200 ease-in-out ${
                            notif.leida
                              ? 'bg-gray-100 dark:bg-gray-500/20 hover:bg-gray-200 dark:hover:bg-gray-500/30'
                              : `${bellColors.bgColor} ${bellColors.hoverBgColor}`
                          } hover:scale-105`}
                          onClick={() => toggleLeida(notif.id, !notif.leida)}
                          title={notif.leida ? 'Marcar como no leída' : 'Marcar como leída'}
                        >
                          {notif.leida ? (
                            <BellOff className="h-4 w-4 transition-all duration-200 ease-in-out text-gray-400 dark:text-gray-500" />
                          ) : (
                            <BellRing className={`h-4 w-4 transition-all duration-200 ease-in-out ${bellColors.textColor}`} />
                          )}
                        </Button>
                      </TableCell>

                      {/* Categoría */}
                      <TableCell className="p-4 text-center">
                        {notif.categoriaNombre}
                      </TableCell>

                      {/* Correo */}
                      <TableCell className="p-4 text-center text-sm">
                        {notif.correo ?? '—'}
                      </TableCell>

                      {/* Fecha Inicio */}
                      <TableCell className="p-4 text-center text-sm">
                        {notif.fechaInicio
                          ? formatearFecha(notif.fechaInicio instanceof Date ? notif.fechaInicio.toISOString() : String(notif.fechaInicio))
                          : '-'}
                      </TableCell>

                      {/* Fecha Fin */}
                      <TableCell className="p-4 text-center text-sm">
                        {notif.fechaFin
                          ? formatearFecha(notif.fechaFin instanceof Date ? notif.fechaFin.toISOString() : String(notif.fechaFin))
                          : '-'}
                      </TableCell>

                      {/* Fecha Fin Reposo */}
                      <TableCell className="p-4 text-center text-sm">
                        {notif.fechaFinReposo ? formatearFecha(notif.fechaFinReposo instanceof Date ? notif.fechaFinReposo.toISOString() : String(notif.fechaFinReposo)) : '—'}
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="p-4 text-center">
                        {getEstadoBadge(notif.diasRestantes)}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="p-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" />
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

        {/* Pagination */}
        <div className="flex flex-wrap items-center gap-2 px-2 py-4">
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground sm:text-sm">Mostrar</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-[62px] justify-between px-2 sm:w-[70px]">
                  {itemsPerPage}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {[10, 25, 50, 100].map((size) => (
                  <DropdownMenuItem
                    key={size}
                    onClick={() => handleItemsPerPageChange(size.toString())}
                    className={itemsPerPage === size ? 'bg-accent' : ''}
                  >
                    {size}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
              Página {currentPage} de {Math.max(1, totalPages)}
            </span>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs sm:px-3 sm:text-sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
