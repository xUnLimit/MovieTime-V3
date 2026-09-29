import type { EditableTipoKey } from '@/modules/messaging/template-tipos';

export { TEMPLATE_GROUPS, TEMPLATE_TIPOS, tipoCuando, tipoLabel } from '@/modules/messaging/template-tipos';

export const ITEMS_BLOCK_KEY = '{{#items}}\n...\n{{/items}}';

export const PLACEHOLDERS: { key: string; label: string; description: string }[] = [
  { key: '{saludo}', label: 'Saludo', description: 'Buenos días, tardes o noches' },
  { key: '{cliente}', label: 'Nombre completo', description: 'El nombre completo del cliente' },
  { key: '{nombre_cliente}', label: 'Primer nombre', description: 'El primer nombre del cliente' },
  { key: ITEMS_BLOCK_KEY, label: 'Bloque por servicio', description: 'Repite el contenido del medio por cada servicio' },
  { key: '{items}', label: 'Lista de servicios', description: 'Formato: A, B y C' },
  { key: '{servicio}', label: 'Servicio', description: 'El nombre del servicio' },
  { key: '{categoria}', label: 'Categoría', description: 'La categoría del servicio' },
  { key: '{perfil_nombre}', label: 'Perfil', description: 'El nombre del perfil' },
  { key: '{correo}', label: 'Correo de la cuenta', description: 'El correo del servicio' },
  { key: '{contrasena}', label: 'Contraseña', description: 'La contraseña del servicio' },
  { key: '{codigo}', label: 'Código de venta', description: 'El código de la venta' },
  { key: '{credenciales_cambiadas}', label: 'Resumen de cambios', description: 'Los datos que cambiaron' },
  { key: '{cambio_correo}', label: 'Línea de cambio de correo', description: 'Solo si cambió el correo' },
  { key: '{cambio_contrasena}', label: 'Línea de cambio de contraseña', description: 'Solo si cambió la contraseña' },
  { key: '{vencimiento}', label: 'Vencimiento', description: 'La fecha de vencimiento' },
  { key: '{monto}', label: 'Monto', description: 'El monto a pagar' },
];

const COBROS = ['{saludo}', '{nombre_cliente}', '{cliente}', '{servicio}', '{categoria}', '{items}', '{vencimiento}', '{monto}'];
const ACCESO = ['{perfil_nombre}', '{correo}', '{contrasena}', '{codigo}'];
const CAMBIOS = ['{credenciales_cambiadas}', '{cambio_correo}', '{cambio_contrasena}'];

// Solo los datos que tienen sentido en cada mensaje; el resto solo agrega ruido al elegir.
export const TIPO_PLACEHOLDERS: Record<EditableTipoKey, readonly string[]> = {
  dia_pago: COBROS,
  cancelacion: COBROS,
  renovacion: COBROS,
  datos_pago: ['{saludo}', '{nombre_cliente}', '{cliente}', '{items}', '{vencimiento}', '{monto}'],
  despedida: ['{saludo}', '{nombre_cliente}', '{cliente}', '{items}'],
  suscripcion: [...COBROS, ITEMS_BLOCK_KEY, ...ACCESO],
  actualizacion_credenciales: [...COBROS, ...ACCESO, ...CAMBIOS],
  transferencia_servicio: [...COBROS, ...ACCESO, ...CAMBIOS],
};

export function placeholdersFor(tipo: EditableTipoKey) {
  const allowed = new Set(TIPO_PLACEHOLDERS[tipo]);
  return PLACEHOLDERS.filter((item) => allowed.has(item.key));
}

const PLACEHOLDER_GROUPS: readonly { id: string; label: string; keys: readonly string[] }[] = [
  { id: 'cliente', label: 'Cliente', keys: ['{saludo}', '{nombre_cliente}', '{cliente}'] },
  { id: 'servicio', label: 'Servicio', keys: [ITEMS_BLOCK_KEY, '{items}', '{servicio}', '{categoria}', '{perfil_nombre}'] },
  { id: 'cobro', label: 'Cobro', keys: ['{vencimiento}', '{monto}'] },
  { id: 'acceso', label: 'Acceso', keys: ['{correo}', '{contrasena}', '{codigo}'] },
  { id: 'cambios', label: 'Cambios', keys: ['{credenciales_cambiadas}', '{cambio_correo}', '{cambio_contrasena}'] },
];

/** Los datos disponibles para un mensaje, agrupados por tema y sin grupos vacios. */
export function placeholderGroupsFor(tipo: EditableTipoKey) {
  const available = new Map(placeholdersFor(tipo).map((item) => [item.key, item]));
  return PLACEHOLDER_GROUPS
    .map((group) => ({ id: group.id, label: group.label, items: group.keys.flatMap((key) => available.get(key) ?? []) }))
    .filter((group) => group.items.length > 0);
}

/** Inserta texto en la seleccion (o al final) y devuelve el nuevo valor con la posicion del cursor. */
export function insertAtCursor(value: string, start: number, end: number, text: string) {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  return { value: value.slice(0, from) + text + value.slice(to), cursor: from + text.length };
}

/** Envuelve la seleccion con una marca de formato de WhatsApp (`*`, `_`, `~`); sin seleccion deja el cursor entre las marcas. */
export function wrapSelection(value: string, start: number, end: number, mark: string) {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  return {
    value: value.slice(0, from) + mark + value.slice(from, to) + mark + value.slice(to),
    selectionStart: from + mark.length,
    selectionEnd: to + mark.length,
  };
}
