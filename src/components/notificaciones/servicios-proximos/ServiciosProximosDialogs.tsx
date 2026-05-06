import { PagoDialog } from '@/components/shared/PagoDialog';
import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import type { MetodoPago, Servicio } from '@/types';

import { AccionesServicioDialog } from '../AccionesServicioDialog';
import type { NotificacionServicioConId } from './types';

interface ServiciosProximosDialogsProps {
  notifParaAcciones: NotificacionServicioConId | null;
  servicioParaRenovar: Servicio | null;
  renovarDialogOpen: boolean;
  accionesDialogOpen: boolean;
  metodosPagoServicio: MetodoPago[];
  onRenovarOpenChange: (open: boolean) => void;
  onAccionesOpenChange: (open: boolean) => void;
  onConfirmRenovacion: (data: EnrichedPagoDialogFormData) => void;
  onInactivar: () => Promise<void>;
  onResaltar: () => Promise<void>;
  onDescartar: () => Promise<void>;
}

export function ServiciosProximosDialogs({
  notifParaAcciones,
  servicioParaRenovar,
  renovarDialogOpen,
  accionesDialogOpen,
  metodosPagoServicio,
  onRenovarOpenChange,
  onAccionesOpenChange,
  onConfirmRenovacion,
  onInactivar,
  onResaltar,
  onDescartar,
}: ServiciosProximosDialogsProps) {
  return (
    <>
      {servicioParaRenovar && (
        <PagoDialog
          context="servicio"
          mode="renew"
          open={renovarDialogOpen}
          onOpenChange={onRenovarOpenChange}
          servicio={servicioParaRenovar}
          metodosPago={metodosPagoServicio}
          onConfirm={onConfirmRenovacion}
        />
      )}

      <AccionesServicioDialog
        notificacion={notifParaAcciones}
        isOpen={accionesDialogOpen}
        onOpenChange={onAccionesOpenChange}
        onInactivar={onInactivar}
        onResaltar={onResaltar}
        onDescartar={onDescartar}
      />
    </>
  );
}
