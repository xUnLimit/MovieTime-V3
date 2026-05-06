import { esNotificacionVenta } from '@/types/notificaciones';

import type {
  NotificacionConId,
  NotificacionVentaConId,
} from './types';

function esNotificacionVentaConId(
  notif: NotificacionConId
): notif is NotificacionVentaConId {
  return esNotificacionVenta(notif);
}

function getFechaLocalKey(fecha: Date): string {
  const date = new Date(fecha);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getGrupoPaginacionVenta(notif: NotificacionVentaConId): string {
  return [
    notif.resaltada ? 'resaltada' : 'normal',
    notif.diasRestantes,
    getFechaLocalKey(notif.fechaFin),
    notif.clienteId || notif.clienteNombre.toLocaleLowerCase('es'),
  ].join('|');
}

export function getVentasNotificacionesFiltradas(
  notificaciones: NotificacionConId[],
  searchQuery: string,
  estadoFilter: string
): NotificacionVentaConId[] {
  let filtered = notificaciones.filter(esNotificacionVentaConId);

  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (notif) =>
        notif.clienteNombre.toLowerCase().includes(searchLower) ||
        notif.categoriaNombre.toLowerCase().includes(searchLower)
    );
  }

  if (estadoFilter !== 'todos') {
    if (estadoFilter === 'proximas') {
      filtered = filtered.filter((n) => n.diasRestantes > 0);
    } else if (estadoFilter === 'dia_pago') {
      filtered = filtered.filter((n) => n.diasRestantes === 0);
    } else if (estadoFilter === 'vencidas') {
      filtered = filtered.filter((n) => n.diasRestantes < 0);
    }
  }

  return filtered.sort((a, b) => {
    if (a.resaltada !== b.resaltada) {
      return a.resaltada ? -1 : 1;
    }

    const diasDiff = a.diasRestantes - b.diasRestantes;
    if (diasDiff !== 0) return diasDiff;

    const fechaDiff =
      new Date(a.fechaFin).getTime() - new Date(b.fechaFin).getTime();
    if (fechaDiff !== 0) return fechaDiff;

    const clienteDiff = a.clienteNombre.localeCompare(b.clienteNombre, 'es', {
      sensitivity: 'base',
    });
    if (clienteDiff !== 0) return clienteDiff;

    return a.id.localeCompare(b.id);
  });
}

export function getPaginasNotificacionesVenta(
  ventasNotificaciones: NotificacionVentaConId[],
  itemsPerPage: number
): NotificacionVentaConId[][] {
  const pages: NotificacionVentaConId[][] = [];
  let currentPageItems: NotificacionVentaConId[] = [];

  for (let index = 0; index < ventasNotificaciones.length;) {
    const groupKey = getGrupoPaginacionVenta(ventasNotificaciones[index]);
    const group: NotificacionVentaConId[] = [];

    while (
      index < ventasNotificaciones.length &&
      getGrupoPaginacionVenta(ventasNotificaciones[index]) === groupKey
    ) {
      group.push(ventasNotificaciones[index]);
      index++;
    }

    if (
      currentPageItems.length > 0 &&
      group.length <= itemsPerPage &&
      currentPageItems.length + group.length > itemsPerPage
    ) {
      pages.push(currentPageItems);
      currentPageItems = [];
    }

    if (group.length > itemsPerPage) {
      if (currentPageItems.length > 0) {
        pages.push(currentPageItems);
        currentPageItems = [];
      }

      for (
        let groupIndex = 0;
        groupIndex < group.length;
        groupIndex += itemsPerPage
      ) {
        pages.push(group.slice(groupIndex, groupIndex + itemsPerPage));
      }
    } else {
      currentPageItems.push(...group);
    }
  }

  if (currentPageItems.length > 0) {
    pages.push(currentPageItems);
  }

  return pages;
}
