import { useMemo } from 'react';
import type { PagoDialogProps } from './types';
import { getPagoDialogResetValues, getPagoDialogTargetKey } from './helpers';

export function usePagoDialogResetModel(props: PagoDialogProps) {
  const pago = props.pago ?? null;
  const servicio = props.context === 'servicio' ? props.servicio : null;
  const venta = props.context === 'venta' ? props.venta : null;
  // getPagoDialogTargetKey solo lee context, mode, venta.clienteNombre, servicio.id/nombre y pago?.id.
  // Los deps enumeran exactamente esos campos primitivos; depender de `props` entero recalcularia
  // en cada render (props es un objeto nuevo). Los deps son completos y correctos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dialogTargetKey = useMemo(() => getPagoDialogTargetKey(props), [
    props.context,
    props.mode,
    pago?.id,
    servicio?.id,
    servicio?.nombre,
    venta?.clienteNombre,
  ]);
  // getPagoDialogResetValues lee context, mode, pago, y campos puntuales de venta/servicio.
  // Los deps enumeran exactamente esos campos; depender de `props` entero recalcularia en cada
  // render (props es un objeto nuevo). Los deps son completos y correctos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetValues = useMemo(() => getPagoDialogResetValues(props), [
    props.context,
    props.mode,
    props.categoriaPlanes,
    props.tipoPlan,
    pago,
    servicio?.cicloPago,
    servicio?.costoServicio,
    servicio?.fechaVencimiento,
    servicio?.metodoPagoId,
    servicio?.notas,
    servicio?.renovacionAutomatica,
    venta?.fechaFin,
    venta?.metodoPagoId,
    venta?.notas,
    venta?.precioFinal,
  ]);
  return { dialogTargetKey, resetValues };
}
