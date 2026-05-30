import type { MetodoPago, PagoServicio, Servicio, Tercero, VentaDoc } from '@/types';

export interface PerfilVentaDetalle {
  ventaId?: string;
  clienteId?: string;
  perfilNumero?: number | null;
  clienteNombre?: string;
  clienteTelefono?: string;
  createdAt?: Date;
  precioFinal?: number;
  descuento?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  notas?: string;
  servicioNombre?: string;
  servicioCorreo?: string;
  moneda?: string;
  perfilNombre?: string;
  codigo?: string;
  cicloPago?: string;
}

export type CategoriaDetalle = Pick<Servicio, 'categoriaId' | 'categoriaNombre'>;
export type MetodoPagoDetalle = Pick<MetodoPago, 'id' | 'nombre' | 'moneda'> & Partial<MetodoPago>;

export type ServicioDetalleWorkflowDeps = {
  deleteNotificacionesPorServicio: (servicioId: string) => Promise<void>;
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  deleteServicio: (servicioId: string, deletePayments?: boolean) => Promise<void>;
  invalidateCategorias: () => Promise<unknown>;
  invalidateNotifications: () => Promise<unknown>;
  refreshCounts: () => Promise<unknown>;
  refreshPagos: () => Promise<unknown> | unknown;
  updatePerfilOcupado: (servicioId: string, shouldIncrement: boolean) => Promise<void>;
};

export type ServicioPagoWorkflowInput = {
  costo: number;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  periodoRenovacion: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  nota?: string;
  renovacionAutomatica?: boolean;
};

export type ServicioDetalleWorkflowOutcome =
  | { type: 'servicioDeleted'; deletedPayments: boolean }
  | { type: 'servicioPaymentUpdated'; servicioActualizado: Servicio | null }
  | { type: 'servicioPaymentDeleted'; servicioActualizado: Servicio | null; latestPayment: boolean }
  | { type: 'servicioRenewed'; servicioActualizado: Servicio }
  | { type: 'servicioVentaCut'; ventaId: string; serviceProfileUpdated: boolean }
  | {
      type: 'servicioVentaTransferred';
      ventaId: string;
      targetServicioId: string;
      whatsappRequested: boolean;
      tercero?: Tercero | null;
    };

export type ServicioPaymentWorkflowContext = {
  data: ServicioPagoWorkflowInput;
  metodosPago: MetodoPago[];
  servicio: Servicio;
};

export type ServicioPaymentDeletionContext = {
  fallbackMoneda?: string;
  id: string;
  pago: PagoServicio;
  pagosOrdenados: PagoServicio[];
  pagosServicio: PagoServicio[];
  servicio: Servicio;
};

export type ServicioVentaWorkflowContext = {
  deps: Pick<ServicioDetalleWorkflowDeps, 'invalidateNotifications' | 'updatePerfilOcupado'>;
  venta: VentaDoc;
};
