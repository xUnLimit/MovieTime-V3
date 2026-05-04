/**
 * VentasProximasTable Component
 *
 * Displays venta (sales) notifications with NO additional queries
 * All data is denormalized in the notification document
 *
 * Type-Safe: Uses esNotificacionVenta type guard to narrow union type
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BellRing, BellOff, Search, MoreHorizontal, MessageSquare, XCircle, RefreshCw, User, Scissors, AlertTriangle, ChevronDown, ShoppingCart, Tv2, Copy, Eye, EyeOff } from 'lucide-react';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { esNotificacionVenta } from '@/types/notificaciones';
import type { NotificacionVenta } from '@/types/notificaciones';
import { useTemplatesStore } from '@/store/templatesStore';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import type { MetodoPago } from '@/types/metodos-pago';
import type { Plan } from '@/types/categorias';
import { useVentasStore } from '@/store/ventasStore';
import { useServiciosStore } from '@/store/serviciosStore';
import type { VentaDoc } from '@/types/ventas';
import { update, adjustServiciosActivos, getById, COLLECTIONS } from '@/lib/firebase/firestore';
import { getCurrencySymbol } from '@/lib/constants';
import { crearPagoRenovacion } from '@/lib/services/pagosVentaService';
import { upsertVentaPronostico, adjustIngresosStats, getMesKeyFromDate, getDiaKeyFromDate } from '@/lib/services/dashboardStatsService';
import { generarMensajeVenta, openWhatsApp } from '@/lib/utils/whatsapp';
import { PagoDialog } from '@/components/shared/PagoDialog';
import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import { AccionesVentaDialog } from './AccionesVentaDialog';
import { toast } from 'sonner';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { format } from 'date-fns';
import { syncUsuarioMetodoPago } from '@/lib/services/usuarioMetodoPagoSyncService';
import { withPendingUserPaymentMethod } from '@/lib/utils/usuarioMetodoPago';
import { calculateDiscountedAmount, roundToDecimals } from '@/lib/utils/calculations';

// Helper para obtener contexto de usuario
function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

/**
 * Get bell icon color based on days remaining
 */
function getBellIconColor(diasRestantes: number): {
  bgColor: string;
  hoverBgColor: string;
  textColor: string;
} {
  if (diasRestantes <= 0) {
    // Vence hoy (0) o vencida (< 0) - Red
    return {
      bgColor: 'bg-red-100 dark:bg-red-500/20',
      hoverBgColor: 'hover:bg-red-200 dark:hover:bg-red-500/30',
      textColor: 'text-red-600 dark:text-red-400',
    };
  } else if (diasRestantes >= 1 && diasRestantes <= 7) {
    // De 1 a 7 días restantes - Yellow
    return {
      bgColor: 'bg-yellow-100 dark:bg-yellow-500/20',
      hoverBgColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-500/30',
      textColor: 'text-yellow-600 dark:text-yellow-400',
    };
  } else {
    // Más de 7 días - Yellow (sin verde)
    return {
      bgColor: 'bg-yellow-100 dark:bg-yellow-500/20',
      hoverBgColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-500/30',
      textColor: 'text-yellow-600 dark:text-yellow-400',
    };
  }
}

/**
 * Get status badge based on days remaining
 */
function getEstadoBadge(
  diasRestantes: number,
  resaltada: boolean
): { variant: string; text: string } {
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    return {
      variant: resaltada
        ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
        : 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      text: `${dias} día${dias > 1 ? 's' : ''} de retraso`,
    };
  } else if (diasRestantes === 0) {
    return {
      variant: resaltada
        ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
        : 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      text: 'Vence hoy',
    };
  } else if (diasRestantes <= 7) {
    return {
      variant: resaltada
        ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
        : 'border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
      text: `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`,
    };
  } else {
    return {
      variant: resaltada
        ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
        : 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
      text: `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`,
    };
  }
}

/**
 * Format date as "d de MMMM del yyyy" in Spanish
 */
