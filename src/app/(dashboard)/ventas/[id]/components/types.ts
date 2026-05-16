import type { MetodoPago, VentaDoc, VentaPago } from '@/types';
import type { Plan } from '@/types/categorias';

export interface VentaPagoFormData {
  periodoRenovacion: string;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  costo: number;
  descuento?: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string;
  notificarWhatsApp?: boolean;
}

export interface VentaReembolsoFormData {
  monto: number;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  destinoReembolso: string;
  moneda?: string;
  fecha: Date;
  nota?: string;
  cortarServicio: boolean;
  motivoCorte?: string;
}

export type VentaPagoConfirm = (data: VentaPagoFormData) => void | Promise<void>;
export type VentaReembolsoConfirm = (data: VentaReembolsoFormData) => void | Promise<void>;
export type VentaPagoAction = (pago: VentaPago) => void | Promise<void>;

export interface VentaEstadoDetalle {
  esCortada: boolean;
  estadoBadgeClass: string;
  estadoLabel: string;
}

export interface VentaDetalleViewModel extends VentaEstadoDetalle {
  categoriaPlanes: Plan[];
  deleteDialogOpen: boolean;
  deletePagoDialogOpen: boolean;
  diasRestantes: number;
  editarPagoDialogOpen: boolean;
  loading: boolean;
  loadingPagos: boolean;
  metodosPago: MetodoPago[];
  pagoToEdit: VentaPago | null;
  paymentRows: VentaPago[];
  perfilDisplay: string;
  renovaciones: number;
  renovarDialogOpen: boolean;
  reembolsoDialogOpen: boolean;
  reembolsoMontoSugerido: number;
  servicioContrasena: string;
  venta: VentaDoc | null;
  handleConfirmDeletePago: () => Promise<void>;
  handleConfirmEditarPago: VentaPagoConfirm;
  handleConfirmRenovacion: VentaPagoConfirm;
  handleConfirmReembolso: VentaReembolsoConfirm;
  handleDelete: (deletePagos: boolean) => Promise<void>;
  handleDeletePago: VentaPagoAction;
  handleEditarPago: VentaPagoAction;
  handleOpenRenovar: () => Promise<void>;
  handleOpenReembolso: () => Promise<void>;
  setDeleteDialogOpen: (open: boolean) => void;
  setDeletePagoDialogOpen: (open: boolean) => void;
  setEditarPagoDialogOpen: (open: boolean) => void;
  setRenovarDialogOpen: (open: boolean) => void;
  setReembolsoDialogOpen: (open: boolean) => void;
}
