import { toast } from 'sonner';

import { generarMensajeVenta, openWhatsApp } from '@/platform/utils/whatsapp';
import type { TemplateMensaje } from '@/types';

import type { NotificacionVentaConId } from './types';

function openVentaWhatsappMessage(
  notif: NotificacionVentaConId,
  template: TemplateMensaje,
  options: { includeDiasRetraso?: boolean } = {},
) {
  const clienteSoloNombre = notif.clienteNombre.split(' ')[0];
  const mensaje = generarMensajeVenta(template.contenido, {
    clienteNombre: notif.clienteNombre,
    clienteSoloNombre,
    servicioNombre: notif.servicioNombre,
    categoriaNombre: notif.categoriaNombre,
    perfilNombre: notif.perfilNombre,
    correo: notif.servicioCorreo || '',
    contrasena: notif.servicioContrasena || '',
    codigo: notif.codigo,
    fechaVencimiento: new Date(notif.fechaFin),
    monto: notif.precioFinal || 0,
    diasRetraso:
      options.includeDiasRetraso && notif.diasRestantes < 0
        ? Math.abs(notif.diasRestantes)
        : undefined,
  });

  if (notif.clienteTelefono) {
    openWhatsApp(notif.clienteTelefono, mensaje);
    toast.success('Abriendo WhatsApp con el cliente...');
    return;
  }

  const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  toast.warning(
    'Teléfono del cliente no disponible. Selecciona el contacto manualmente.',
  );
}

export function notifyVentaExpiration(
  notif: NotificacionVentaConId,
  template: TemplateMensaje,
) {
  openVentaWhatsappMessage(notif, template, { includeDiasRetraso: true });
}

export function notifyVentaCancellation(
  notif: NotificacionVentaConId,
  template: TemplateMensaje,
) {
  openVentaWhatsappMessage(notif, template);
}
