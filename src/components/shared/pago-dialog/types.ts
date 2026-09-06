import type { MetodoPago, PagoServicio, Servicio } from '@/types';
import type { Plan } from '@/types/categorias';
import type { PagoDialogFormData } from './schema';

export type EnrichedPagoDialogFormData = PagoDialogFormData & {
  idempotencyKey?: string;
  metodoPagoNombre?: string;
  moneda?: string;
  mensajeWhatsApp?: string;
  planId?: string;
  planNombre?: string;
  planTipoNombre?: string;
};

export type PagoDialogMode = 'edit' | 'renew';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metodosPago: MetodoPago[];
  mode: PagoDialogMode;
  onConfirm: (data: EnrichedPagoDialogFormData) => void | Promise<void>;
  categoriaPlanes?: Plan[];
  tipoPlan?: Plan['tipoPlan'];
  clienteNombre?: string;
  clienteSoloNombre?: string;
  servicioNombre?: string;
  categoriaNombre?: string;
  perfilNombre?: string;
  correo?: string;
  contrasena?: string;
  codigo?: string;
}

interface VentaDialogProps extends BaseProps {
  context: 'venta';
  venta: {
    clienteNombre: string;
    metodoPagoId?: string;
    precioFinal: number;
    fechaFin: Date;
    notas?: string;
    planId?: string;
    planNombre?: string;
    planTipoNombre?: string;
  };
  pago?: {
    id?: string;
    descripcion?: string;
    metodoPagoId?: string | null;
    cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual' | null;
    precio: number;
    descuento?: number | null;
    fechaInicio?: Date | null;
    fechaVencimiento?: Date | null;
    notas?: string | null;
  } | null;
}

interface ServicioDialogProps extends BaseProps {
  context: 'servicio';
  servicio: Servicio;
  pago?: PagoServicio | null;
}

export type PagoDialogProps = VentaDialogProps | ServicioDialogProps;
