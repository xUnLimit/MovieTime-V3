/**
 * Bandera de servidor (apagada por defecto) que permite publicar las extensiones del recorrido: nodos de condicion
 * y datos del pedido en los textos. La version anterior de la aplicacion ignora esos campos, asi que no se publican
 * hasta activarla de forma explicita. El runtime las resuelve siempre que existan en la version publicada.
 */
export function flowExtensionsEnabled(): boolean {
  return process.env.FLOW_EXTENSIONS_ENABLED === 'true';
}
