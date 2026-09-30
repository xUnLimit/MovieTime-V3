import { formatearFechaWhatsApp, getSaludo } from './whatsapp';

// Datos de una venta necesarios para llenar las plantillas del editor de mensajes.
export type VentaMessageContext = {
  clienteNombre: string;
  categoriaNombre: string;
  servicioNombre: string;
  perfilNombre: string;
  correo: string;
  contrasena: string;
  codigo: string;
  fechaVencimiento: Date | null;
  monto: number;
};
const EMPTY = '—';

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function formatMonto(monto: number) {
  return `$${monto.toFixed(2)}`;
}

export function formatVencimiento(fecha: Date | null) {
  return fecha ? formatearFechaWhatsApp(fecha) : EMPTY;
}

export function greetingFor(nombre: string, saludo = getSaludo()) {
  const name = firstName(nombre);
  return name ? `${saludo}, ${name}` : saludo;
}
