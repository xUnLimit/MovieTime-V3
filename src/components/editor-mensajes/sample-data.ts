import { buildMessageData, type NoticeGroup, type NoticeVenta } from '@/modules/messaging/message-data';

function venta(id: string, categoria: string, perfil: string, monto: number): NoticeVenta {
  return {
    ventaId: id,
    clienteId: 'muestra',
    clienteNombre: 'María Pérez',
    telefono: '60000000',
    categoriaNombre: categoria,
    servicioNombre: `${categoria} 01`,
    perfilNombre: perfil,
    correo: 'cuenta@ejemplo.com',
    contrasena: '********',
    codigo: 'MT-1024',
    fechaVencimiento: new Date(2026, 9, 5),
    monto,
    moneda: 'USD',
    activa: true,
    reembolsada: false,
    enReposo: false,
    promesaPagoHasta: null,
    respuestaCliente: null,
  };
}

const SAMPLE_GROUP: NoticeGroup = {
  clienteId: 'muestra',
  clienteNombre: 'María Pérez',
  telefono: '60000000',
  fechaVencimiento: new Date(2026, 9, 5),
  moneda: 'USD',
  ventas: [venta('v1', 'Netflix', 'Perfil 2', 4.5), venta('v2', 'Disney+', 'Perfil 1', 3)],
};

// Datos de ejemplo fijos para previsualizar un tipo sin depender de ventas reales.
export const SAMPLE_MESSAGE_DATA = buildMessageData(SAMPLE_GROUP, {
  saludo: 'Buenas tardes',
  now: new Date(2026, 8, 28, 15, 0),
});
