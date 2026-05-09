import { OFFLINE_DB_NAME, OFFLINE_DB_VERSION, OFFLINE_SNAPSHOT_KEY, OFFLINE_STORE_NAME } from './offline-constants';
import type { OfflineAppSnapshot } from './offline-types';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base offline.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        db.createObjectStore(OFFLINE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveOfflineSnapshot(snapshot: OfflineAppSnapshot): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar el snapshot offline.'));
    tx.objectStore(OFFLINE_STORE_NAME).put(snapshot, OFFLINE_SNAPSHOT_KEY);
  });
  db.close();
}

export async function getOfflineSnapshot(): Promise<OfflineAppSnapshot | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDb();
  const snapshot = await new Promise<OfflineAppSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo leer el snapshot offline.'));
    const request = tx.objectStore(OFFLINE_STORE_NAME).get(OFFLINE_SNAPSHOT_KEY);
    request.onerror = () => reject(request.error ?? new Error('No se pudo leer el snapshot offline.'));
    request.onsuccess = () => resolve((request.result as OfflineAppSnapshot | undefined) ?? null);
  });
  db.close();
  return snapshot;
}