function formatearFecha(fecha: Date): string {
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const año = fecha.getFullYear();

  return `${dia} de ${mes} del ${año}`;
}

type NotificacionVentaConId = NotificacionVenta & { id: string };

function getFechaLocalKey(fecha: Date): string {
  const date = new Date(fecha);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getGrupoPaginacionVenta(notif: NotificacionVentaConId): string {
  return [
    notif.resaltada ? 'resaltada' : 'normal',
    notif.diasRestantes,
    getFechaLocalKey(notif.fechaFin),
    notif.clienteId || notif.clienteNombre.toLocaleLowerCase('es'),
  ].join('|');
}

export function VentasProximasTable() {
  const { notificaciones, toggleLeida, toggleResaltada, deleteNotificacionesPorVenta, fetchNotificaciones } = useNotificacionesStore();
  const { getTemplateByTipo } = useTemplatesStore();
  const { fetchMetodosPagoUsuarios } = useMetodosPagoStore();
  const { updateVenta, fetchVentas } = useVentasStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [isLoadingRenovar, setIsLoadingRenovar] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [notifSeleccionada, setNotifSeleccionada] = useState<(NotificacionVenta & { id: string }) | null>(null);
  const [metodosPagoUsuarios, setMetodosPagoUsuarios] = useState<MetodoPago[]>([]);
  const [categoriaPlanes, setCategoriaPlanes] = useState<Plan[]>([]);
  const [servicioTipoSeleccionado, setServicioTipoSeleccionado] = useState<string | undefined>();

  // Get venta notifications (type-safe filtering)
  const ventasNotificaciones = useMemo(() => {
    let filtered = notificaciones.filter(esNotificacionVenta);

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (notif) =>
          notif.clienteNombre.toLowerCase().includes(searchLower) ||
          notif.categoriaNombre.toLowerCase().includes(searchLower)
      );
    }

    // Apply estado filter
    if (estadoFilter !== 'todos') {
      if (estadoFilter === 'proximas') {
        filtered = filtered.filter((n) => n.diasRestantes > 0);
      } else if (estadoFilter === 'dia_pago') {
        filtered = filtered.filter((n) => n.diasRestantes === 0);
      } else if (estadoFilter === 'vencidas') {
        filtered = filtered.filter((n) => n.diasRestantes < 0);
      }
    }

    // Sort by priority first; for equal urgency, keep same client/date together.
    return filtered.sort((a, b) => {
      if (a.resaltada !== b.resaltada) {
        return a.resaltada ? -1 : 1;
      }

      const diasDiff = a.diasRestantes - b.diasRestantes;
      if (diasDiff !== 0) return diasDiff;

      const fechaDiff = new Date(a.fechaFin).getTime() - new Date(b.fechaFin).getTime();
      if (fechaDiff !== 0) return fechaDiff;

      const clienteDiff = a.clienteNombre.localeCompare(b.clienteNombre, 'es', {
        sensitivity: 'base',
      });
      if (clienteDiff !== 0) return clienteDiff;

      return a.id.localeCompare(b.id);
    });
  }, [notificaciones, searchQuery, estadoFilter]);

  // Pagination calculations
  const notificationPages = useMemo(() => {
    const pages: NotificacionVentaConId[][] = [];
    let currentPageItems: NotificacionVentaConId[] = [];

    for (let index = 0; index < ventasNotificaciones.length;) {
      const groupKey = getGrupoPaginacionVenta(ventasNotificaciones[index]);
      const group: NotificacionVentaConId[] = [];

      while (
        index < ventasNotificaciones.length &&
        getGrupoPaginacionVenta(ventasNotificaciones[index]) === groupKey
      ) {
        group.push(ventasNotificaciones[index]);
        index++;
      }

      if (
        currentPageItems.length > 0 &&
        group.length <= itemsPerPage &&
        currentPageItems.length + group.length > itemsPerPage
      ) {
        pages.push(currentPageItems);
        currentPageItems = [];
      }

      if (group.length > itemsPerPage) {
        if (currentPageItems.length > 0) {
          pages.push(currentPageItems);
          currentPageItems = [];
        }

        for (let groupIndex = 0; groupIndex < group.length; groupIndex += itemsPerPage) {
          pages.push(group.slice(groupIndex, groupIndex + itemsPerPage));
        }
      } else {
        currentPageItems.push(...group);
      }
    }

    if (currentPageItems.length > 0) {
      pages.push(currentPageItems);
    }

    return pages;
  }, [ventasNotificaciones, itemsPerPage]);
  const totalPages = Math.max(1, notificationPages.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedNotificaciones = notificationPages[safeCurrentPage - 1] ?? [];


  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`, { description: `${label} copiado al portapapeles exitosamente.` });
    } catch {
      toast.error('Error al copiar', { description: `No se pudo copiar ${label} al portapapeles.` });
    }
  };

  const togglePasswordVisibility = (notifId: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notifId)) {
        newSet.delete(notifId);
      } else {
        newSet.add(notifId);
      }
      return newSet;
    });
  };

  /**
   * Handle Notificar action - Send WhatsApp message with appropriate template
   */
  const handleNotificar = (notif: NotificacionVenta & { id: string }) => {
    // Select template based on diasRestantes
    const tipoTemplate = notif.diasRestantes <= 0 ? 'dia_pago' : 'notificacion_regular';
    const template = getTemplateByTipo(tipoTemplate);

    if (!template) {
      toast.error(`Template de ${tipoTemplate === 'dia_pago' ? 'día de pago' : 'notificación regular'} no encontrado`);
      return;
    }

    // Generate WhatsApp message
    try {
      // Extract first name from full name (e.g., "Juan Pérez" -> "Juan")
      const clienteSoloNombre = notif.clienteNombre.split(' ')[0];

      const mensaje = generarMensajeVenta(template.contenido, {
        clienteNombre: notif.clienteNombre,
        clienteSoloNombre,
        servicioNombre: notif.servicioNombre,
        categoriaNombre: notif.categoriaNombre,
        perfilNombre: notif.perfilNombre,
        correo: notif.servicioCorreo || '',
        contrasena: notif.servicioContrasena || '',
        codigo: notif.codigo,
        fechaVencimiento: new Date(notif.fechaFin),
        monto: notif.precioFinal || 0,
        diasRetraso: notif.diasRestantes < 0 ? Math.abs(notif.diasRestantes) : undefined,
      });

      // Open WhatsApp with client's phone number
      if (notif.clienteTelefono) {
        openWhatsApp(notif.clienteTelefono, mensaje);
        toast.success('Abriendo WhatsApp con el cliente...');
      } else {
        // Fallback: Open WhatsApp without phone number
        const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        toast.warning('Teléfono del cliente no disponible. Selecciona el contacto manualmente.');
      }
    } catch (error) {
      console.error('Error generando mensaje WhatsApp:', error);
      toast.error('Error generando mensaje de WhatsApp');
    }
  };

  /**
   * Handle Cancelar action - Send cancellation message via WhatsApp
   */
  const handleCancelar = (notif: NotificacionVenta & { id: string }) => {
    const template = getTemplateByTipo('cancelacion');

    if (!template) {
      toast.error('Template de cancelación no encontrado');
      return;
    }

    try {
      // Extract first name from full name
      const clienteSoloNombre = notif.clienteNombre.split(' ')[0];

      const mensaje = generarMensajeVenta(template.contenido, {
        clienteNombre: notif.clienteNombre,
        clienteSoloNombre,
        servicioNombre: notif.servicioNombre,
        categoriaNombre: notif.categoriaNombre,
        perfilNombre: notif.perfilNombre,
        correo: notif.servicioCorreo || '',
        contrasena: notif.servicioContrasena || '',
        codigo: notif.codigo,
        fechaVencimiento: new Date(notif.fechaFin),
        monto: notif.precioFinal || 0,
      });

      // Open WhatsApp with client's phone number
      if (notif.clienteTelefono) {
        openWhatsApp(notif.clienteTelefono, mensaje);
        toast.success('Abriendo WhatsApp con el cliente...');
      } else {
        // Fallback: Open WhatsApp without phone number
        const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        toast.warning('Teléfono del cliente no disponible. Selecciona el contacto manualmente.');
      }
    } catch (error) {
      console.error('Error generando mensaje de cancelación:', error);
      toast.error('Error generando mensaje de cancelación');
    }
  };

  /**
   * Handle Renovar action - Open renewal dialog
   */
  const handleRenovar = async (notif: NotificacionVenta & { id: string }) => {
    if (isLoadingRenovar) return;
    setIsLoadingRenovar(true);
    setNotifSeleccionada(notif);
    setCategoriaPlanes([]);
    setServicioTipoSeleccionado(undefined);
    try {
      // Fetch payment methods and categoria planes in parallel
      const [metodos] = await Promise.all([
        fetchMetodosPagoUsuarios(),
        (async () => {
          if (notif.categoriaId) {
            const categoriaDoc = await getById<Record<string, unknown>>(COLLECTIONS.CATEGORIAS, notif.categoriaId);
            if (categoriaDoc && Array.isArray(categoriaDoc.planes)) {
              setCategoriaPlanes(categoriaDoc.planes as Plan[]);
            }
          }
        })(),
        (async () => {
          if (notif.servicioId) {
            const servicioDoc = await getById<Record<string, unknown>>(COLLECTIONS.SERVICIOS, notif.servicioId);
            if (servicioDoc && typeof servicioDoc.tipo === 'string') {
              setServicioTipoSeleccionado(servicioDoc.tipo);
            }
          }
        })(),
      ]);
      setMetodosPagoUsuarios(withPendingUserPaymentMethod(metodos));
      setRenovarDialogOpen(true);
    } finally {
      setIsLoadingRenovar(false);
    }
  };

  /**
   * Handle renewal confirmation from PagoDialog
   */
  const handleConfirmRenovacion = async (data: EnrichedPagoDialogFormData) => {
    if (!notifSeleccionada) return;

    try {
      const { metodosPago } = useMetodosPagoStore.getState();

      const metodoPagoSeleccionado = metodosPago.find((m) => m.id === data.metodoPagoId);
      const costo = roundToDecimals(data.costo);
      const descuentoNumero = roundToDecimals(Number(data.descuento) || 0);
      const monto = calculateDiscountedAmount(costo, descuentoNumero);
      const notaPrincipal = data.notas?.trim() ?? '';

      // Crear pago en la colección pagosVenta
      await crearPagoRenovacion(
        notifSeleccionada.ventaId,
        notifSeleccionada.clienteId,
        notifSeleccionada.clienteNombre,
        notifSeleccionada.categoriaId || '',
        monto,
        metodoPagoSeleccionado?.nombre || data.metodoPagoNombre || '',
        data.metodoPagoId,
        data.moneda || metodoPagoSeleccionado?.moneda || notifSeleccionada.moneda || 'USD',
        data.periodoRenovacion as VentaDoc['cicloPago'],
        notaPrincipal,
        data.fechaInicio,
        data.fechaVencimiento,
        costo,
        descuentoNumero
      );

      // Actualizar fechaFin y notas en VentaDoc
      await updateVenta(notifSeleccionada.ventaId, {
        fechaFin: data.fechaVencimiento,
        fechaInicio: data.fechaInicio,
        notas: notaPrincipal,
      });

      try {
        await syncUsuarioMetodoPago({
          usuarioId: notifSeleccionada.clienteId,
          metodoPagoId: data.metodoPagoId,
          metodoPagoNombre: metodoPagoSeleccionado?.nombre || data.metodoPagoNombre || '',
          moneda: data.moneda || metodoPagoSeleccionado?.moneda || notifSeleccionada.moneda || 'USD',
        });
      } catch (syncError) {
        console.error('Error sincronizando método de pago del usuario:', syncError);
        toast.warning('Venta renovada con advertencia', {
          description: 'La renovación se guardó, pero no se pudo actualizar el método de pago en usuarios.',
        });
      }

      // Registrar en log de actividad
      useActivityLogStore.getState().addLog({
        ...getLogContext(),
        accion: 'renovacion',
        entidad: 'venta',
        entidadId: notifSeleccionada.ventaId,
        entidadNombre: `${notifSeleccionada.clienteNombre} — ${notifSeleccionada.servicioNombre}`,
        detalles: `Venta renovada: ${notifSeleccionada.clienteNombre} / ${notifSeleccionada.servicioNombre} — ${getCurrencySymbol(data.moneda)}${monto.toFixed(2)} — hasta ${format(data.fechaVencimiento, 'dd/MM/yyyy')} (${data.periodoRenovacion})`,
      }).catch(() => {});

      // Actualizar dashboard: local INMEDIATAMENTE + Firestore en background
      const ventaPronosticoData = {
        id: notifSeleccionada.ventaId,
        categoriaId: notifSeleccionada.categoriaId || '',
        fechaInicio: data.fechaInicio.toISOString(),
        fechaFin: data.fechaVencimiento.toISOString(),
        cicloPago: data.periodoRenovacion,
        precioFinal: monto,
        moneda: data.moneda || metodoPagoSeleccionado?.moneda || notifSeleccionada.moneda || 'USD',
      };
      import('@/store/dashboardStore').then(({ useDashboardStore }) => {
        const store = useDashboardStore.getState();
        const currentStats = store.stats;
        if (currentStats) {
          const existing = currentStats.ventasPronostico ?? [];
          const updated = existing.some(v => v.id === notifSeleccionada.ventaId)
            ? existing.map(v => v.id === notifSeleccionada.ventaId ? ventaPronosticoData : v)
            : [...existing, ventaPronosticoData];
          useDashboardStore.setState({
            stats: { ...currentStats, ventasPronostico: updated },
          });
        }
        store.invalidateCache();
      }).catch(() => {});
      upsertVentaPronostico(ventaPronosticoData, notifSeleccionada.ventaId).catch(() => {});

      // Sync dashboard ingresos for the new payment
      adjustIngresosStats({
        delta: monto,
        moneda: data.moneda || metodoPagoSeleccionado?.moneda || notifSeleccionada.moneda || 'USD',
        mes: getMesKeyFromDate(data.fechaInicio),
        dia: getDiaKeyFromDate(data.fechaInicio),
        categoriaId: notifSeleccionada.categoriaId || '',
        categoriaNombre: notifSeleccionada.categoriaNombre || '',
      }).catch(() => {});

      // ✅ Eliminar notificaciones de esta venta (auto-cleanup al renovar)
      await deleteNotificacionesPorVenta(notifSeleccionada.ventaId);
      fetchNotificaciones(true);

      // Refresh data
      await fetchVentas(true);

      setRenovarDialogOpen(false);

      // Si el usuario eligió notificar por WhatsApp, usar el mensaje editado del dialog
      if (data.notificarWhatsApp && data.mensajeWhatsApp) {
        const phone = notifSeleccionada.clienteTelefono
          ? notifSeleccionada.clienteTelefono.replace(/[^\d+]/g, '')
          : '';
        const mensajeAEnviar = data.mensajeWhatsApp;
        toast.success('Venta renovada exitosamente', {
          duration: Infinity,
          action: {
            label: 'Enviar WhatsApp',
            onClick: () => {
              const base = phone
                ? `https://web.whatsapp.com/send?phone=${phone}&text=`
                : `https://web.whatsapp.com/send?text=`;
              window.open(base + encodeURIComponent(mensajeAEnviar), '_blank', 'noopener,noreferrer');
            },
          },
          actionButtonStyle: { backgroundColor: '#15803d', color: '#fff' },
        });
      } else {
        toast.success('Venta renovada exitosamente');
      }

      setNotifSeleccionada(null);
    } catch (error) {
      console.error('Error renovando venta:', error);
      toast.error('Error al renovar la venta');
    }
  };

  /**
   * Handle Acciones button - Open modal
   */
  const handleAcciones = (notif: NotificacionVenta & { id: string }) => {
    setNotifSeleccionada(notif);
    setAccionesDialogOpen(true);
  };

  /**
   * Handle Resaltar from modal - Toggle resaltada state
   */
  const handleResaltar = async () => {
    if (!notifSeleccionada) return;

    try {
      await toggleResaltada(notifSeleccionada.id, !notifSeleccionada.resaltada);
      toast.success('Notificación resaltada para seguimiento');
    } catch (error) {
      console.error('Error al resaltar:', error);
      toast.error('Error al resaltar la notificación');
    }
  };

  /**
   * Handle Descartar from modal - Remove resaltada state (set to false)
   */
  const handleDescartar = async () => {
    if (!notifSeleccionada) return;

    try {
      await toggleResaltada(notifSeleccionada.id, false);
      toast.success('Resaltado descartado');
    } catch (error) {
      console.error('Error al descartar resaltado:', error);
      toast.error('Error al descartar el resaltado');
    }
  };

  /**
   * Handle Cortar from modal - Deactivate sale and free profile
   */
  const handleCortarFromModal = async () => {
    if (!notifSeleccionada) return;

    try {
      // 1. Update venta to inactive
      await update('ventas', notifSeleccionada.ventaId, {
        estado: 'inactivo',
      });

      // 2. Free the profile if it exists
      if (notifSeleccionada.servicioId) {
        const updatePerfil = useServiciosStore.getState().updatePerfilOcupado;
        await updatePerfil(notifSeleccionada.servicioId, false);
      }

      // 3. Decrement serviciosActivos counter
      await adjustServiciosActivos(notifSeleccionada.clienteId, -1);

      // 4. Delete notification
      await deleteNotificacionesPorVenta(notifSeleccionada.ventaId);
      fetchNotificaciones(true);

      // Registrar en log de actividad
      useActivityLogStore.getState().addLog({
        ...getLogContext(),
        accion: 'actualizacion',
        entidad: 'venta',
        entidadId: notifSeleccionada.ventaId,
        entidadNombre: `${notifSeleccionada.clienteNombre} — ${notifSeleccionada.servicioNombre}`,
        detalles: `Venta cortada: ${notifSeleccionada.clienteNombre} / ${notifSeleccionada.servicioNombre} — estado cambiado a inactivo, perfil liberado`,
        cambios: [{ campo: 'Estado', campoKey: 'estado', anterior: 'activo', nuevo: 'inactivo', tipo: 'string' as const }],
      }).catch(() => {});

      // Remove from dashboard forecast
      upsertVentaPronostico(null, notifSeleccionada.ventaId).catch(() => {});
      // Invalidate dashboard cache so it re-fetches on next visit
      import('@/store/dashboardStore').then(({ useDashboardStore }) => {
        useDashboardStore.getState().invalidateCache();
      }).catch(() => {});

      toast.success('Venta cortada exitosamente');

      // Refresh data
      await fetchVentas(true);
    } catch (error) {
      console.error('Error cortando venta:', error);
      toast.error('Error al cortar la venta');
      throw error; // Re-throw to let modal handle it
    }
  };

  return (
    <Card className="p-4 pb-2">
      <h3 className="text-xl font-semibold">Ventas próximas a vencer</h3>
      <div className="flex items-center gap-4 -mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o categoría..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>

        {/* Estado filter */}
        {(() => {
          const opciones = [
            { value: 'todos', label: 'Todos los estados' },
            { value: 'proximas', label: 'Próximas a vencer' },
            { value: 'dia_pago', label: 'Día de pago' },
            { value: 'vencidas', label: 'Vencidas' },
          ];
          const labelActual = opciones.find(o => o.value === estadoFilter)?.label ?? 'Todos los estados';
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-between font-normal">
                  {labelActual}
                  <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {opciones.map(op => (
                  <DropdownMenuItem
                    key={op.value}
                    onClick={() => { setEstadoFilter(op.value); setCurrentPage(1); }}
                    className="flex items-center justify-between"
                  >
                    {op.label}
                    {estadoFilter === op.value && <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}
      </div>

      {ventasNotificaciones.length === 0 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No se encontraron notificaciones de ventas
          </p>
        </div>
      ) : (
        <div>
          <div className="rounded-md border">
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b hover:bg-muted/50">
                    <TableHead className="h-12 px-4 text-center text-muted-foreground w-[80px]">
                      Tipo
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Cliente
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Categoría
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Email
                    </TableHead>
                    <TableHead className="h-12 w-[160px] px-4 text-center text-muted-foreground">
                      Contraseña
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Perfil
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Código
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Fecha de Inicio
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Fecha de Vencimiento
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Monto
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Estado
                    </TableHead>
                    <TableHead className="h-12 px-4 text-center text-muted-foreground">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedNotificaciones.map((notif) => {
                    const bellColors = getBellIconColor(notif.diasRestantes);
                    const estadoBadge = getEstadoBadge(notif.diasRestantes, notif.resaltada);

                    return (
                      <TableRow
                        key={notif.id}
                        className={`border-b transition-colors hover:bg-muted/50 ${
                          notif.resaltada ? 'bg-orange-50/50 dark:bg-orange-500/5' : ''
                        }`}
                      >
                        {/* Tipo - Bell/Warning icon */}
                        <TableCell className="p-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`mx-auto h-8 w-8 rounded-full transition-all duration-200 ease-in-out ${
                              notif.resaltada
                                ? 'bg-orange-100 dark:bg-orange-500/20 hover:bg-orange-200 dark:hover:bg-orange-500/30'
                                : notif.leida
                                  ? 'bg-gray-100 dark:bg-gray-500/20 hover:bg-gray-200 dark:hover:bg-gray-500/30'
                                  : `${bellColors.bgColor} ${bellColors.hoverBgColor}`
                            } hover:scale-105`}
                            onClick={() => !notif.resaltada && toggleLeida(notif.id, !notif.leida)}
                            title={
                              notif.resaltada
                                ? 'Notificación resaltada (usa Acciones para gestionar)'
                                : notif.leida
                                  ? 'Marcar como sin leer'
                                  : 'Marcar como leída'
                            }
                          >
                            {notif.resaltada ? (
                              <AlertTriangle className="h-4 w-4 transition-all duration-200 ease-in-out text-orange-500" />
                            ) : notif.leida ? (
                              <BellOff className="h-4 w-4 transition-all duration-200 ease-in-out text-gray-400 dark:text-gray-500" />
                            ) : (
                              <BellRing className={`h-4 w-4 transition-all duration-200 ease-in-out ${bellColors.textColor}`} />
                            )}
                          </Button>
                        </TableCell>

                        {/* Cliente */}
                        <TableCell className="p-4 text-center font-medium truncate">
                          {notif.clienteNombre}
                        </TableCell>

                        {/* Categoría */}
                        <TableCell className="p-4 text-center">
                          {notif.categoriaNombre}
                        </TableCell>

                        {/* Email */}
                        <TableCell className="p-4 text-center">
                          {notif.servicioCorreo ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-medium truncate max-w-[200px]">
                                {notif.servicioCorreo}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => copyToClipboard(notif.servicioCorreo!, 'Email')}
                                title="Copiar email"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>

                        {/* Contraseña */}
                        <TableCell className="w-[160px] p-4 text-center">
                          {notif.servicioContrasena ? (
                            <div className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-1">
                              <span className="min-w-0 break-all text-center font-medium leading-tight">
                                {visiblePasswords.has(notif.id) ? notif.servicioContrasena : '••••••••'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => togglePasswordVisibility(notif.id)}
                                title={visiblePasswords.has(notif.id) ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              >
                                {visiblePasswords.has(notif.id) ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => copyToClipboard(notif.servicioContrasena!, 'Contraseña')}
                                title="Copiar contraseña"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>

                        {/* Perfil */}
                        <TableCell className="p-4 text-center">
                          <span className="font-medium">
                            {notif.perfilNombre || '-'}
                          </span>
                        </TableCell>

                        {/* Código */}
                        <TableCell className="p-4 text-center">
                          {notif.codigo ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-medium">
                                {notif.codigo}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => copyToClipboard(notif.codigo!, 'Código')}
                                title="Copiar código"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>

                        {/* Fecha de Inicio */}
                        <TableCell className="p-4 text-center">
                          {notif.fechaInicio ? formatearFecha(new Date(notif.fechaInicio)) : '—'}
                        </TableCell>

                        {/* Fecha de Vencimiento */}
                        <TableCell className="p-4 text-center">
                          {formatearFecha(new Date(notif.fechaFin))}
                        </TableCell>

                        {/* Monto */}
                        <TableCell className="p-4 text-center">
                          {getCurrencySymbol(notif.moneda)}{notif.precioFinal?.toFixed(2) || '0.00'}
                        </TableCell>

                        {/* Estado */}
                        <TableCell className="p-4 text-center">
                          <Badge
                            variant="outline"
                            className={`font-normal gap-1 ${estadoBadge.variant}`}
                          >
                            {notif.resaltada && (
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                            )}
                            {estadoBadge.text}
                          </Badge>
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="p-4 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleNotificar(notif)}>
                                <MessageSquare className="h-4 w-4 mr-2 text-green-600" />
                                <span className="text-green-600">Notificar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCancelar(notif)}>
                                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                <span className="text-red-600">Cancelar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAcciones(notif)}>
                                <Scissors className="h-4 w-4 mr-2 text-orange-600" />
                                <span className="text-orange-600">Cortar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRenovar(notif)}>
                                <RefreshCw className="h-4 w-4 mr-2 text-purple-600" />
                                <span className="text-purple-600">Renovar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/usuarios/${notif.clienteId}`}>
                                  <User className="h-4 w-4 mr-2" />
                                  Ver Cliente
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/ventas/${notif.ventaId}`}>
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Ver Venta
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/servicios/detalle/${notif.servicioId}`}>
                                  <Tv2 className="h-4 w-4 mr-2" />
                                  Ver Servicio
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-2 py-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mostrar</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-[70px] px-2 justify-between">
                    {itemsPerPage}
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {[10, 25, 50, 100].map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => handleItemsPerPageChange(size.toString())}
                      className={itemsPerPage === size ? 'bg-accent' : ''}
                    >
                      {size}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Página {safeCurrentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={safeCurrentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={safeCurrentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renewal Dialog */}
      {notifSeleccionada && (
        <PagoDialog
          context="venta"
          mode="renew"
          open={renovarDialogOpen}
          onOpenChange={setRenovarDialogOpen}
          venta={{
            clienteNombre: notifSeleccionada.clienteNombre,
            metodoPagoId: notifSeleccionada.metodoPagoId,
            precioFinal: notifSeleccionada.precioFinal || 0,
            fechaFin: new Date(notifSeleccionada.fechaFin),
          }}
          metodosPago={metodosPagoUsuarios}
          categoriaPlanes={categoriaPlanes}
          tipoPlan={servicioTipoSeleccionado}
          onConfirm={handleConfirmRenovacion}
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

      {/* Acciones Dialog */}
      <AccionesVentaDialog
        notificacion={notifSeleccionada}
        isOpen={accionesDialogOpen}
        onOpenChange={setAccionesDialogOpen}
        onCortar={handleCortarFromModal}
        onResaltar={handleResaltar}
        onDescartar={handleDescartar}
      />
    </Card>
  );
}

