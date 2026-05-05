import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from 'dotenv';
import { getFirestore } from './migrate-to-supabase/clients';
import { normalizeFirestoreValue, asNumber, asString, toDateOnly } from './migrate-to-supabase/helpers';
import { FIRESTORE_COLLECTIONS, type FirestoreDoc } from './migrate-to-supabase/types';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type EmbeddedPaymentAudit = {
  ventaId: string;
  embeddedIndex: number;
  embeddedId?: string;
  matchedPagoVentaId?: string;
  reason?: string;
};

async function main() {
  const firestore = getFirestore();
  const [
    ventas,
    pagosVenta,
    pagosServicio,
    servicios,
    usuarios,
    metodosPago,
  ] = await Promise.all([
    readCollection(firestore, FIRESTORE_COLLECTIONS.VENTAS),
    readCollection(firestore, FIRESTORE_COLLECTIONS.PAGOS_VENTA),
    readCollection(firestore, FIRESTORE_COLLECTIONS.PAGOS_SERVICIO),
    readCollection(firestore, FIRESTORE_COLLECTIONS.SERVICIOS),
    readCollection(firestore, FIRESTORE_COLLECTIONS.USUARIOS),
    readCollection(firestore, FIRESTORE_COLLECTIONS.METODOS_PAGO),
  ]);

  const pagosVentaByVenta = groupBy(pagosVenta, 'ventaId');
  const servicioIds = new Set(servicios.map((servicio) => servicio.id));
  const ventaIds = new Set(ventas.map((venta) => venta.id));
  const metodoPagoIds = new Set(metodosPago.map((metodo) => metodo.id));

  const embeddedAudit: EmbeddedPaymentAudit[] = [];
  const ventasWithEmbeddedPagos = ventas.filter((venta) => Array.isArray(venta.pagos) && venta.pagos.length > 0);

  for (const venta of ventasWithEmbeddedPagos) {
    const canonicalPayments = pagosVentaByVenta.get(venta.id) ?? [];
    (venta.pagos as FirestoreDoc[]).forEach((embedded, index) => {
      const match = findEquivalentPagoVenta(embedded, canonicalPayments);
      embeddedAudit.push({
        ventaId: venta.id,
        embeddedIndex: index,
        embeddedId: asString(embedded.id) || undefined,
        matchedPagoVentaId: match?.id,
        reason: match ? undefined : 'no equivalent pagoVenta found',
      });
    });
  }

  const missingMetodoPagoRefs = [
    ...usuarios
      .filter((usuario) => usuario.metodoPagoId && !metodoPagoIds.has(asString(usuario.metodoPagoId)))
      .map((usuario) => ({
        collection: FIRESTORE_COLLECTIONS.USUARIOS,
        id: usuario.id,
        metodoPagoId: asString(usuario.metodoPagoId),
      })),
    ...pagosVenta
      .filter((pago) => pago.metodoPagoId && !metodoPagoIds.has(asString(pago.metodoPagoId)))
      .map((pago) => ({
        collection: FIRESTORE_COLLECTIONS.PAGOS_VENTA,
        id: pago.id,
        metodoPagoId: asString(pago.metodoPagoId),
      })),
    ...pagosServicio
      .filter((pago) => pago.metodoPagoId && !metodoPagoIds.has(asString(pago.metodoPagoId)))
      .map((pago) => ({
        collection: FIRESTORE_COLLECTIONS.PAGOS_SERVICIO,
        id: pago.id,
        metodoPagoId: asString(pago.metodoPagoId),
      })),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    counts: {
      ventas: ventas.length,
      pagosVenta: pagosVenta.length,
      pagosServicio: pagosServicio.length,
      servicios: servicios.length,
      usuarios: usuarios.length,
      metodosPago: metodosPago.length,
      ventasWithEmbeddedPagos: ventasWithEmbeddedPagos.length,
      embeddedPagos: embeddedAudit.length,
      embeddedPagosWithoutEquivalent: embeddedAudit.filter((item) => !item.matchedPagoVentaId).length,
      ventasWithMissingServicio: ventas.filter((venta) => venta.servicioId && !servicioIds.has(asString(venta.servicioId))).length,
      pagosVentaWithMissingVenta: pagosVenta.filter((pago) => pago.ventaId && !ventaIds.has(asString(pago.ventaId))).length,
      pagosServicioWithMissingServicio: pagosServicio.filter((pago) => pago.servicioId && !servicioIds.has(asString(pago.servicioId))).length,
      missingMetodoPagoRefs: missingMetodoPagoRefs.length,
      missingMetodoPagoIds: new Set(missingMetodoPagoRefs.map((ref) => ref.metodoPagoId)).size,
    },
    embeddedPagos: embeddedAudit,
    missingMetodoPagoRefs,
    orphanRefs: {
      ventasWithMissingServicio: ventas
        .filter((venta) => venta.servicioId && !servicioIds.has(asString(venta.servicioId)))
        .map((venta) => ({ id: venta.id, servicioId: venta.servicioId })),
      pagosVentaWithMissingVenta: pagosVenta
        .filter((pago) => pago.ventaId && !ventaIds.has(asString(pago.ventaId)))
        .map((pago) => ({ id: pago.id, ventaId: pago.ventaId })),
      pagosServicioWithMissingServicio: pagosServicio
        .filter((pago) => pago.servicioId && !servicioIds.has(asString(pago.servicioId)))
        .map((pago) => ({ id: pago.id, servicioId: pago.servicioId })),
    },
  };

  const reportPath = join(
    process.cwd(),
    'scripts',
    'migrate-to-supabase',
    'reports',
    `firebase-legacy-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(
    JSON.stringify(
      {
        reportPath,
        counts: report.counts,
        missingMetodoPagoIds: [...new Set(missingMetodoPagoRefs.map((ref) => ref.metodoPagoId))],
      },
      null,
      2
    )
  );
}

async function readCollection(
  firestore: FirebaseFirestore.Firestore,
  collectionName: string
): Promise<FirestoreDoc[]> {
  const snapshot = await firestore.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(normalizeFirestoreValue(doc.data()) as Record<string, unknown>),
  }));
}

function groupBy(rows: FirestoreDoc[], field: string): Map<string, FirestoreDoc[]> {
  const grouped = new Map<string, FirestoreDoc[]>();
  for (const row of rows) {
    const key = asString(row[field]);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function findEquivalentPagoVenta(embedded: FirestoreDoc, canonicalPayments: FirestoreDoc[]) {
  const embeddedId = asString(embedded.id);
  if (embeddedId) {
    const byId = canonicalPayments.find((payment) => payment.id === embeddedId);
    if (byId) return byId;
  }

  return canonicalPayments.find((payment) => {
    const embeddedTotal = asNumber(embedded.total ?? embedded.precio, Number.NaN);
    const paymentTotal = asNumber(payment.monto, Number.NaN);
    if (!moneyEquals(embeddedTotal, paymentTotal)) return false;

    const embeddedStart = toDateOnly(embedded.fechaInicio);
    const paymentStart = toDateOnly(payment.fechaInicio);
    const embeddedEnd = toDateOnly(embedded.fechaVencimiento);
    const paymentEnd = toDateOnly(payment.fechaVencimiento);
    if (embeddedStart && paymentStart && embeddedStart !== paymentStart) return false;
    if (embeddedEnd && paymentEnd && embeddedEnd !== paymentEnd) return false;

    const embeddedCycle = asString(embedded.cicloPago);
    const paymentCycle = asString(payment.cicloPago);
    return !embeddedCycle || !paymentCycle || embeddedCycle === paymentCycle;
  });
}

function moneyEquals(left: number, right: number) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.01;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

