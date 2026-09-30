import { announceRenewal } from '@/components/shared/renewal-whatsapp-notice';
import { generarMensajeVenta } from '@/platform/utils/whatsapp';
import type { PendingWhatsAppToast } from '@/store/whatsappToastStore';
import type { TemplateMensaje, VentaDoc } from '@/types';

/**
 * Aviso final de una renovacion hecha desde el detalle de la venta. Con el WhatsApp automatico encendido la
 * confirmacion sale sola por la API; apagado, se ofrecen la API y WhatsApp si se pidio notificar al cliente.
 */
export function showVentaRenovadaWhatsAppToast({
  data,
  enqueueWhatsAppMessages,
  monto,
  notificarCliente,
  servicioContrasena,
  templateRenovacion,
  venta,
}: {
  data: {
    codigo?: string;
    fechaVencimiento: Date;
  };
  enqueueWhatsAppMessages: (messages: Array<Omit<PendingWhatsAppToast, 'id'>>) => void;
  monto: number;
  /** El dialogo de pago tenia encendido "Notificar al cliente por WhatsApp". */
  notificarCliente: boolean;
  servicioContrasena: string;
  templateRenovacion: TemplateMensaje | undefined;
  venta: VentaDoc;
}) {
  void announceRenewal({
    ventaId: venta.id,
    clienteNombre: venta.clienteNombre,
    waMessage: notificarCliente && templateRenovacion ? buildWaMessage({ data, monto, servicioContrasena, templateRenovacion, venta }) : null,
    enqueueWhatsAppMessages,
  });
}

function buildWaMessage({ data, monto, servicioContrasena, templateRenovacion, venta }: {
  data: { codigo?: string; fechaVencimiento: Date };
  monto: number;
  servicioContrasena: string;
  templateRenovacion: TemplateMensaje;
  venta: VentaDoc;
}): { phone: string; message: string } | null {
  try {
    const mensaje = generarMensajeVenta(templateRenovacion.contenido, {
      clienteNombre: venta.clienteNombre,
      clienteSoloNombre: venta.clienteNombre.split(' ')[0],
      servicioNombre: venta.servicioNombre,
      categoriaNombre: venta.categoriaNombre || '',
      perfilNombre: venta.perfilNombre || '',
      correo: venta.servicioCorreo || '',
      contrasena: venta.servicioContrasena || servicioContrasena || '',
      codigo: data.codigo || venta.codigo || '',
      fechaVencimiento: data.fechaVencimiento,
      monto,
    });
    return { phone: venta.clienteTelefono || '', message: mensaje };
  } catch {
    return null;
  }
}
