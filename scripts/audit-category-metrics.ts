import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { getFirestore } from './migrate-to-supabase/clients';

loadEnv({ path: '.env.local' });

type FirestoreDoc = Record<string, unknown> & { id: string };

const TARGETS = ['Crunchyroll', 'Prime Video', 'HBO Max', 'Spotify'];
const DETAIL_VENTA_IDS = [
  'X7pke60jiPUahz3wFz0V',
  'kLZbOaXAzqhmTbfyFQjZ',
  'OORyT0zsbOFwRfIDIEAH',
  'oZzD0T6qtwRzARy0Rxkb',
];
const DETAIL_PAGO_IDS = ['ruTkPRPVfuORsSKQWGZP', 'vLOpnDTugFEWMgmU9V9n'];

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

async function main() {
  const firestore = getFirestore();

  const [categoriasSnap, ventasSnap, pagosVentaSnap, serviciosSnap] = await Promise.all([
    firestore.collection('categorias').get(),
    firestore.collection('ventas').get(),
    firestore.collection('pagosVenta').get(),
    firestore.collection('servicios').get(),
  ]);

  const firebaseCategorias = categoriasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FirestoreDoc);
  const firebaseVentas = ventasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FirestoreDoc);
  const firebasePagos = pagosVentaSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FirestoreDoc);
  const firebaseServicios = serviciosSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as FirestoreDoc);
  const detailVentas = firebaseVentas
    .filter((venta) => DETAIL_VENTA_IDS.includes(venta.id))
    .map((venta) => ({
      id: venta.id,
      categoriaId: venta.categoriaId,
      servicioId: venta.servicioId,
      clienteId: venta.clienteId,
      estado: venta.estado ?? 'activo',
      perfilNumero: venta.perfilNumero,
      precioFinal: venta.precioFinal,
      moneda: venta.moneda,
      fechaInicio: venta.fechaInicio,
      fechaFin: venta.fechaFin,
      pagos: firebasePagos
        .filter((pago) => pago.ventaId === venta.id)
        .map((pago) => ({
          id: pago.id,
          monto: pago.monto,
          moneda: pago.moneda,
          fechaInicio: pago.fechaInicio,
          fechaVencimiento: pago.fechaVencimiento,
        })),
    }));
  console.log(JSON.stringify({ detailVentas }, null, 2));
  console.log(JSON.stringify({
    detailPagos: firebasePagos
      .filter((pago) => DETAIL_PAGO_IDS.includes(pago.id))
      .map((pago) => ({
        id: pago.id,
        ventaId: pago.ventaId,
        monto: pago.monto,
        total: pago.total,
        moneda: pago.moneda,
        fecha: pago.fecha,
        fechaInicio: pago.fechaInicio,
        fechaVencimiento: pago.fechaVencimiento,
        createdAt: pago.createdAt,
      })),
    detailServicios: firebaseServicios
      .filter((servicio) => detailVentas.some((venta) => venta.servicioId === servicio.id))
      .map((servicio) => ({
        id: servicio.id,
        nombre: servicio.nombre,
        categoriaId: servicio.categoriaId,
        tipo: servicio.tipo,
        activo: servicio.activo,
        enReposo: servicio.enReposo,
        perfilesDisponibles: servicio.perfilesDisponibles,
        perfilesOcupados: servicio.perfilesOcupados,
      })),
  }, null, 2));

  for (const target of TARGETS) {
    const firebaseCategoria = firebaseCategorias.find((categoria) => categoria.nombre === target);
    if (!firebaseCategoria) {
      console.log(JSON.stringify({ target, error: 'category missing' }, null, 2));
      continue;
    }

    const fbVentas = firebaseVentas.filter((venta) => venta.categoriaId === firebaseCategoria.id);
    const fbActiveVentas = fbVentas.filter((venta) => asString(venta.estado, 'activo') !== 'inactivo');

    const fbVentaIds = new Set(fbVentas.map((venta) => venta.id));
    const fbPagos = firebasePagos.filter((pago) => fbVentaIds.has(asString(pago.ventaId)));
    const activeProfileDuplicates = findActiveProfileDuplicates(fbActiveVentas);
    const firebaseServicioIds = new Set(firebaseServicios.map((servicio) => servicio.id));
    const missingServiceVentas = fbVentas
      .filter((venta) => !firebaseServicioIds.has(asString(venta.servicioId)))
      .map((venta) => ({
        id: venta.id,
        servicioId: venta.servicioId,
        clienteId: venta.clienteId,
        estado: venta.estado ?? 'activo',
        perfilNumero: venta.perfilNumero,
        precioFinal: venta.precioFinal,
        moneda: venta.moneda,
        fechaInicio: venta.fechaInicio,
        fechaFin: venta.fechaFin,
        pagos: fbPagos
          .filter((pago) => pago.ventaId === venta.id)
          .map((pago) => ({
            id: pago.id,
            monto: pago.monto,
            total: pago.total,
            moneda: pago.moneda,
            fecha: pago.fecha,
            fechaInicio: pago.fechaInicio,
            fechaVencimiento: pago.fechaVencimiento,
            createdAt: pago.createdAt,
          })),
      }));

    console.log(JSON.stringify({
      category: target,
      categoriaId: firebaseCategoria.id,
      firebase: {
        activeVentas: fbActiveVentas.length,
        totalVentas: fbVentas.length,
        totalPagosVenta: fbPagos.length,
        rawIncomeOriginalSum: fbPagos.reduce((sum, pago) => sum + asNumber(pago.monto ?? pago.total), 0),
      },
      activeProfileDuplicates,
      missingServiceVentas,
      missingServiceIncome: missingServiceVentas.reduce(
        (sum, venta) => sum + venta.pagos.reduce((paymentSum, pago) => paymentSum + asNumber(pago.monto ?? pago.total), 0),
        0
      ),
    }, null, 2));
  }
}

function findActiveProfileDuplicates(ventas: FirestoreDoc[]) {
  const byProfile = new Map<string, FirestoreDoc[]>();
  for (const venta of ventas) {
    const servicioId = asString(venta.servicioId);
    const perfilNumero = venta.perfilNumero;
    if (!servicioId || perfilNumero === undefined || perfilNumero === null) continue;
    const key = `${servicioId}:${perfilNumero}`;
    byProfile.set(key, [...(byProfile.get(key) ?? []), venta]);
  }

  return [...byProfile.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      ventas: items.map((venta) => ({
        id: venta.id,
        servicioId: venta.servicioId,
        perfilNumero: venta.perfilNumero,
        createdAt: venta.createdAt,
        updatedAt: venta.updatedAt,
      })),
    }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
