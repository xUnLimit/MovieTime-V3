import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  DocumentData,
  QueryConstraint,
  WhereFilterOp,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import { logCacheHit as devLogCacheHit, logFirestoreOp } from '@/lib/utils/devLogger';

/**
 * Generic Firestore service for CRUD operations
 */

// Convert Firestore Timestamp to Date
export const timestampToDate = (timestamp: unknown): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return new Date();
};

// Convert Date to Firestore Timestamp
export const dateToTimestamp = (date: Date | string): Timestamp => {
  if (date instanceof Date) {
    return Timestamp.fromDate(date);
  }
  return Timestamp.fromDate(new Date(date));
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

const sanitizeFirestoreValue = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  // Keep Firestore-friendly special values as-is
  if (value instanceof Date || value instanceof Timestamp) return value;

  if (Array.isArray(value)) {
    return value
      .map(sanitizeFirestoreValue)
      .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, nested]) => [key, sanitizeFirestoreValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined);
    return Object.fromEntries(entries);
  }

  return value;
};

const removeUndefinedFields = <T extends Record<string, unknown>>(data: T): T => {
  return sanitizeFirestoreValue(data) as T;
};

/**
 * Recursively convert Firestore Timestamps to Dates
 */
export function convertTimestamps(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  
  if (data instanceof Timestamp) {
    return data.toDate();
  }
  
  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = convertTimestamps(value);
  }
  return result;
}

/**
 * Dev-only: log cuando un store evita una lectura por caché
 */
export function logCacheHit(collectionName: string) {
  devLogCacheHit(collectionName);
}

/**
 * Get all documents from a collection with automatic timestamp conversion
 */
export async function getAll<T>(collectionName: string): Promise<T[]> {
  const start = Date.now();
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const docs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...(convertTimestamps(data) as Record<string, unknown>),
      } as T;
    });
    logFirestoreOp('getAll', collectionName, `${docs.length} docs`, Date.now() - start);
    return docs;
  } catch (error) {
    console.error(`Error getting ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get a single document by ID with automatic timestamp conversion
 */
export async function getById<T>(collectionName: string, id: string): Promise<T | null> {
  const start = Date.now();
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);

    let result: T | null = null;
    if (docSnap.exists()) {
      const data = docSnap.data();
      result = {
        id: docSnap.id,
        ...(convertTimestamps(data) as Record<string, unknown>),
      } as T;
    }
    logFirestoreOp('getById', `${collectionName}/${id}`, result ? 'encontrado' : 'null', Date.now() - start);
    return result;
  } catch (error) {
    console.error(`Error getting document ${id} from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Query documents with filters and automatic timestamp conversion
 */
export async function queryDocuments<T>(
  collectionName: string,
  filters: { field: string; operator: WhereFilterOp; value: unknown }[] = []
): Promise<T[]> {
  const start = Date.now();
  try {
    const constraints: QueryConstraint[] = filters.map(filter =>
      where(filter.field, filter.operator, filter.value)
    );

    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);

    const docs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...(convertTimestamps(data) as Record<string, unknown>),
      } as T;
    });
    const filterStr = filters.map(f => `${f.field} ${f.operator} ${JSON.stringify(f.value)}`).join(', ');
    const details = filterStr ? `where ${filterStr} → ${docs.length} docs` : `${docs.length} docs`;
    logFirestoreOp('query', collectionName, details, Date.now() - start);
    return docs;
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Count documents in a collection (without fetching data).
 * Costs 1 read regardless of collection size.
 */
