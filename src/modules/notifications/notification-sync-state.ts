let sincronizandoEnCurso = false;
let ultimaSincronizacion: string | null = null;

export function shouldSyncNotifications(): boolean {
  if (typeof window === 'undefined') return false;

  return ultimaSincronizacion !== new Date().toDateString();
}

export function markNotificationsSynced(): void {
  if (typeof window === 'undefined') return;

  ultimaSincronizacion = new Date().toDateString();
}

export function resetNotificationsSyncMarker(): void {
  ultimaSincronizacion = null;
}

export function isNotificationSyncRunning() {
  return sincronizandoEnCurso;
}

export function setNotificationSyncRunning(value: boolean) {
  sincronizandoEnCurso = value;
}
