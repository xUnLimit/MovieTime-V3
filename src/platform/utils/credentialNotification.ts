import { formatearFechaWhatsApp, replacePlaceholders } from '@/platform/utils/whatsapp';
import type { Servicio, VentaDoc, WhatsAppData } from '@/types';

export interface CredentialChangeFlags {
  correo: boolean;
  contrasena: boolean;
}

const DEFAULT_CREDENTIAL_UPDATE_TEMPLATE = [
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

const DEFAULT_SERVICE_TRANSFER_TEMPLATE = [
  '{saludo} {nombre_cliente}, tu acceso fue transferido a *{servicio}*.',
  '',
  'Estas son tus credenciales actualizadas:',
  '',
  'Correo: {correo}',
  'Contrasena: {contrasena}',
  'Perfil: {perfil_nombre}',
  'Codigo: {codigo}',
  '',
  'Por favor usa este servicio desde ahora.',
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
  return buildCredentialMessage(template || DEFAULT_CREDENTIAL_UPDATE_TEMPLATE, venta, servicio, {
    cambioCorreo: changes.correo ? `Correo actualizado: ${servicio.correo}` : '',
    cambioContrasena: changes.contrasena ? `Contrasena actualizada: ${servicio.contrasena}` : '',
    credencialesCambiadas: getCredentialChangeSummary(changes),
  });
}

export function buildServiceTransferMessage(
  template: string | undefined,
  venta: VentaDoc,
  servicio: Pick<Servicio, 'nombre' | 'categoriaNombre' | 'correo' | 'contrasena'>,
) {
  return buildCredentialMessage(template || DEFAULT_SERVICE_TRANSFER_TEMPLATE, venta, servicio, {
    cambioCorreo: '',
    cambioContrasena: '',
    credencialesCambiadas: 'La venta fue transferida a otro servicio.',
  });
}

function buildCredentialMessage(
  template: string,
  venta: VentaDoc,
  servicio: Pick<Servicio, 'nombre' | 'categoriaNombre' | 'correo' | 'contrasena'>,
  extraData: Pick<WhatsAppData, 'cambioCorreo' | 'cambioContrasena' | 'credencialesCambiadas'>,
) {
  const fechaVencimiento = venta.fechaFin
    ? formatearFechaWhatsApp(new Date(venta.fechaFin))
    : '';
  const perfilNombre = venta.perfilNombre?.trim()
    || (venta.perfilNumero ? `Perfil ${venta.perfilNumero}` : '');
  const data: WhatsAppData = {
    cliente: venta.clienteNombre,
    nombreCliente: firstName(venta.clienteNombre),
    servicio: servicio.nombre || venta.servicioNombre || '',
    categoria: servicio.categoriaNombre || venta.categoriaNombre || '',
    perfilNombre,
    correo: servicio.correo || '',
    contrasena: servicio.contrasena || '',
    vencimiento: fechaVencimiento,
    monto: venta.precioFinal ? `$${venta.precioFinal.toFixed(2)}` : '',
    codigo: venta.codigo || '',
    items: venta.servicioNombre || servicio.nombre || '',
    ...extraData,
  };

  return replacePlaceholders(template, data);
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
