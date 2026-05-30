import { toast } from 'sonner';

import { generarMensajeVenta } from '@/platform/utils/whatsapp';
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
    const phone = venta.clienteTelefono
      ? venta.clienteTelefono.replace(/[^\d+]/g, '')
      : '';

    toast.success('Venta renovada exitosamente', {
      duration: Infinity,
      action: {
        label: 'Enviar WhatsApp',
        onClick: () => {
          const base = phone
            ? `https://web.whatsapp.com/send?phone=${phone}&text=`
            : 'https://web.whatsapp.com/send?text=';
          window.open(base + encodeURIComponent(mensaje), '_blank', 'noopener,noreferrer');
        },
      },
      actionButtonStyle: { backgroundColor: '#15803d', color: '#fff' },
    });
  } catch {
    toast.success('Venta renovada exitosamente');
  }
}
