import React from 'react';
import { ActivityLog } from '@/types';
import {
  Edit, Trash2, Plus, RefreshCw, Scissors, Pause, Play,
  UserPlus, UserMinus, UserCog,
  Tv2, ShoppingCart, Tag, CreditCard, FileText, RotateCcw,
} from 'lucide-react';

export const activityActionColors: Record<string, string> = {
  creacion:     'bg-green-500/10 text-green-500',
  actualizacion:'bg-blue-500/10 text-blue-500',
  eliminacion:  'bg-red-500/10 text-red-500',
  renovacion:   'bg-purple-500/10 text-purple-500',
};

type IconComponent = React.ComponentType<{ className?: string }>;

interface ActivityDisplayConfig {
  icon: IconComponent;
  color: string;
  message: React.ReactNode;
}

/** Extrae el correo del formato "[correo@ejemplo.com]" de cualquier string */
function parseCorreo(texto: string): string | null {
  const match = texto.match(/\[([^\]]+@[^\]]+)\]/);
  return match?.[1] ?? null;
}

/** Limpia el nombre quitando el sufijo "[correo@...]" si existe */
function parsNombreLimpio(entidadNombre: string): string {
  return entidadNombre.replace(/\s*\[[^\]]+@[^\]]+\]/, '').trim();
}

/**
 * Intenta extraer el nombre de la entidad desde el campo detalles
 * cuando entidadNombre está vacío (logs viejos).
 * Soporta formatos:
 *   "Venta renovada: Nombre Cliente / Servicio — ..."
 *   'Servicio renovado: "Spotify - Familiar" — ...'
 *   "Venta creada: Nombre / Servicio — ..."
 */
function parseNombreDesdeDetalles(detalles: string): string | null {
  // Formato venta: "... : Nombre Cliente / Nombre Servicio —"
  const ventaMatch = detalles.match(/:\s*(.+?)\s*\/\s*(.+?)\s*—/);
  if (ventaMatch) return `${ventaMatch[1].trim()} — ${ventaMatch[2].trim()}`;

  // Formato servicio con comillas: '... : "Nombre Servicio" —'
  const servicioQuotedMatch = detalles.match(/:\s*"([^"]+)"/);
  if (servicioQuotedMatch) return servicioQuotedMatch[1].trim();

  // Formato servicio sin comillas: "... : Nombre Servicio —"
  const servicioMatch = detalles.match(/:\s*(.+?)\s*—/);
  if (servicioMatch) return servicioMatch[1].trim();

  return null;
}

/** Extrae info de renovación: monto, hasta, periodo */
function parseRenovacion(detalles: string): { monto?: string; hasta?: string; periodo?: string } {
  // Captura símbolo(s) no-alfanumérico(s) + número (ej: "₦2500", "$15.00", "B/.10")
  const montoMatch = detalles.match(/([^\w\s,]+)([0-9]+(?:\.[0-9]+)?)/);
  const hastaMatch = detalles.match(/hasta\s+([\d/]+)/);
  const periodoMatch = detalles.match(/\((\w+)\)/);
  return {
    monto: montoMatch ? `${montoMatch[1]}${montoMatch[2]}` : undefined,
    hasta: hastaMatch?.[1],
    periodo: periodoMatch?.[1],
  };
}

/** Mapeo de campos cambiados a etiquetas amigables */
function getCamposLabel(log: ActivityLog): string | null {
  if (!log.cambios || log.cambios.length === 0) return null;
  const campos = log.cambios.map(c => c.campo);
  if (campos.length <= 3) return campos.join(', ');
  return `${campos.slice(0, 3).join(', ')}…`;
}

function getReposoTransition(log: ActivityLog): { anterior: boolean; nuevo: boolean } | null {
  const cambioReposo = log.cambios?.find((c) =>
    c.campoKey === 'enReposo' || c.campo.toLowerCase() === 'reposo'
  );
  if (!cambioReposo) return null;

  const anterior = cambioReposo.anterior === true;
  const nuevo = cambioReposo.nuevo === true;
  if (anterior === nuevo) return null;

  return { anterior, nuevo };
}

