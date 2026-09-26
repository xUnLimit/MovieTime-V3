import { WhatsAppData } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Obtiene el saludo apropiado según la hora del día
 */
export function getSaludo(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Reemplaza los placeholders en un template con datos reales
 */
export function replacePlaceholders(
  template: string,
  data: WhatsAppData
): string {
  const placeholders: Record<string, string> = {
    '{saludo}': getSaludo(),
    '{cliente}': data.cliente,                                    // Nombre completo
    '{nombre_cliente}': data.nombreCliente || data.cliente,       // Solo nombre
    '{servicio}': data.servicio,
    '{perfil_nombre}': data.perfilNombre,
    '{categoria}': data.categoria,
    '{correo}': data.correo,
    '{contrasena}': data.contrasena,
    '{vencimiento}': data.vencimiento,
    '{monto}': data.monto,
    '{codigo}': data.codigo,
    '{items}': data.items,
    '{cambio_correo}': data.cambioCorreo ?? '',
    '{cambio_contrasena}': data.cambioContrasena ?? '',
    '{credenciales_cambiadas}': data.credencialesCambiadas ?? ''
  };

  // Si hay días de retraso, agregar al mensaje
  if (data.diasRetraso !== undefined) {
    placeholders['{diasRetraso}'] = data.diasRetraso.toString();
  }

  let message = template;

  Object.entries(placeholders).forEach(([key, value]) => {
    message = message.replaceAll(key, value);
  });

  return message;
}

type WhatsAppDevice = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

export function isMobileWhatsAppDevice(device?: WhatsAppDevice): boolean {
  if (!device) return false;

  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(device.userAgent)
    || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
}

/** Genera un enlace universal en móviles/tabletas y WhatsApp Web en computadoras. */
export function generateWhatsAppLink(
  phoneNumber: string,
  message = '',
  device: WhatsAppDevice | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): string {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const mobile = isMobileWhatsAppDevice(device);
  const base = mobile
    ? `https://wa.me/${cleanPhone}`
    : 'https://web.whatsapp.com/send';
  const params = new URLSearchParams();

  if (!mobile && cleanPhone) params.set('phone', cleanPhone);
  if (message) params.set('text', message);

  const query = params.toString().replace(/\+/g, '%20');
  return query ? `${base}?${query}` : base;
}

/**
 * Abre WhatsApp en una nueva ventana
 */
export function openWhatsApp(phoneNumber: string, message = ''): void {
  const link = generateWhatsAppLink(phoneNumber, message);
  window.open(link, '_blank', 'noopener,noreferrer');
}

/**
 * Formatea una fecha para mostrar en mensajes de WhatsApp
 */
export function formatearFechaWhatsApp(fecha: Date): string {
  return format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Genera un mensaje de WhatsApp completo para una venta
 */
export function generarMensajeVenta(
  template: string,
  venta: {
    clienteNombre: string;
    clienteSoloNombre?: string;  // Solo nombre sin apellido
    servicioNombre?: string;
    categoriaNombre: string;
    perfilNombre?: string;
    correo: string;
    contrasena: string;
    fechaVencimiento: Date;
    monto: number;
    codigo?: string;
    items?: string;
    diasRetraso?: number;
  }
): string {
  const data: WhatsAppData = {
    cliente: venta.clienteNombre,
    nombreCliente: venta.clienteSoloNombre,
    servicio: venta.servicioNombre ?? '',
    perfilNombre: venta.perfilNombre ?? '',
    categoria: venta.categoriaNombre,
    correo: venta.correo,
    contrasena: venta.contrasena,
    vencimiento: formatearFechaWhatsApp(venta.fechaVencimiento),
    monto: `$${venta.monto.toFixed(2)}`,
    codigo: venta.codigo ?? '',
    items: venta.items ?? '',
    diasRetraso: venta.diasRetraso
  };

  return replacePlaceholders(template, data);
}
