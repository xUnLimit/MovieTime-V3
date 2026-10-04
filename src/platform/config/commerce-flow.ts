/**
 * Bandera de servidor (apagada por defecto) que permite editar el flujo de compras como bloques del lienzo.
 * Solo cambia de donde salen los textos; las reglas de reserva, pago y entrega no dependen de ella.
 * Se lee en cada llamada para que el cambio de variable aplique sin reiniciar pruebas ni procesos.
 */
export function commerceCanvasEnabled(): boolean {
  return process.env.COMMERCE_FLOW_CANVAS_ENABLED === 'true';
}
