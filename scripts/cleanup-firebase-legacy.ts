import { config } from 'dotenv';
import * as admin from 'firebase-admin';
import { getFirestore } from './migrate-to-supabase/clients';
import { normalizeFirestoreValue, asString } from './migrate-to-supabase/helpers';
import { FIRESTORE_COLLECTIONS, type FirestoreDoc } from './migrate-to-supabase/types';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

function parseArgs(argv: string[]) {
  return {
    apply: argv.includes('--apply'),
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const firestore = getFirestore();
  const snapshot = await firestore.collection(FIRESTORE_COLLECTIONS.VENTAS).get();
  const ventasWithPagos = snapshot.docs
    .map((doc) => ({
      ref: doc.ref,
      data: {
        id: doc.id,
        ...(normalizeFirestoreValue(doc.data()) as Record<string, unknown>),
      } as FirestoreDoc,
    }))
    .filter(({ data }) => Array.isArray(data.pagos) && data.pagos.length > 0);

  const pagosVentaSnapshot = await firestore.collection(FIRESTORE_COLLECTIONS.PAGOS_VENTA).get();
  const pagosVenta = pagosVentaSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(normalizeFirestoreValue(doc.data()) as Record<string, unknown>),
  })) as FirestoreDoc[];
  const ventasWithCanonicalPayments = new Set(pagosVenta.map((pago) => asString(pago.ventaId)));
  const unsafeVentas = ventasWithPagos.filter(({ data }) => !ventasWithCanonicalPayments.has(data.id));

  if (unsafeVentas.length > 0) {
    throw new Error(
      `Refusing to delete VentaDoc.pagos[]: ${unsafeVentas.length} ventas with embedded pagos have no canonical pagosVenta rows`
    );
  }

  if (apply) {
    const batch = firestore.batch();
    for (const { ref } of ventasWithPagos) {
      batch.update(ref, { pagos: admin.firestore.FieldValue.delete() });
    }
    if (ventasWithPagos.length > 0) await batch.commit();
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        ventasWithEmbeddedPagos: ventasWithPagos.length,
        ventasUpdated: apply ? ventasWithPagos.length : 0,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

