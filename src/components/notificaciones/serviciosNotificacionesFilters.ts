import { esNotificacionServicio } from '@/types/notificaciones';
import type { Notificacion, NotificacionServicio } from '@/types/notificaciones';

export function filtrarServiciosNotificaciones(
  notificaciones: (Notificacion & { id: string })[],
  {
    soloAutorrenovables = false,
    searchQuery = '',
    estadoFilter = 'todos',
  }: {
    soloAutorrenovables?: boolean;
    searchQuery?: string;
    estadoFilter?: string;
  } = {}
): (NotificacionServicio & { id: string })[] {
  let filtered = notificaciones.filter(esNotificacionServicio) as (NotificacionServicio & { id: string })[];

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
      filtered = filtered.filter((n) => n.diasRestantes < 0);
    } else if (estadoFilter === 'proximas') {
      filtered = filtered.filter((n) => n.diasRestantes >= 0 && n.diasRestantes <= 7);
    } else if (estadoFilter === 'normales') {
      filtered = filtered.filter((n) => n.diasRestantes > 7);
    }
  }

  return filtered.sort((a, b) => {
    if (a.resaltada !== b.resaltada) {
      return a.resaltada ? -1 : 1;
    }
    return a.diasRestantes - b.diasRestantes;
  });
}
