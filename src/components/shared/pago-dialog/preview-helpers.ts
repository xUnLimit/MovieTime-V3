import type { TemplateMensaje } from '@/types';
import { calculateDiscountedAmount } from '@/platform/utils/calculations';
import { generarMensajeVenta } from '@/platform/utils/whatsapp';

interface VentaPreviewMessageArgs {
  isVenta: boolean;
  isEdit: boolean;
  notificarWhatsAppValue?: boolean;
  template?: TemplateMensaje;
  costoValue: number;
  descuentoValue?: number;
  fechaVencimientoValue?: Date;
  clienteNombre?: string;
  clienteSoloNombre?: string;
  servicioNombre?: string;
  categoriaNombre?: string;
  perfilNombre?: string;
  correo?: string;
  contrasena?: string;
  codigo?: string;
}

export function buildVentaPreviewMessage({
  isVenta,
  isEdit,
  notificarWhatsAppValue,
  template,
  costoValue,
  descuentoValue,
  fechaVencimientoValue,
  clienteNombre,
  clienteSoloNombre,
  servicioNombre,
  categoriaNombre,
  perfilNombre,
  correo,
  contrasena,
  codigo,
}: VentaPreviewMessageArgs) {
  if (!isVenta || !notificarWhatsAppValue || isEdit) return '';
  if (!template) return 'Template de renovación no encontrado';

  const precioFinal = calculateDiscountedAmount(Number(costoValue) || 0, Number(descuentoValue) || 0);

  return generarMensajeVenta(template.contenido, {
    clienteNombre: clienteNombre || 'Cliente',
    clienteSoloNombre,
    servicioNombre: servicioNombre || 'Servicio',
    categoriaNombre: categoriaNombre || 'Categoría',
    perfilNombre: perfilNombre || '',
    correo: correo || '',
    contrasena: contrasena || '',
    codigo: codigo || '',
    fechaVencimiento: fechaVencimientoValue || new Date(),
    monto: precioFinal,
  });
}
