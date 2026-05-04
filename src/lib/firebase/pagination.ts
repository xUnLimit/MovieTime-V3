import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  WhereFilterOp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './config';
import { convertTimestamps } from './firestore';
import { logFirestoreOp } from '@/lib/utils/devLogger';

export interface FilterOption {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
}

export interface PaginationOptions {
  pageSize: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  startAfterDoc?: QueryDocumentSnapshot<DocumentData>;
  filters?: FilterOption[];
}

export interface PaginatedResult<T> {
  docs: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

/**
 * Fetch paginated documents from a Firestore collection.
 * Costs pageSize + 1 reads (one extra to detect hasMore).
 */
export async function getPaginated<T>(
  collectionName: string,
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  const {
    pageSize,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    startAfterDoc,
    filters = [],
  } = options;

  const start = Date.now();

  try {
    const filterConstraints: QueryConstraint[] = filters.map(f =>
      where(f.field, f.operator, f.value)
    );

    let q = query(
      collection(db, collectionName),
      ...filterConstraints,
      orderBy(orderByField, orderDirection),
      limit(pageSize + 1)
    );

    if (startAfterDoc) {
      q = query(q, startAfter(startAfterDoc));
    }

    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs.slice(0, pageSize);
    const hasMore = querySnapshot.docs.length > pageSize;
    const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

    const filterStr = filters.map(f => `${f.field} ${f.operator} ${JSON.stringify(f.value)}`).join(', ');
    const details = filterStr ? `where ${filterStr} → ${docs.length} docs` : `${docs.length} docs`;
    logFirestoreOp('paginated', collectionName, details, Date.now() - start);

    return {
      docs: docs.map(doc => ({
        id: doc.id,
        ...(convertTimestamps(doc.data()) as Record<string, unknown>),
      } as T)),
      lastDoc,
      hasMore,
    };
  } catch (error) {
    console.error(`Error getting paginated ${collectionName}:`, error);
    throw error;
  }
}
