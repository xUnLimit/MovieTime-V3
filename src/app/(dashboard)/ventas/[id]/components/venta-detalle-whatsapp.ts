import { toast } from 'sonner';

import { generarMensajeVenta, openWhatsApp } from '@/platform/utils/whatsapp';
import type { TemplateMensaje, VentaDoc } from '@/types';

export function showVentaRenovadaWhatsAppToast({
  data,
  monto,
  servicioContrasena,
  templateRenovacion,
  venta,
}: {
  data: {
    codigo?: string;
    fechaVencimiento: Date;
  };
  monto: number;
  servicioContrasena: string;
  templateRenovacion: TemplateMensaje | undefined;
  venta: VentaDoc;
}) {
  if (!templateRenovacion) {
    toast.success('Venta renovada exitosamente');
    return;
  }

  try {
    const clienteSoloNombre = venta.clienteNombre.split(' ')[0];
    const mensaje = generarMensajeVenta(templateRenovacion.contenido, {
      clienteNombre: venta.clienteNombre,
      clienteSoloNombre,
      servicioNombre: venta.servicioNombre,
      categoriaNombre: venta.categoriaNombre || '',
      perfilNombre: venta.perfilNombre || '',
      correo: venta.servicioCorreo || '',
      contrasena: venta.servicioContrasena || servicioContrasena || '',
      codigo: data.codigo || venta.codigo || '',
      fechaVencimiento: data.fechaVencimiento,
      monto,
    });
    toast.success('Venta renovada exitosamente', {
      duration: Infinity,
      action: {
        label: 'Enviar WhatsApp',
        onClick: () => openWhatsApp(venta.clienteTelefono || '', mensaje),
      },
      actionButtonStyle: { backgroundColor: '#15803d', color: '#fff' },
    });
  } catch {
    toast.success('Venta renovada exitosamente');
  }
}
