import { PagoDialog } from '@/components/shared/PagoDialog';
import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import type { MetodoPago } from '@/types';
import type { Plan } from '@/types/categorias';

import { CutVentaDialog } from './CutVentaDialog';
import { PaymentPromiseDialog } from './PaymentPromiseDialog';
import type { NotificacionVentaConId } from './types';

interface VentasProximasDialogsProps {
  notifSeleccionada: NotificacionVentaConId | null;
  renovarDialogOpen: boolean;
  accionesDialogOpen: boolean;
  promesaDialogOpen: boolean;
  metodosPagoTerceros: MetodoPago[];
  categoriaPlanes: Plan[];
  servicioTipoSeleccionado: string | undefined;
  onRenovarOpenChange: (open: boolean) => void;
  onAccionesOpenChange: (open: boolean) => void;
  onPromesaOpenChange: (open: boolean) => void;
  onConfirmRenovacion: (data: EnrichedPagoDialogFormData) => void;
  onCortar: (motivoCorte: string) => Promise<void>;
  onGuardarPromesa: (fecha: Date) => Promise<void>;
  onQuitarPromesa: () => Promise<void>;
}

export function VentasProximasDialogs({
  notifSeleccionada,
  renovarDialogOpen,
  accionesDialogOpen,
  promesaDialogOpen,
  metodosPagoTerceros,
  categoriaPlanes,
  servicioTipoSeleccionado,
  onRenovarOpenChange,
  onAccionesOpenChange,
  onPromesaOpenChange,
  onConfirmRenovacion,
  onCortar,
  onGuardarPromesa,
  onQuitarPromesa,
}: VentasProximasDialogsProps) {
  return (
    <>
      {notifSeleccionada && (
        <PagoDialog
          context="venta"
          mode="renew"
          open={renovarDialogOpen}
          onOpenChange={onRenovarOpenChange}
          venta={{
            clienteNombre: notifSeleccionada.clienteNombre,
            metodoPagoId: notifSeleccionada.metodoPagoId,
            precioFinal: notifSeleccionada.precioFinal || 0,
            fechaFin: new Date(notifSeleccionada.fechaFin),
            notas: notifSeleccionada.notas,
          }}
          metodosPago={metodosPagoTerceros}
          categoriaPlanes={categoriaPlanes}
          tipoPlan={servicioTipoSeleccionado}
          onConfirm={onConfirmRenovacion}
          clienteNombre={notifSeleccionada.clienteNombre}
          clienteSoloNombre={notifSeleccionada.clienteNombre.split(' ')[0]}
          servicioNombre={notifSeleccionada.servicioNombre}
          categoriaNombre={notifSeleccionada.categoriaNombre}
          perfilNombre={notifSeleccionada.perfilNombre}
          correo={notifSeleccionada.servicioCorreo}
          contrasena={notifSeleccionada.servicioContrasena}
          codigo={notifSeleccionada.codigo}
        />
      )}

      {notifSeleccionada ? (
        <CutVentaDialog
          key={`cut-${notifSeleccionada.id}`}
          notification={notifSeleccionada}
          open={accionesDialogOpen}
          onOpenChange={onAccionesOpenChange}
          onCut={onCortar}
        />
      ) : null}

      {notifSeleccionada ? (
        <PaymentPromiseDialog
          key={`promise-${notifSeleccionada.id}-${notifSeleccionada.fechaPrometidaPago?.getTime() ?? 'new'}`}
          notification={notifSeleccionada}
          open={promesaDialogOpen}
          onOpenChange={onPromesaOpenChange}
          onSave={onGuardarPromesa}
          onRemove={onQuitarPromesa}
        />
      ) : null}
    </>
  );
}
