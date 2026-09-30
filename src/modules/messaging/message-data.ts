import { getSaludo, replacePlaceholders } from '@/platform/utils/whatsapp';
import { formatMonto, formatVencimiento, greetingFor } from '@/platform/utils/whatsapp-template-render';

export type NoticeVenta = {
  ventaId: string;
  clienteId: string;
  clienteNombre: string;
  telefono: string;
  categoriaNombre: string;
  servicioNombre: string;
  perfilNombre: string;
  correo: string;
  contrasena: string;
  codigo: string;
  fechaVencimiento: Date | null;
  monto: number;
  moneda: string;
  activa: boolean;
  reembolsada: boolean;
  enReposo: boolean;
  promesaPagoHasta: Date | null;
  respuestaCliente: 'no_continuar' | null;
};

export type NoticeGroup = {
  clienteId: string;
  clienteNombre: string;
  telefono: string;
  fechaVencimiento: Date | null;
  moneda: string;
  ventas: NoticeVenta[];
};

export type MessageItemData = Record<string, string>;

export type MessageData = {
  saludo: string;
  saludo_nombre: string;
  cliente: string;
  nombre_cliente: string;
  servicios: string;
  vencimiento: string;
  monto_total: string;
  perfil: string;
  correo: string;
  contrasena: string;
  codigo: string;
  items: string;
  /** Datos por venta para el bloque {{#items}} del texto libre. */
  itemRows: MessageItemData[];
};

