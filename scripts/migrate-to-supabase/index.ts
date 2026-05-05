import { join } from 'node:path';
import { getFirestore, getSupabase } from './clients';
import { CurrencyConverter, migrateCurrencies } from './currency';
import { insertLegacyOrphans, readCollection } from './helpers';
import { MigrationReport } from './report';
import { FIRESTORE_COLLECTIONS, type FirestoreDoc, type MigrationContext, type MigrationOptions } from './types';
import {
  buildCatalogResult,
  migrateCategorias,
  migrateConfig,
  migrateGastos,
  migrateMetodosPago,
  migrateTemplates,
  migrateTiposGasto,
  migrateUsuarios,
  withMissingMetodoPagoPlaceholders,
} from './migrators/catalogs';
import { migrateActivityLog } from './migrators/activity-log';
import { migrateServiciosFinancial, migrateVentasFinancial } from './migrators/financial';

type LoadedCollections = Record<string, FirestoreDoc[]>;

export async function runMigration(options: MigrationOptions) {
  const report = new MigrationReport(options.dryRun);
  const currency = new CurrencyConverter();
  const ctx: MigrationContext = {
    firestore: getFirestore(),
    supabase: getSupabase(),
    report,
    currency,
    options,
  };

  const data = await loadCollections(ctx);
  await currency.load(ctx);
  data.metodosPago = withMissingMetodoPagoPlaceholders(ctx, data.metodosPago, [
    data.usuarios,
    data.pagosVenta,
    data.pagosServicio,
  ]);

  const catalogs = buildCatalogResult(
    data.categorias,
    data.metodosPago,
    data.tiposGasto,
    data.usuarios
  );

  try {
    if (shouldRun(options, 'currencies')) await migrateCurrencies(ctx, data);
    if (shouldRun(options, 'metodos-pago')) await migrateMetodosPago(ctx, data.metodosPago);
    if (shouldRun(options, 'categorias')) await migrateCategorias(ctx, data.categorias);
    if (shouldRun(options, 'usuarios')) await migrateUsuarios(ctx, data.usuarios, catalogs.metodoPagoIds);
    if (shouldRun(options, 'tipos-gasto')) await migrateTiposGasto(ctx, data.tiposGasto);
    if (shouldRun(options, 'gastos')) await migrateGastos(ctx, data.gastos, catalogs.tipoGastoIds);
    if (shouldRun(options, 'templates')) await migrateTemplates(ctx, data.templates);
    if (shouldRun(options, 'config')) await migrateConfig(ctx, data.config);
    if (shouldRun(options, 'servicios')) {
      await migrateServiciosFinancial(ctx, data.servicios, data.pagosServicio, catalogs);
    }
    if (shouldRun(options, 'ventas')) {
      await migrateVentasFinancial(ctx, data.ventas, data.pagosVenta, data.servicios, catalogs);
    }
    if (shouldRun(options, 'activity-log')) await migrateActivityLog(ctx, data.activityLog);
    await insertLegacyOrphans(ctx);
  } catch (error) {
    report.error(error instanceof Error ? error.message : 'Unknown migration error');
    throw error;
  } finally {
    const reportPath =
      options.reportPath ??
      join(
        process.cwd(),
        'scripts',
        'migrate-to-supabase',
        'reports',
        `migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );
    await report.save(reportPath);
    console.log(JSON.stringify(report.summary(reportPath), null, 2));
  }
}

function shouldRun(options: MigrationOptions, key: string): boolean {
  return !options.only || options.only.has(key);
}

async function loadCollections(ctx: MigrationContext): Promise<LoadedCollections> {
  return {
    usuarios: await readCollection(ctx, FIRESTORE_COLLECTIONS.USUARIOS),
    servicios: await readCollection(ctx, FIRESTORE_COLLECTIONS.SERVICIOS),
    categorias: await readCollection(ctx, FIRESTORE_COLLECTIONS.CATEGORIAS),
    metodosPago: await readCollection(ctx, FIRESTORE_COLLECTIONS.METODOS_PAGO),
    tiposGasto: await readCollection(ctx, FIRESTORE_COLLECTIONS.TIPOS_GASTO),
    activityLog: await readCollection(ctx, FIRESTORE_COLLECTIONS.ACTIVITY_LOG),
    config: await readCollection(ctx, FIRESTORE_COLLECTIONS.CONFIG),
    gastos: await readCollection(ctx, FIRESTORE_COLLECTIONS.GASTOS),
    templates: await readCollection(ctx, FIRESTORE_COLLECTIONS.TEMPLATES),
    pagosServicio: await readCollection(ctx, FIRESTORE_COLLECTIONS.PAGOS_SERVICIO),
    ventas: await readCollection(ctx, FIRESTORE_COLLECTIONS.VENTAS),
    pagosVenta: await readCollection(ctx, FIRESTORE_COLLECTIONS.PAGOS_VENTA),
  };
}
