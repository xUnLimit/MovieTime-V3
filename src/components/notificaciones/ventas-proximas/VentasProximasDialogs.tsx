import { PagoDialog } from '@/components/shared/PagoDialog';
import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import type { MetodoPago } from '@/types';
import type { Plan } from '@/types/categorias';

import { AccionesVentaDialog } from '../AccionesVentaDialog';
import type { NotificacionVentaConId } from './types';

interface VentasProximasDialogsProps {
  notifSeleccionada: NotificacionVentaConId | null;
  renovarDialogOpen: boolean;
  accionesDialogOpen: boolean;
  metodosPagoTerceros: MetodoPago[];
  categoriaPlanes: Plan[];
  servicioTipoSeleccionado: string | undefined;
  onRenovarOpenChange: (open: boolean) => void;
  onAccionesOpenChange: (open: boolean) => void;
  onConfirmRenovacion: (data: EnrichedPagoDialogFormData) => void;
  onCortar: (motivoCorte: string) => Promise<void>;
  onResaltar: () => Promise<void>;
  onDescartar: () => Promise<void>;
}

export function VentasProximasDialogs({
  notifSeleccionada,
  renovarDialogOpen,
  accionesDialogOpen,
  metodosPagoTerceros,
  categoriaPlanes,
  servicioTipoSeleccionado,
  onRenovarOpenChange,
  onAccionesOpenChange,
  onConfirmRenovacion,
  onCortar,
  onResaltar,
  onDescartar,
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

      <AccionesVentaDialog
        notificacion={notifSeleccionada}
        isOpen={accionesDialogOpen}
        onOpenChange={onAccionesOpenChange}
        onCortar={onCortar}
        onResaltar={onResaltar}
        onDescartar={onDescartar}
      />
    </>
  );
}
