// Legacy compatibility barrel.
// New code should import notification sync capabilities from `@/lib/notifications`.
export {
  sincronizarNotificaciones,
  sincronizarNotificacionesForzado,
  sincronizarUnaVenta,
  sincronizarUnServicio,
} from '@/lib/notifications/notification-sync-orchestrator';
