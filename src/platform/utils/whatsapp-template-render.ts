import { formatearFechaWhatsApp, getSaludo } from './whatsapp';

// Datos de una venta necesarios para llenar las plantillas del editor de mensajes.
export type VentaMessageContext = {
  clienteNombre: string;
  categoriaNombre: string;
  servicioNombre: string;
  perfilNombre: string;
  correo: string;
  contrasena: string;
  codigo: string;
  fechaVencimiento: Date | null;
  monto: number;
};

const ITEMS_BLOCK = /{{#items}}([\s\S]*?){{\/items}}/;
const EMPTY = '—';

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function formatMonto(monto: number) {
  return `$${monto.toFixed(2)}`;
}

export function formatVencimiento(fecha: Date | null) {
  return fecha ? formatearFechaWhatsApp(fecha) : EMPTY;
}

function placeholdersFor(context: VentaMessageContext, saludo: string): Record<string, string> {
  return {
    '{saludo}': saludo,
    '{cliente}': context.clienteNombre,
    '{nombre_cliente}': firstName(context.clienteNombre) || context.clienteNombre,
    '{items}': `*${context.categoriaNombre}*`,
    '{servicio}': context.servicioNombre || context.categoriaNombre,
    '{categoria}': context.categoriaNombre,
    '{perfil_nombre}': context.perfilNombre || EMPTY,
    '{correo}': context.correo || EMPTY,
    '{contrasena}': context.contrasena || EMPTY,
    '{codigo}': context.codigo || EMPTY,
    '{vencimiento}': formatVencimiento(context.fechaVencimiento),
    '{monto}': formatMonto(context.monto),
  };
}

function replaceAll(text: string, values: Record<string, string>) {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(key, value), text);
}

/**
 * Llena una plantilla del editor con los datos de una sola venta. El bloque
 * {{#items}}...{{/items}} se renderiza una vez con esa venta, igual que en el
 * mensaje de suscripcion al crear la venta.
 */
export function renderEditorTemplate(template: string, context: VentaMessageContext, saludo = getSaludo()): string {
  const values = placeholdersFor(context, saludo);
  const withItems = template.replace(ITEMS_BLOCK, (_match, block: string) =>
    replaceAll(block.replace(/^\s*\n/, '').replace(/\n\s*$/, ''), values)
  );
  return replaceAll(withItems, values).trim();
}

export function greetingFor(nombre: string, saludo = getSaludo()) {
  const name = firstName(nombre);
  return name ? `${saludo}, ${name}` : saludo;
}
