import type { MetodoPago, VentaDoc } from '@/types';

export interface VentaDetalleQueryData {
  servicioContrasena: string;
  venta: VentaDoc | null;
}

export type VentaDetalleWorkflowDeps = {
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  deleteVenta: (ventaId: string, servicioId?: string, perfilNumero?: number | null, deletePagos?: boolean) => Promise<void>;
  inactivateServicio: (servicioId: string, motivoCorte: string) => Promise<void>;
  invalidateNotifications: () => Promise<unknown>;
  refreshPagos: () => Promise<unknown> | unknown;
  updatePerfilOcupado: (servicioId: string, shouldIncrement: boolean) => Promise<void>;
};

export type VentaPagoWorkflowInput = {
  idempotencyKey?: string;
  costo: number;
  descuento?: number;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  periodoRenovacion: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  nota?: string;
  notificarWhatsApp?: boolean;
  planId?: string;
  planNombre?: string;
  planTipoNombre?: string;
};

export type VentaRefundWorkflowInput = {
  idempotencyKey?: string;
  monto: number;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  destinoReembolso: string;
  moneda?: string;
  fecha: Date;
  nota?: string;
  cortarServicio: boolean;
  inactivarServicio?: boolean;
  motivoCorte?: string;
};

export type VentaDetalleWorkflowOutcome =
  | { type: 'ventaDeleted'; deletedPayments: boolean }
  | {
      type: 'ventaRenewed';
      monto: number;
      syncPaymentMethodFailed: boolean;
      ventaActualizada: VentaDoc | null;
      whatsappRequested: boolean;
    }
  | {
      type: 'ventaRefunded';
      cut: boolean;
      serviceInactivated: boolean;
      ventaActualizada: VentaDoc | null;
    }
  | {
      type: 'ventaPaymentUpdated';
      syncPaymentMethodFailed: boolean;
      ventaActualizada: VentaDoc | null;
    }
  | {
      type: 'ventaPaymentDeleted';
      ventaActualizada: VentaDoc | null;
    };

export type VentaPaymentSelection = {
  input: VentaPagoWorkflowInput;
  metodosPago: MetodoPago[];
  venta: VentaDoc;
};
