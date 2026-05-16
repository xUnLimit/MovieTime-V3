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
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import {
  invalidateDashboardCache,
  syncVentaPronosticoLocal,
} from '@/lib/commands/client-cache';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import { getServicioUseCase } from '@/lib/use-cases/servicios-use-cases';
import { renewVentaUseCase } from '@/lib/use-cases/ventas-use-cases';
import { generarMensajeVenta, openWhatsApp } from '@/lib/utils/whatsapp';
import { withPendingTerceroPaymentMethod } from '@/lib/utils/terceroMetodoPago';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useVentasStore } from '@/store/ventasStore';
import type { MetodoPago, VentaDoc } from '@/types';
import type { Plan } from '@/types/categorias';

import {
  getPaginasNotificacionesVenta,
  getVentasNotificacionesFiltradas,
} from './ventas-proximas/filters';
import { VentasProximasDialogs } from './ventas-proximas/VentasProximasDialogs';
import { VentasProximasPagination } from './ventas-proximas/VentasProximasPagination';
import { VentasProximasTableContent } from './ventas-proximas/VentasProximasTableContent';
import { VentasProximasToolbar } from './ventas-proximas/VentasProximasToolbar';
import type { NotificacionVentaConId } from './ventas-proximas/types';

function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

export function VentasProximasTable() {
  const {
    notificaciones,
    toggleLeida,
    toggleResaltada,
    deleteNotificacionesPorVenta,
    fetchNotificaciones,
  } = useNotificacionesStore();
  const { getTemplateByTipo } = useTemplatesStore();
  const { fetchMetodosPagoTerceros } = useMetodosPagoStore();
  const { updateVenta, fetchVentas } = useVentasStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set()
  );
  const [isLoadingRenovar, setIsLoadingRenovar] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [accionesDialogOpen, setAccionesDialogOpen] = useState(false);
  const [notifSeleccionada, setNotifSeleccionada] =
    useState<NotificacionVentaConId | null>(null);
  const [metodosPagoTerceros, setMetodosPagoTerceros] = useState<MetodoPago[]>(
    []
  );
  const [categoriaPlanes, setCategoriaPlanes] = useState<Plan[]>([]);
  const [servicioTipoSeleccionado, setServicioTipoSeleccionado] = useState<
    string | undefined
  >();

  const ventasNotificaciones = useMemo(
    () =>
      getVentasNotificacionesFiltradas(
        notificaciones,
        searchQuery,
        estadoFilter
      ),
    [notificaciones, searchQuery, estadoFilter]
  );

  const notificationPages = useMemo(
    () => getPaginasNotificacionesVenta(ventasNotificaciones, itemsPerPage),
    [ventasNotificaciones, itemsPerPage]
  );
  const totalPages = Math.max(1, notificationPages.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedNotificaciones =
    notificationPages[safeCurrentPage - 1] ?? [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleEstadoFilterChange = (value: string) => {
    setEstadoFilter(value);
    setCurrentPage(1);
  };

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
      toast.success(`${label} copiado`, {
        description: `${label} copiado al portapapeles exitosamente.`,
      });
    } catch {
      toast.error('Error al copiar', {
        description: `No se pudo copiar ${label} al portapapeles.`,
      });
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

  const handleNotificar = (notif: NotificacionVentaConId) => {
    const tipoTemplate =
      notif.diasRestantes <= 0 ? 'dia_pago' : 'notificacion_regular';
    const template = getTemplateByTipo(tipoTemplate);

    if (!template) {
      toast.error(
        `Template de ${tipoTemplate === 'dia_pago' ? 'día de pago' : 'notificación regular'} no encontrado`
      );
      return;
    }

    try {
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
        diasRetraso:
          notif.diasRestantes < 0 ? Math.abs(notif.diasRestantes) : undefined,
      });

      if (notif.clienteTelefono) {
        openWhatsApp(notif.clienteTelefono, mensaje);
        toast.success('Abriendo WhatsApp con el cliente...');
      } else {
        const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        toast.warning(
          'Teléfono del cliente no disponible. Selecciona el contacto manualmente.'
        );
      }
    } catch (error) {
      console.error('Error generando mensaje WhatsApp:', error);
      toast.error('Error generando mensaje de WhatsApp');
    }
  };

  const handleCancelar = (notif: NotificacionVentaConId) => {
    const template = getTemplateByTipo('cancelacion');

    if (!template) {
      toast.error('Template de cancelación no encontrado');
      return;
    }

    try {
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

      if (notif.clienteTelefono) {
        openWhatsApp(notif.clienteTelefono, mensaje);
        toast.success('Abriendo WhatsApp con el cliente...');
      } else {
        const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        toast.warning(
          'Teléfono del cliente no disponible. Selecciona el contacto manualmente.'
        );
      }
    } catch (error) {
      console.error('Error generando mensaje de cancelación:', error);
      toast.error('Error generando mensaje de cancelación');
    }
  };

  const handleRenovar = async (notif: NotificacionVentaConId) => {
    if (isLoadingRenovar) return;
    setIsLoadingRenovar(true);
    setNotifSeleccionada(notif);
    setCategoriaPlanes([]);
    setServicioTipoSeleccionado(undefined);
    try {
      const [metodos] = await Promise.all([
        fetchMetodosPagoTerceros(),
        (async () => {
          if (notif.categoriaId) {
            const categoriaDoc = await getCategoriaUseCase<
              Record<string, unknown>
            >(notif.categoriaId);
            if (categoriaDoc && Array.isArray(categoriaDoc.planes)) {
              setCategoriaPlanes(categoriaDoc.planes as Plan[]);
            }
          }
        })(),
        (async () => {
          if (notif.servicioId) {
            const servicioDoc = await getServicioUseCase<
              Record<string, unknown>
            >(notif.servicioId);
            if (servicioDoc && typeof servicioDoc.tipo === 'string') {
              setServicioTipoSeleccionado(servicioDoc.tipo);
            }
          }
        })(),
      ]);
      setMetodosPagoTerceros(withPendingTerceroPaymentMethod(metodos));
      setRenovarDialogOpen(true);
    } finally {
      setIsLoadingRenovar(false);
    }
  };

  const handleConfirmRenovacion = async (
    data: EnrichedPagoDialogFormData
  ) => {
    if (!notifSeleccionada) return;

    try {
      const { metodosPago } = useMetodosPagoStore.getState();
      const metodoPagoSeleccionado = metodosPago.find(
        (m) => m.id === data.metodoPagoId
      );
      const renovacion = await renewVentaUseCase(
        {
          id: notifSeleccionada.ventaId,
          clienteId: notifSeleccionada.clienteId,
          clienteNombre: notifSeleccionada.clienteNombre,
          categoriaId: notifSeleccionada.categoriaId || '',
          categoriaNombre: notifSeleccionada.categoriaNombre,
          servicioId: notifSeleccionada.servicioId,
          servicioNombre: notifSeleccionada.servicioNombre,
          servicioCorreo: notifSeleccionada.servicioCorreo,
          servicioContrasena: notifSeleccionada.servicioContrasena,
          clienteTelefono: notifSeleccionada.clienteTelefono,
          perfilNombre: notifSeleccionada.perfilNombre,
          codigo: notifSeleccionada.codigo,
          metodoPagoId: notifSeleccionada.metodoPagoId,
          moneda: notifSeleccionada.moneda,
          precioFinal: notifSeleccionada.precioFinal,
          estado: 'activo',
        } as VentaDoc,
        {
          ...data,
          metodoPagoNombre:
            metodoPagoSeleccionado?.nombre || data.metodoPagoNombre || '',
          moneda:
            data.moneda ||
            metodoPagoSeleccionado?.moneda ||
            notifSeleccionada.moneda ||
            'USD',
        },
        {
          logContext: getLogContext(),
          recordActivityLog: useActivityLogStore.getState().addLog,
        }
      );

      if (renovacion.syncPaymentMethodFailed) {
        toast.warning('Venta renovada con advertencia', {
          description:
            'La renovación se guardó, pero no se pudo actualizar el método de pago en terceros.',
        });
      }

      const ventaPronosticoData = renovacion.pronostico;
      syncVentaPronosticoLocal(
        notifSeleccionada.ventaId,
        ventaPronosticoData
      );
      invalidateDashboardCache({
        entity: 'venta',
        entityId: notifSeleccionada.ventaId,
      });
      await deleteNotificacionesPorVenta(notifSeleccionada.ventaId);
      fetchNotificaciones(true);

      void fetchVentas(true);

      setRenovarDialogOpen(false);

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
              window.open(
                base + encodeURIComponent(mensajeAEnviar),
                '_blank',
                'noopener,noreferrer'
              );
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

  const handleAcciones = (notif: NotificacionVentaConId) => {
    setNotifSeleccionada(notif);
    setAccionesDialogOpen(true);
  };

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

  const handleCortarFromModal = async (motivoCorte: string) => {
    if (!notifSeleccionada) return;

    try {
      await updateVenta(notifSeleccionada.ventaId, {
        estado: 'inactivo',
        cortadaAt: new Date(),
        motivoCorte,
      });

      await deleteNotificacionesPorVenta(notifSeleccionada.ventaId);
      fetchNotificaciones(true);

      invalidateDashboardCache({
        entity: 'venta',
        entityId: notifSeleccionada.ventaId,
      });

      toast.success('Venta cortada exitosamente');

      void fetchVentas(true);
    } catch (error) {
      console.error('Error cortando venta:', error);
      toast.error('Error al cortar la venta');
      throw error;
    }
  };

  return (
    <Card className="min-w-0 p-4 pb-2">
      <h3 className="text-xl font-semibold">Ventas próximas a vencer</h3>
      <VentasProximasToolbar
        searchQuery={searchQuery}
        estadoFilter={estadoFilter}
        onSearchChange={handleSearchChange}
        onEstadoFilterChange={handleEstadoFilterChange}
      />

      {ventasNotificaciones.length === 0 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No se encontraron notificaciones de ventas
          </p>
        </div>
      ) : (
        <div>
          <VentasProximasTableContent
            notificaciones={paginatedNotificaciones}
            visiblePasswords={visiblePasswords}
            onToggleLeida={toggleLeida}
            onCopyToClipboard={copyToClipboard}
            onTogglePasswordVisibility={togglePasswordVisibility}
            onNotificar={handleNotificar}
            onCancelar={handleCancelar}
            onAcciones={handleAcciones}
            onRenovar={handleRenovar}
          />

          <VentasProximasPagination
            itemsPerPage={itemsPerPage}
            safeCurrentPage={safeCurrentPage}
            totalPages={totalPages}
            onItemsPerPageChange={handleItemsPerPageChange}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
          />
        </div>
      )}

      <VentasProximasDialogs
        notifSeleccionada={notifSeleccionada}
        renovarDialogOpen={renovarDialogOpen}
        accionesDialogOpen={accionesDialogOpen}
        metodosPagoTerceros={metodosPagoTerceros}
        categoriaPlanes={categoriaPlanes}
        servicioTipoSeleccionado={servicioTipoSeleccionado}
        onRenovarOpenChange={setRenovarDialogOpen}
        onAccionesOpenChange={setAccionesDialogOpen}
        onConfirmRenovacion={handleConfirmRenovacion}
        onCortar={handleCortarFromModal}
        onResaltar={handleResaltar}
        onDescartar={handleDescartar}
      />
    </Card>
  );
}
