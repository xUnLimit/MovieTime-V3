'use client';

import { useMemo, useState } from 'react';
import { Activity, Check, Search, MoreHorizontal, BellRing, BellOff } from 'lucide-react';
import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useClientPagination } from '@/hooks/useClientPagination';
import { PaginationFooter } from '@/components/shared/PaginationFooter';
import type { NotificacionReposo } from '@/types/notificaciones';

type ReposoRow = NotificacionReposo & { id: string };

const ESTADO_REPOSO_OPTIONS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'proximo_finalizar', label: 'Por finalizar' },
  { value: 'completado', label: 'Completado' },
];

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
  const estadoFilterLabel =
    ESTADO_REPOSO_OPTIONS.find((option) => option.value === estadoFilter)?.label ?? 'Todos los estados';

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
      } else if (estadoFilter === 'proximo_finalizar') {
        result = result.filter((n) => n.diasRestantes > 0 && n.diasRestantes <= 7);
      } else if (estadoFilter === 'en_proceso') {
        result = result.filter((n) => n.diasRestantes > 7);
      }
    }

    return result;
  }, [reposoNotificaciones, search, estadoFilter]);

  const {
    data: paginated,
    page,
    totalPages,
    hasPrevious,
    hasMore,
    pageSize,
    setPageSize,
    next,
    previous,
    reset: resetPagination,
  } = useClientPagination({
    data: filtered,
    initialPageSize: 10,
  });

  return (
    <Card className="min-w-0 p-4 pb-2">
      <h3 className="text-xl font-semibold">Servicios en Reposo</h3>
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por categoría o correo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPagination();
            }}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="dashboard-toolbar-control-wide justify-between gap-2 font-normal">
              <FilterTriggerContent icon={Activity} label={estadoFilterLabel} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
            {ESTADO_REPOSO_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => {
                  setEstadoFilter(option.value);
                  resetPagination();
                }}
                className="dashboard-toolbar-menu-item"
              >
                <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
                {estadoFilter === option.value && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <div className="notification-table-scroll-shell rounded-md border">
          <Table className="table-scroll-content min-w-[980px] lg:min-w-full">
            <TableHeader>
              <TableRow className="border-b hover:bg-muted/50">
                <TableHead className="h-10 w-[56px] px-2 text-center text-muted-foreground">
                  Tipo
                </TableHead>
                <TableHead className="h-10 min-w-[130px] px-2 text-center text-muted-foreground">
                  Categoría
                </TableHead>
                <TableHead className="h-10 min-w-[200px] px-2 text-center text-muted-foreground">
                  Correo
                </TableHead>
                <TableHead className="h-10 min-w-[125px] px-2 text-center text-muted-foreground">
                  Fecha Inicio
                </TableHead>
                <TableHead className="h-10 min-w-[125px] px-2 text-center text-muted-foreground">
                  Fecha Fin
                </TableHead>
                <TableHead className="h-10 min-w-[150px] px-2 text-center text-muted-foreground">
                  Fecha Fin Reposo
                </TableHead>
                <TableHead className="h-10 min-w-[125px] px-2 text-center text-muted-foreground">
                  Estado
                </TableHead>
                <TableHead className="h-10 min-w-[74px] px-2 text-center text-muted-foreground">
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
                      <TableCell className="px-2 py-2 text-center">
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
                      <TableCell className="px-2 py-2 text-center">
                        {notif.categoriaNombre}
                      </TableCell>

                      {/* Correo */}
                      <TableCell className="px-2 py-2 text-center text-sm">
                        {notif.correo ?? '—'}
                      </TableCell>

                      {/* Fecha Inicio */}
                      <TableCell className="px-2 py-2 text-center text-sm">
                        {notif.fechaInicio
                          ? formatearFecha(notif.fechaInicio instanceof Date ? notif.fechaInicio.toISOString() : String(notif.fechaInicio))
                          : '-'}
                      </TableCell>

                      {/* Fecha Fin */}
                      <TableCell className="px-2 py-2 text-center text-sm">
                        {notif.fechaFin
                          ? formatearFecha(notif.fechaFin instanceof Date ? notif.fechaFin.toISOString() : String(notif.fechaFin))
                          : '-'}
                      </TableCell>

                      {/* Fecha Fin Reposo */}
                      <TableCell className="px-2 py-2 text-center text-sm">
                        {notif.fechaFinReposo ? formatearFecha(notif.fechaFinReposo instanceof Date ? notif.fechaFinReposo.toISOString() : String(notif.fechaFinReposo)) : '—'}
                      </TableCell>

                      {/* Estado */}
                      <TableCell className="px-2 py-2 text-center">
                        {getEstadoBadge(notif.diasRestantes)}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="px-2 py-2 text-center">
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

        <PaginationFooter
          page={page}
          totalPages={totalPages}
          hasPrevious={hasPrevious}
          hasMore={hasMore}
          onPrevious={previous}
          onNext={next}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          className="px-2 py-2"
        />

      </div>
    </Card>
  );
}
