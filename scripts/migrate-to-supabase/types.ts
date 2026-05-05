import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../src/lib/supabase/database.types';
import type { MigrationReport } from './report';
import type { CurrencyConverter } from './currency';

export const FIRESTORE_COLLECTIONS = {
  USUARIOS: 'usuarios',
  SERVICIOS: 'servicios',
  CATEGORIAS: 'categorias',
  METODOS_PAGO: 'metodosPago',
  TIPOS_GASTO: 'tiposGasto',
  ACTIVITY_LOG: 'activityLog',
  CONFIG: 'config',
  GASTOS: 'gastos',
  TEMPLATES: 'templates',
  PAGOS_SERVICIO: 'pagosServicio',
  VENTAS: 'ventas',
  PAGOS_VENTA: 'pagosVenta',
} as const;

export type FirestoreDoc = {
  id: string;
  [key: string]: unknown;
};

export type MigrationOptions = {
  dryRun: boolean;
  only: Set<string> | null;
  batchSize: number;
  reportPath?: string;
};

export type MigrationContext = {
  firestore: FirebaseFirestore.Firestore;
  supabase: SupabaseClient<Database>;
  report: MigrationReport;
  currency: CurrencyConverter;
  options: MigrationOptions;
};

export type InsertRow = Record<string, Json | string | number | boolean | null | undefined>;

export type PeriodSeed = {
  id: string;
  parentId: string;
  numero: number;
  tipo: 'inicial' | 'renovacion';
  fechaInicio: string;
  fechaFin: string;
  cicloPago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  createdAt: string;
};

