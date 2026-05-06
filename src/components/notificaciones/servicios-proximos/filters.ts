import { esNotificacionServicio } from '@/types/notificaciones';

import type {
  NotificacionConId,
  NotificacionServicioConId,
} from './types';

function esNotificacionServicioConId(
  notif: NotificacionConId
): notif is NotificacionServicioConId {
  return esNotificacionServicio(notif);
}

export function getServiciosNotificacionesFiltradas(
  notificaciones: NotificacionConId[],
  {
    soloAutorrenovables = false,
    searchQuery = '',
    estadoFilter = 'todos',
  }: {
    soloAutorrenovables?: boolean;
    searchQuery?: string;
    estadoFilter?: string;
  } = {}
): NotificacionServicioConId[] {
  let filtered = notificaciones.filter(esNotificacionServicioConId);

  if (soloAutorrenovables) {
    filtered = filtered.filter((notif) => notif.renovacionAutomatica === true);
  }

  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (notif) =>
        notif.categoriaNombre.toLowerCase().includes(searchLower) ||
        notif.correo.toLowerCase().includes(searchLower)
    );
  }

  if (estadoFilter !== 'todos') {
    if (estadoFilter === 'vencidas') {
      filtered = filtered.filter((notif) => notif.diasRestantes < 0);
    } else if (estadoFilter === 'proximas') {
      filtered = filtered.filter(
        (notif) => notif.diasRestantes >= 0 && notif.diasRestantes <= 7
      );
    } else if (estadoFilter === 'normales') {
      filtered = filtered.filter((notif) => notif.diasRestantes > 7);
    }
  }

  return filtered.sort((a, b) => {
    if (a.resaltada !== b.resaltada) {
      return a.resaltada ? -1 : 1;
    }

    return a.diasRestantes - b.diasRestantes;
  });
}

export function getPaginasNotificacionesServicio(
  serviciosNotificaciones: NotificacionServicioConId[],
  itemsPerPage: number
): NotificacionServicioConId[][] {
  const pages: NotificacionServicioConId[][] = [];

  for (let index = 0; index < serviciosNotificaciones.length; index += itemsPerPage) {
    pages.push(serviciosNotificaciones.slice(index, index + itemsPerPage));
  }

  return pages;
}