const META_PARAM_MAX = 256;
const EMPTY = '—';
const ITEMS_BLOCK = /{{#items}}([\s\S]*?){{\/items}}/;

function dayKey(fecha: Date): string {
  const y = String(fecha.getFullYear()).padStart(4, '0');
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Misma regla que v_whatsapp_conversations: 8 digitos locales o 507 + 8 digitos. */
export function normalizePanamaWaId(telefono: string): string | null {
  const digits = telefono.replace(/\D/g, '');
  if (/^\d{8}$/.test(digits)) return `507${digits}`;
  if (/^507\d{8}$/.test(digits)) return digits;
  return null;
}

export function isNoticeEligible(venta: NoticeVenta, today: Date): boolean {
  if (!venta.activa || venta.reembolsada || venta.enReposo) return false;
  if (venta.respuestaCliente === 'no_continuar') return false;
  if (venta.promesaPagoHasta && dayKey(venta.promesaPagoHasta) >= dayKey(today)) return false;
  return true;
}

export function groupNoticeVentas(ventas: readonly NoticeVenta[]): NoticeGroup[] {
  const groups = new Map<string, NoticeGroup & { sortKey: string }>();
  for (const venta of ventas) {
    const fecha = venta.fechaVencimiento ? dayKey(venta.fechaVencimiento) : 'sin-fecha';
    const key = `${fecha}\u0000${venta.clienteId}\u0000${venta.moneda}`;
    const existing = groups.get(key);
    if (existing) {
      existing.ventas.push(venta);
    } else {
      groups.set(key, {
        clienteId: venta.clienteId,
        clienteNombre: venta.clienteNombre,
        telefono: venta.telefono,
        fechaVencimiento: venta.fechaVencimiento,
        moneda: venta.moneda,
        ventas: [venta],
        sortKey: key,
      });
    }
  }
  return [...groups.values()]
    .sort((a, b) => compare(a.sortKey, b.sortKey))
    .map((group) => ({
      clienteId: group.clienteId,
      clienteNombre: group.clienteNombre,
      telefono: group.telefono,
      fechaVencimiento: group.fechaVencimiento,
      moneda: group.moneda,
      ventas: [...group.ventas].sort(
        (a, b) => compare(a.categoriaNombre, b.categoriaNombre) || compare(a.ventaId, b.ventaId),
      ),
    }));
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function servicesLine(names: readonly string[]): string {
  const full = joinNames(names);
  if (full.length <= META_PARAM_MAX) return full;
  for (let shown = names.length - 1; shown >= 1; shown -= 1) {
    const line = `${names.slice(0, shown).join(', ')} y ${names.length - shown} más`;
    if (line.length <= META_PARAM_MAX) return line;
  }
  return full.slice(0, META_PARAM_MAX).trimEnd();
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

const SECRET_MASK = '••••••••';

/**
 * Copia de los datos con la contrasena y el PIN ocultos, para guardar en el chat lo que se envio
 * sin dejar los secretos en la bandeja. El mensaje real que recibe el cliente no usa esta copia.
 */
export function maskCredentials(data: MessageData): MessageData {
  const hide = (value: string) => (value && value !== EMPTY ? SECRET_MASK : value);
  return {
    ...data,
    contrasena: hide(data.contrasena),
    codigo: hide(data.codigo),
    itemRows: data.itemRows.map((row) => ({ ...row, contrasena: hide(row.contrasena), codigo: hide(row.codigo) })),
  };
}

function itemRow(venta: NoticeVenta): MessageItemData {
  return {
    servicio: venta.servicioNombre || venta.categoriaNombre,
    categoria: venta.categoriaNombre,
    perfil: venta.perfilNombre,
    correo: venta.correo,
    contrasena: venta.contrasena,
    codigo: venta.codigo,
    vencimiento: formatVencimiento(venta.fechaVencimiento),
    monto: formatMonto(venta.monto),
  };
}

export function buildMessageData(group: NoticeGroup, options: { saludo?: string; now: Date }): MessageData {
  const saludo = options.saludo ?? getSaludo(options.now);
  const first = group.ventas[0];
  const names = [...new Set(group.ventas.map((v) => v.categoriaNombre).filter(Boolean))];
  const total = group.ventas.reduce((sum, v) => sum + v.monto, 0);
  return {
    saludo,
    saludo_nombre: greetingFor(group.clienteNombre, saludo),
    cliente: group.clienteNombre,
    nombre_cliente: firstName(group.clienteNombre) || group.clienteNombre,
    servicios: servicesLine(names),
    vencimiento: formatVencimiento(group.fechaVencimiento),
    monto_total: formatMonto(total),
    perfil: first?.perfilNombre ?? '',
    correo: first?.correo ?? '',
    contrasena: first?.contrasena ?? '',
    codigo: first?.codigo ?? '',
    items: group.ventas.map((v) => `*${v.categoriaNombre}*`).join('\n'),
    itemRows: group.ventas.map(itemRow),
  };
}

function cleanParam(value: string): string {
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return clean.length > META_PARAM_MAX ? clean.slice(0, META_PARAM_MAX).trimEnd() : clean;
}

export function metaParamsFromMap(paramMap: readonly string[], data: MessageData): string[] {
  return paramMap.map((key) => {
    const raw = (data as Record<string, unknown>)[key];
    if (typeof raw !== 'string') throw new Error(`Dato de plantilla desconocido: ${key}`);
    const value = cleanParam(raw);
    if (!value) throw new Error(`Dato de plantilla vacio: ${key}`);
    return value;
  });
}

function fill(template: string, data: MessageData, row: MessageItemData | null): string {
  const only = data.itemRows.length === 1 ? data.itemRows[0] : undefined;
  const source: MessageItemData = row ?? {
    servicio: only?.servicio ?? data.servicios,
    categoria: only?.categoria ?? data.servicios,
    perfil: data.perfil,
    correo: data.correo,
    contrasena: data.contrasena,
    codigo: data.codigo,
    vencimiento: data.vencimiento,
    monto: data.monto_total,
  };
  return replacePlaceholders(template.replaceAll('{saludo}', data.saludo), {
    cliente: data.cliente,
    nombreCliente: data.nombre_cliente,
    servicio: source.servicio ?? '',
    categoria: source.categoria ?? '',
    perfilNombre: source.perfil || EMPTY,
    correo: source.correo || EMPTY,
    contrasena: source.contrasena || EMPTY,
    vencimiento: source.vencimiento ?? '',
    monto: source.monto ?? '',
    codigo: source.codigo || EMPTY,
    items: data.items,
  });
}

/**
 * Texto libre del editor para un grupo. Fuera del bloque, {monto} es el total y
 * {servicio} la lista de servicios; dentro de {{#items}} cada venta usa lo suyo.
 */
export function renderFreeText(template: string, data: MessageData): string {
  const withItems = template.replace(ITEMS_BLOCK, (_match, block: string) => {
    const body = block.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
    return data.itemRows.map((row) => fill(body, data, row)).join('\n');
  });
  return fill(withItems, data, null).trim();
}

function fnv1a(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function noticeDedupeKey(
  tipo: string,
  clienteId: string,
  fechaVencimiento: Date | null,
  ventaIds: readonly string[],
  eventId?: string,
): string {
  // Sin eventId la llave es identica a la de siempre; con eventId cada evento (p. ej. un cambio de
  // credenciales) tiene su propia llave y la proteccion solo cubre reintentos del mismo evento.
  const joined = [...ventaIds].sort().join(',') + (eventId ? `|${eventId}` : '');
  const hash = fnv1a(joined, 0x811c9dc5) + fnv1a(joined, 0x9747b28c);
  const fecha = fechaVencimiento ? dayKey(fechaVencimiento) : 'sin-fecha';
  return `${tipo}:${clienteId}:${fecha}:${hash}`;
}
