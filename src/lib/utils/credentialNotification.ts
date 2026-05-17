import { formatearFechaWhatsApp, replacePlaceholders } from '@/lib/utils/whatsapp';
import type { Servicio, VentaDoc, WhatsAppData } from '@/types';

export interface CredentialChangeFlags {
  correo: boolean;
  contrasena: boolean;
}

export const DEFAULT_CREDENTIAL_UPDATE_TEMPLATE = [
  '{saludo} {nombre_cliente}, te compartimos la actualizacion de acceso para *{servicio}*.',
  '',
  '{credenciales_cambiadas}',
  '',
  'Correo: {correo}',
  'Contrasena: {contrasena}',
  'Perfil: {perfil_nombre}',
  'Codigo: {codigo}',
  '',
  'Por favor usa estos datos desde ahora.',
].join('\n');

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function getCredentialChangeSummary(changes: CredentialChangeFlags) {
  if (changes.correo && changes.contrasena) {
    return 'Se actualizaron el correo y la contrasena.';
  }
  if (changes.correo) return 'Se actualizo el correo.';
  if (changes.contrasena) return 'Se actualizo la contrasena.';
  return 'Se actualizaron las credenciales.';
}

export function buildCredentialUpdateMessage(
  template: string | undefined,
  venta: VentaDoc,
  servicio: Pick<Servicio, 'nombre' | 'categoriaNombre' | 'correo' | 'contrasena'>,
  changes: CredentialChangeFlags,
) {
  const fechaVencimiento = venta.fechaFin
    ? formatearFechaWhatsApp(new Date(venta.fechaFin))
    : '';
  const data: WhatsAppData = {
    cliente: venta.clienteNombre,
    nombreCliente: firstName(venta.clienteNombre),
    servicio: servicio.nombre || venta.servicioNombre || '',
    categoria: servicio.categoriaNombre || venta.categoriaNombre || '',
    perfilNombre: venta.perfilNombre || '',
    correo: servicio.correo || '',
    contrasena: servicio.contrasena || '',
    vencimiento: fechaVencimiento,
    monto: venta.precioFinal ? `$${venta.precioFinal.toFixed(2)}` : '',
    codigo: venta.codigo || '',
    items: venta.servicioNombre || servicio.nombre || '',
    cambioCorreo: changes.correo ? `Correo actualizado: ${servicio.correo}` : '',
    cambioContrasena: changes.contrasena ? `Contrasena actualizada: ${servicio.contrasena}` : '',
    credencialesCambiadas: getCredentialChangeSummary(changes),
  };

  return replacePlaceholders(template || DEFAULT_CREDENTIAL_UPDATE_TEMPLATE, data);
}

export function hasCredentialChanges(
  previous: Pick<Servicio, 'correo' | 'contrasena'>,
  next: Pick<Servicio, 'correo' | 'contrasena'>,
): CredentialChangeFlags {
  return {
    correo: previous.correo !== next.correo,
    contrasena: previous.contrasena !== next.contrasena,
  };
}

export function changedCredentialsCount(changes: CredentialChangeFlags) {
  return Number(changes.correo) + Number(changes.contrasena);
}
