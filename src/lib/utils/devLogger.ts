/**
 * Utilidad para logging en desarrollo que evita duplicados por React Strict Mode
 *
 * React 18+ ejecuta efectos dos veces en modo desarrollo (Strict Mode) para
 * detectar efectos secundarios. Este sistema deduplica logs que ocurren dentro
 * de una ventana de tiempo, mostrando solo el primero.
 */

// Map para rastrear logs recientes con timestamp del primer log
const recentLogs = new Map<string, number>();
const LOG_DEBOUNCE_MS = 500; // 500ms es suficiente para capturar duplicados de Strict Mode

/**
 * Crea una key normalizada para el log, ignorando valores variables como duración
 * Esto permite que logs con diferentes duraciones (43ms vs 45ms) se consideren iguales.
 */
function getLogKey(message: string): string {
  // Normalizar mensaje removiendo:
  // - Duraciones en ms: "· 45ms" → ""
  // - Edad de cache: "· age 3s" → ""
  return message
    .replace(/\s*·\s*\d+ms$/i, '')
    .replace(/\s*·\s*age\s+\d+s$/i, '')
    .trim();
}

function shouldLog(message: string): boolean {
  const key = getLogKey(message);
  const now = Date.now();
  const lastLogTime = recentLogs.get(key);

  // Si se logueó el mismo mensaje hace menos de LOG_DEBOUNCE_MS, ignorar
  if (lastLogTime && (now - lastLogTime) < LOG_DEBOUNCE_MS) {
    return false;
  }

  // Registrar este log
  recentLogs.set(key, now);

  // Limpiar logs antiguos después de 2 segundos
  setTimeout(() => {
    const currentTime = recentLogs.get(key);
    if (currentTime === now) {
      recentLogs.delete(key);
    }
  }, 2000);

  return true;
}

/**
 * Log de éxito de cache (verde)
 */
export function logCacheHit(collectionName: string, details?: string) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = `[Cache] Hit (${collectionName})${details ? ' · ' + details : ''}`;
  if (!shouldLog(message)) return;

  console.log(
    '%c[Cache]%c Hit (' + collectionName + ')' + (details ? ' · ' + details : '') + ' → sin lectura a Firestore',
    'background:#FF9800;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
    'color:#FF9800;font-weight:600'
  );
}

/**
 * Log de operación Firestore (azul/verde/morado según tipo)
 */
export function logFirestoreOp(
  operation: 'getAll' | 'getById' | 'query' | 'paginated' | 'count',
  collectionName: string,
  details: string,
  duration: number
) {
  if (process.env.NODE_ENV !== 'development') return;

  const message = `[Firestore] ${operation} (${collectionName}) ${details}`;
  if (!shouldLog(message)) return;

  const colors: Record<typeof operation, string> = {
    getAll: '#4CAF50',
    getById: '#4CAF50',
    query: '#4CAF50',
    paginated: '#2196F3',
    count: '#9C27B0',
  };

  const color = colors[operation];

  console.log(
    '%c[Firestore]%c ' + operation + ' (' + collectionName + ') → ' + details + ' · ' + duration + 'ms',
    `background:${color};color:#fff;padding:2px 6px;border-radius:3px;font-weight:600`,
    `color:${color};font-weight:600`
  );
}

/**
 * Log específico para cache de ventas
 */
export function logVentasCacheHit(clientCount: number, ageSeconds: number) {
  if (process.env.NODE_ENV !== 'development') return;

  // Incluir age en el mensaje base para la deduplicación
  const message = `[VentasCache] HIT · ${clientCount} IDs · age ${ageSeconds}s`;
  if (!shouldLog(message)) return;

  console.log(
    '%c[VentasCache]%c HIT · ' + clientCount + ' IDs · age ' + ageSeconds + 's',
    'background:#4CAF50;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
    'color:#4CAF50;font-weight:600'
  );
}