export async function getCount(
  collectionName: string,
  filters: { field: string; operator: WhereFilterOp; value: unknown }[] = []
): Promise<number> {
  const start = Date.now();
  try {
    const constraints: QueryConstraint[] = filters.map(filter =>
      where(filter.field, filter.operator, filter.value)
    );
    const q = query(collection(db, collectionName), ...constraints);
    const snapshot = await getCountFromServer(q);
    const count = snapshot.data().count;

    const filterStr = filters.map(f => `${f.field} ${f.operator} ${JSON.stringify(f.value)}`).join(', ');
    const details = filterStr ? `where ${filterStr} → ${count}` : `${count}`;
    logFirestoreOp('count', collectionName, details, Date.now() - start);
    return count;
  } catch (error) {
    console.error(`Error counting ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Create a new document
 */
export async function create<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, 'id'>
): Promise<string> {
  try {
    const now = Timestamp.now();
    const cleanedData = removeUndefinedFields(data as Record<string, unknown>);
    const docRef = await addDoc(collection(db, collectionName), {
      ...cleanedData,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Update an existing document
 */
export async function update<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    const cleanedData = removeUndefinedFields(data as Record<string, unknown>);
    await updateDoc(docRef, {
      ...cleanedData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(`Error updating document ${id} in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete a document
 */
export async function remove(collectionName: string, id: string): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document ${id} from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Incrementa o decrementa el campo `serviciosActivos` de un usuario de forma atómica.
 * Si el campo no existe, `increment` lo inicializa en 0 antes de ajustar.
 * @param clienteId  – id del documento en la colección `usuarios`
 * @param delta      – +1 al crear venta activa, -1 al eliminar/inactivar
 */
export async function adjustServiciosActivos(clienteId: string, delta: number): Promise<void> {
  if (!clienteId) return;
  try {
    const docRef = doc(db, 'usuarios', clienteId);
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      const serviciosActivosActuales = docSnap.exists()
        ? Number(docSnap.data().serviciosActivos ?? 0)
        : 0;
      const serviciosActivosSaneados = Number.isFinite(serviciosActivosActuales)
        ? Math.max(0, serviciosActivosActuales)
        : 0;
      const siguienteValor = Math.max(0, serviciosActivosSaneados + delta);

      transaction.update(docRef, { serviciosActivos: siguienteValor });
    });
  } catch (error) {
    console.error(`Error ajustando serviciosActivos para usuario ${clienteId}:`, error);
  }
}

/**
 * Incrementa o decrementa los contadores de ventas e ingresos de una categoría de forma atómica.
 * @param categoriaId – id del documento en la colección `categorias`
 * @param ventasDelta – +1 al crear venta, -1 al eliminar
 * @param ingresosDelta – monto a sumar/restar
 */
export async function adjustCategoriaSuscripciones(
  categoriaId: string,
  ventasDelta: number,
  ingresosDelta: number
): Promise<void> {
  if (!categoriaId) return;
  try {
    const docRef = doc(db, COLLECTIONS.CATEGORIAS, categoriaId);
    await updateDoc(docRef, {
      ventasTotales: increment(ventasDelta),
      ingresosTotales: increment(ingresosDelta),
    });
  } catch (error) {
    console.error(`Error ajustando contadores para categoría ${categoriaId}:`, error);
  }
}

/**
 * Incrementa o decrementa el campo gastosTotal de una categoría de forma atómica.
 * @param categoriaId – id del documento en la colección `categorias`
 * @param gastosDelta – monto a sumar (+) o restar (-)
 */
export async function adjustCategoriaGastos(
  categoriaId: string,
  gastosDelta: number
): Promise<void> {
  if (!categoriaId) return;
  try {
    const docRef = doc(db, COLLECTIONS.CATEGORIAS, categoriaId);
    await updateDoc(docRef, {
      gastosTotal: increment(gastosDelta),
    });
  } catch (error) {
    console.error(`Error ajustando gastosTotal para categoría ${categoriaId}:`, error);
  }
}

/**
 * Collection names constants
 */
export const COLLECTIONS = {
  USUARIOS: 'usuarios',
  SERVICIOS: 'servicios',
  CATEGORIAS: 'categorias',
  METODOS_PAGO: 'metodosPago',
  TIPOS_GASTO: 'tiposGasto',
  ACTIVITY_LOG: 'activityLog',
  CONFIG: 'config',
  GASTOS: 'gastos',
  TEMPLATES: 'templates',
  NOTIFICACIONES: 'notificaciones',
  PAGOS_SERVICIO: 'pagosServicio',
  VENTAS: 'ventas',
  PAGOS_VENTA: 'pagosVenta',
} as const;