export function getActivityDisplayConfig(log: ActivityLog): ActivityDisplayConfig {
  const detalles = log.detalles ?? '';
  const colorClass = activityActionColors[log.accion] || 'bg-muted/50 text-muted-foreground';

  // Usar entidadNombre si tiene valor real (descartar vacíos, "undefined", "—", " — ", etc.)
  const nombreRaw = log.entidadNombre ?? '';
  const nombreEsValido = nombreRaw.trim() !== ''
    && nombreRaw !== 'undefined'
    && !/^[\s—\-–]+$/.test(nombreRaw)   // descarta " — ", "—", "--", etc.
    && !nombreRaw.includes('undefined');
  const rawNombre = nombreEsValido
    ? nombreRaw
    : (parseNombreDesdeDetalles(detalles) ?? '—');

  const nombreLimpio = parsNombreLimpio(rawNombre);
  const nameEl = <span className="font-semibold">{nombreLimpio}</span>;
  const correo = parseCorreo(rawNombre) ?? parseCorreo(detalles);
  const correoEl = correo
    ? <span className="text-muted-foreground text-xs ml-1">({correo})</span>
    : null;

  const iconMap: Record<string, IconComponent> = {
    venta: ShoppingCart, servicio: Tv2, usuario: UserCog,
    cliente: UserCog, revendedor: UserCog, categoria: Tag,
    metodo_pago: CreditCard, template: FileText,
  };

  const entidadLabels: Record<string, string> = {
    venta: 'Venta', servicio: 'Servicio', usuario: 'Usuario',
    cliente: 'Cliente', revendedor: 'Revendedor', categoria: 'Categoría',
    metodo_pago: 'Método de pago', template: 'Template',
  };
  const label = entidadLabels[log.entidad] ?? log.entidad;

  // Género gramatical por entidad para conjugar correctamente
  const femenino = new Set(['venta', 'categoria']);
  const gen = (masc: string, fem: string) => femenino.has(log.entidad) ? fem : masc;

  switch (log.accion) {
    case 'creacion': {
      const icon = (log.entidad === 'usuario' || log.entidad === 'cliente' || log.entidad === 'revendedor')
        ? UserPlus
        : (iconMap[log.entidad] ?? Plus);

      if (log.entidad === 'venta') {
        return { icon, color: colorClass, message: <><span>Venta creada —</span> {nameEl}</> };
      }
      if (log.entidad === 'servicio') {
        return { icon, color: colorClass, message: <><span>Servicio creado —</span> {nameEl}{correoEl}</> };
      }
      return { icon, color: colorClass, message: <><span>{label} {gen('creado', 'creada')} —</span> {nameEl}</> };
    }

    case 'actualizacion': {
      const reposoTransition = getReposoTransition(log);
      if (reposoTransition) {
        if (reposoTransition.nuevo) {
          const reposoColor = 'bg-yellow-500/10 text-yellow-500';
          if (log.entidad === 'servicio') {
            return { icon: Pause, color: reposoColor, message: <><span>Servicio en reposo —</span> {nameEl}{correoEl}</> };
          }
          return { icon: Pause, color: reposoColor, message: <><span>{label} en reposo —</span> {nameEl}</> };
        }

        const reactivadoColor = 'bg-emerald-500/10 text-emerald-500';
        if (log.entidad === 'servicio') {
          return { icon: Play, color: reactivadoColor, message: <><span>Servicio reactivado —</span> {nameEl}{correoEl}</> };
        }
        return { icon: Play, color: reactivadoColor, message: <><span>{label} reactivado —</span> {nameEl}</> };
      }

      // Detectar si es un "corte" (activo: true → false) o (estado → inactivo)
      const esCorte = log.cambios?.some(c =>
        (c.campoKey === 'activo' && c.nuevo === false) ||
        (c.campoKey === 'estado' && c.nuevo === 'inactivo')
      ) ?? detalles.toLowerCase().includes('cortad');

      if (esCorte) {
        const cortarIcon = Scissors;
        const cortarColor = 'bg-orange-500/10 text-orange-500';
        if (log.entidad === 'servicio') {
          return { icon: cortarIcon, color: cortarColor, message: <><span>Servicio cortado —</span> {nameEl}{correoEl}</> };
        }
        if (log.entidad === 'venta') {
          return { icon: cortarIcon, color: cortarColor, message: <><span>Venta cortada —</span> {nameEl}</> };
        }
        return { icon: cortarIcon, color: cortarColor, message: <><span>{label} {gen('cortado', 'cortada')} —</span> {nameEl}</> };
      }

      const icon = iconMap[log.entidad] ?? Edit;
      const camposLabel = getCamposLabel(log);
      const camposEl = camposLabel
        ? <span className="text-muted-foreground text-xs ml-1">({camposLabel})</span>
        : null;

      if (log.entidad === 'servicio') {
        return { icon, color: colorClass, message: <><span>Servicio editado —</span> {nameEl}{correoEl}{camposEl}</> };
      }
      if (log.entidad === 'venta') {
        return { icon, color: colorClass, message: <><span>Venta editada —</span> {nameEl}{camposEl}</> };
      }
      return { icon, color: colorClass, message: <><span>{label} {gen('editado', 'editada')} —</span> {nameEl}{camposEl}</> };
    }

    case 'eliminacion': {
      const icon = (log.entidad === 'usuario' || log.entidad === 'cliente' || log.entidad === 'revendedor')
        ? UserMinus
        : Trash2;
      if (log.entidad === 'servicio') {
        return { icon, color: colorClass, message: <><span>Servicio eliminado —</span> {nameEl}{correoEl}</> };
      }
      if (log.entidad === 'venta') {
        return { icon, color: colorClass, message: <><span>Venta eliminada —</span> {nameEl}</> };
      }
      return { icon, color: colorClass, message: <><span>{label} {gen('eliminado', 'eliminada')} —</span> {nameEl}</> };
    }

    case 'renovacion': {
      const { monto, hasta, periodo } = parseRenovacion(detalles);
      const renDetallesEl = monto
        ? <span className="text-muted-foreground text-xs ml-1">{monto}{hasta ? ` · hasta ${hasta}` : ''}{periodo ? ` (${periodo})` : ''}</span>
        : null;

      if (log.entidad === 'servicio') {
        return { icon: RefreshCw, color: colorClass, message: <><span>Servicio renovado —</span> {nameEl}{correoEl}{renDetallesEl}</> };
      }
      if (log.entidad === 'venta') {
        return { icon: RefreshCw, color: colorClass, message: <><span>Venta renovada —</span> {nameEl}{renDetallesEl}</> };
      }
      return { icon: RefreshCw, color: colorClass, message: <><span>{label} {gen('renovado', 'renovada')} —</span> {nameEl}{renDetallesEl}</> };
    }

    default: {
      return { icon: RotateCcw, color: colorClass, message: <>{log.accion} {label} — {nameEl}</> };
    }
  }
}
