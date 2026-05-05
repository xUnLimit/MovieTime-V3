'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Lock,
  Monitor,
  Pencil,
  RefreshCw,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PagoDialog } from '@/components/shared/PagoDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { queryMetodosPago } from '@/lib/supabase/catalogos-repository';
import { getServicioById } from '@/lib/supabase/servicios-repository';
import { queryVentas } from '@/lib/supabase/ventas-repository';
import {
  deleteServicioPagoUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from '@/lib/use-cases/servicios-use-cases';
import { useCategoriasStore } from '@/store/categoriasStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { Servicio, Categoria, MetodoPago, VentaDoc, PagoServicio } from '@/types';
import { getVentasConUltimoPago } from '@/lib/services/ventaSyncService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrencySymbol } from '@/lib/constants';
import { calcularDiasRelativosCalendario, formatearFecha, formatearFechaHora, sumInUSD, formatAggregateInUSD } from '@/lib/utils/calculations';
import { usePagosServicio } from '@/hooks/use-pagos-servicio';
import { useNotificacionesStore } from '@/store/notificacionesStore';

interface PerfilVenta {
  ventaId?: string;
  clienteNombre?: string;
  createdAt?: Date;
  precioFinal?: number;
  descuento?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  notas?: string;
  servicioNombre?: string;
  servicioCorreo?: string;
  moneda?: string;
  perfilNombre?: string;
  codigo?: string;
  cicloPago?: string;
}

interface PagoFormData {
  periodoRenovacion: string;
  metodoPagoId: string;
  costo: number;
  descuento?: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string;
  metodoPagoNombre?: string;
  moneda?: string;
}

const PROFILES_PAGE_SIZE = 10;

function ServicioDetallePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const from = searchParams.get('from');

  const { deleteServicio, fetchCounts } = useServiciosStore();
  const { fetchCategorias } = useCategoriasStore();
  const { deleteNotificacionesPorServicio, fetchNotificaciones } = useNotificacionesStore();

  // Estados locales para los datos específicos de esta página
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePayments, setDeletePayments] = useState(false);
  const [deleteRenovacionDialogOpen, setDeleteRenovacionDialogOpen] = useState(false);
  const [pagoToDelete, setPagoToDelete] = useState<PagoServicio | null>(null);
  const [editarPagoDialogOpen, setEditarPagoDialogOpen] = useState(false);
  const [pagoToEdit, setPagoToEdit] = useState<PagoServicio | null>(null);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [ventasServicio, setVentasServicio] = useState<Array<PerfilVenta & { perfilNumero?: number | null }>>([]);
  const [expandedProfileNumber, setExpandedProfileNumber] = useState<number | null>(null);
  const [profilePage, setProfilePage] = useState(0);
  const [profileSearch, setProfileSearch] = useState('');

  // Usar el hook para cargar pagos (con cache)
  const { pagos: pagosServicio, isLoading: pagosHistorialLoading, renovaciones, refresh: refreshPagos } = usePagosServicio(id);

  // Cargar solo el servicio (1 lectura única)
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setIsLoadingData(true);
      try {
        // 1. Cargar el servicio (categoriaNombre ya está denormalizado)
        const servicioData = await getServicioById<Servicio>(id);
        if (!servicioData) {
          toast.error('Servicio no encontrado', { description: 'No se encontró el servicio con el ID proporcionado.' });
          setServicio(null);
          return;
        }
        setServicio(servicioData);

        // 2. Crear objeto de categoría sintético desde datos denormalizados
        setCategoria({
          id: servicioData.categoriaId,
          nombre: servicioData.categoriaNombre,
        } as Categoria);

        // 3. Crear objeto sintético de metodoPago desde datos denormalizados
        if (servicioData.metodoPagoId) {
          setMetodoPago({
            id: servicioData.metodoPagoId,
            nombre: servicioData.metodoPagoNombre || '',
            moneda: servicioData.moneda || 'USD',
          } as MetodoPago);
        }

        // Nota: metodosPago (para dropdown) se carga en lazy load al abrir diálogo de renovación
      } catch (error) {
        console.error('Error cargando datos del servicio:', error);
        toast.error('Error al cargar el servicio', { description: 'Ocurrió un problema al obtener los datos. Intenta nuevamente.' });
        setServicio(null);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    const loadVentas = async () => {
      if (!id) return;
      try {
        // Fase 1: Cargar ventas base inmediatamente (clienteNombre ya está denormalizado en VentaDoc)
        const ventasBase = await queryVentas<VentaDoc>([
          { field: 'servicioId', operator: '==', value: id },
        ]);

        const ventasActivas = ventasBase.filter((v) => (v.estado ?? 'activo') !== 'inactivo');

        // Mostrar perfiles de inmediato con los datos básicos de VentaDoc
        setVentasServicio(ventasActivas.map((venta) => ({
          ventaId: venta.id || undefined,
          perfilNumero: venta.perfilNumero ?? null,
          clienteNombre: venta.clienteNombre || undefined,
          createdAt: venta.createdAt,
          precioFinal: 0,
          descuento: 0,
          fechaInicio: venta.fechaInicio ?? undefined,
          fechaFin: venta.fechaFin ?? undefined,
          notas: venta.notas || '',
          servicioNombre: venta.servicioNombre,
          servicioCorreo: venta.servicioCorreo || '',
          moneda: venta.moneda || undefined,
          perfilNombre: venta.perfilNombre || undefined,
          codigo: venta.codigo || undefined,
          cicloPago: venta.cicloPago || undefined,
        })));

        // Fase 2: Enriquecer con datos de pagos en background (precio, fechas actualizadas)
        getVentasConUltimoPago(ventasActivas).then((ventasConDatos) => {
          setVentasServicio(ventasConDatos.map((venta) => ({
            ventaId: venta.id || undefined,
            perfilNumero: venta.perfilNumero ?? null,
            clienteNombre: venta.clienteNombre || undefined,
            createdAt: venta.createdAt,
            precioFinal: venta.precioFinal ?? venta.precio ?? 0,
            descuento: venta.descuento ?? 0,
            fechaInicio: venta.fechaInicio ?? undefined,
            fechaFin: venta.fechaFin ?? undefined,
            notas: venta.notas || '',
            servicioNombre: venta.servicioNombre,
            servicioCorreo: venta.servicioCorreo || '',
            moneda: venta.moneda || undefined,
            perfilNombre: venta.perfilNombre || undefined,
            codigo: venta.codigo || undefined,
            cicloPago: venta.cicloPago || undefined,
          })));
        }).catch(() => {/* datos básicos ya están visibles, ignorar error de enriquecimiento */});

      } catch (error) {
        console.error('Error cargando ventas del servicio:', error);
        toast.error('Error cargando ventas del servicio', { description: error instanceof Error ? error.message : undefined });
        setVentasServicio([]);
      }
    };

    loadVentas();
  }, [id]);

  const handleDelete = () => {
    setDeletePayments(false);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteServicio(id, deletePayments);
      if (deletePayments) {
        toast.success('Servicio eliminado', { description: 'El servicio y todos sus registros de pago han sido eliminados.' });
      } else {
        toast.success('Servicio eliminado', { description: 'El servicio fue eliminado. Los registros de pago se conservaron.' });
      }

      // Refrescar categorías y contadores de servicios para actualizar widgets
      await Promise.all([
        fetchCategorias(true),
        fetchCounts(true),
      ]);

      router.push('/servicios');
    } catch (error) {
      toast.error('Error al eliminar servicio', { description: error instanceof Error ? error.message : undefined });
    }
  };

  // Lazy load de métodos de pago (solo cuando se necesita renovar)
  const loadMetodosPagoIfNeeded = async () => {
    if (metodosPago.length > 0) return; // Ya están cargados
    try {
      const methods = await queryMetodosPago<MetodoPago>([
        { field: 'asociadoA', operator: '==', value: 'servicio' }
      ]);
      setMetodosPago(methods);
    } catch (error) {
      console.error('Error cargando métodos de pago:', error);
      setMetodosPago([]);
    }
  };

  const handleRenovar = async () => {
    await loadMetodosPagoIfNeeded();
    setRenovarDialogOpen(true);
  };

  const handleDeleteRenovacion = (pago: PagoServicio) => {
    setPagoToDelete(pago);
    setDeleteRenovacionDialogOpen(true);
  };

  const handleEditarPago = async (pago: PagoServicio) => {
    await loadMetodosPagoIfNeeded();
    setPagoToEdit(pago);
    setEditarPagoDialogOpen(true);
  };

  const handleConfirmEditarPago = async (data: PagoFormData) => {
    if (!pagoToEdit || !servicio) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find((m) => m.id === data.metodoPagoId);
      const esUltimoPago = pagosOrdenados[0]?.id === pagoToEdit.id;
      const { servicioActualizado } = await updateServicioPagoUseCase(servicio, pagoToEdit, data, {
        metodoPago: metodoPagoSeleccionado,
        isLatestPayment: esUltimoPago,
      });

      if (servicioActualizado) setServicio(servicioActualizado);

      refreshPagos();
      toast.success('Pago actualizado', { description: 'Los datos del pago han sido actualizados correctamente.' });
      setPagoToEdit(null);
      setEditarPagoDialogOpen(false);
    } catch (error) {
      console.error('Error al actualizar pago:', error);
      toast.error('Error al actualizar pago', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleConfirmDeleteRenovacion = async () => {
    if (!pagoToDelete || !servicio) return;
    const eraUltimaRenovacion = pagosOrdenados[0]?.id === pagoToDelete.id;

    try {
      const pagosActualizados = pagosServicio.filter(p => p.id !== pagoToDelete.id);
      const { servicioActualizado } = await deleteServicioPagoUseCase(servicio, pagoToDelete, pagosActualizados, {
        isLatestPayment: eraUltimaRenovacion,
        fallbackMoneda: metodoPago?.moneda,
      });
      refreshPagos();
      if (eraUltimaRenovacion) {
        if (servicioActualizado) setServicio(servicioActualizado);
      }
      toast.success('Renovación eliminada', { description: 'El registro de pago ha sido eliminado del historial.' });
      setPagoToDelete(null);
    } catch (error) {
      console.error('Error al eliminar renovación:', error);
      toast.error('Error al eliminar renovación', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleConfirmRenovacion = async (data: PagoFormData) => {
    if (!servicio) return;
    try {
      const metodoPagoSeleccionado = metodosPago.find((m) => m.id === data.metodoPagoId);
      const { servicioActualizado } = await renewServicioUseCase(servicio, data, {
        numeroRenovacion: renovaciones + 1,
        metodoPago: metodoPagoSeleccionado,
      });

      // Invalidate dashboard cache so it re-fetches on next visit
      import('@/store/dashboardStore').then(({ useDashboardStore }) => {
        useDashboardStore.getState().invalidateCache();
      }).catch(() => {});

      setServicio(servicioActualizado);

      refreshPagos();

      // Remove notification and refresh store
      await deleteNotificacionesPorServicio(id);
      fetchNotificaciones(true);
      // Refresh categorias so Servicios module reflects updated gastosTotal
      import('@/store/categoriasStore').then(({ useCategoriasStore }) => {
        useCategoriasStore.getState().fetchCategorias(true);
      }).catch(() => {});

      toast.success('Renovación registrada', { description: 'El nuevo período de pago se ha registrado correctamente.' });
      setRenovarDialogOpen(false);
    } catch (error) {
      console.error('Error al registrar la renovación:', error);
      toast.error('Error al registrar la renovación', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const getCicloPagoLabel = (ciclo: string) => {
    const labels: Record<string, string> = {
      mensual: 'Mensual',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual',
    };
    return labels[ciclo] || ciclo;
  };

  const currencySymbol = getCurrencySymbol(metodoPago?.moneda);

  const [totalGastadoUSD, setTotalGastadoUSD] = useState<number>(0);
  const [isCalculatingTotal, setIsCalculatingTotal] = useState(false);

  useEffect(() => {
    const calculateTotal = async () => {
      setIsCalculatingTotal(true);
      try {
        const total = await sumInUSD(
          pagosServicio.map(p => ({ monto: p.monto, moneda: p.moneda || 'USD' }))
        );
        setTotalGastadoUSD(total);
      } catch (error) {
        console.error('[ServicioDetail] Error calculating total:', error);
        setTotalGastadoUSD(0);
      } finally {
        setIsCalculatingTotal(false);
      }
    };
    calculateTotal();
  }, [pagosServicio]);

  const pagosOrdenados = useMemo(() => {
    return [...pagosServicio].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pagosServicio]);

  const ventasPorPerfil = useMemo(() => {
    const map = new Map<number, PerfilVenta>();
    ventasServicio.forEach((venta) => {
      if (!venta.perfilNumero) return;
      const existing = map.get(venta.perfilNumero);
      const entry: PerfilVenta = {
        ventaId: venta.ventaId,
        clienteNombre: venta.clienteNombre,
        createdAt: venta.createdAt,
        precioFinal: venta.precioFinal,
        descuento: venta.descuento,
        fechaInicio: venta.fechaInicio,
        fechaFin: venta.fechaFin,
        notas: venta.notas,
        servicioNombre: venta.servicioNombre,
        servicioCorreo: venta.servicioCorreo,
        moneda: venta.moneda,
        perfilNombre: venta.perfilNombre,
        codigo: venta.codigo,
        cicloPago: venta.cicloPago,
      };
      if (!existing) {
        map.set(venta.perfilNumero, entry);
        return;
      }
      const existingDate = existing.createdAt?.getTime() ?? 0;
      const nextDate = venta.createdAt?.getTime() ?? 0;
      if (nextDate >= existingDate) {
        map.set(venta.perfilNumero, entry);
      }
    });
    return map;
  }, [ventasServicio]);

  const perfilesArray = useMemo(
    () =>
      Array.from({ length: servicio?.perfilesDisponibles ?? 0 }, (_, i) => {
        const numero = i + 1;
        const venta = ventasPorPerfil.get(numero);
        const estado = !servicio?.activo ? 'inactivo' : (venta ? 'ocupado' : 'disponible');
        return {
          numero,
          nombre: `Perfil ${numero}`,
          estado,
          clienteNombre: venta?.clienteNombre,
          venta,
        };
      }),
    [servicio?.activo, servicio?.perfilesDisponibles, ventasPorPerfil]
  );
  const perfilesEnUso = perfilesArray.filter((p: { estado: string }) => p.estado === 'ocupado').length;
  const perfilesDisponibles = (servicio?.perfilesDisponibles ?? 0) - perfilesEnUso;
  const showProfileControls = (servicio?.perfilesDisponibles ?? 0) > PROFILES_PAGE_SIZE;
  const normalizedProfileSearch = showProfileControls ? profileSearch.trim().toLowerCase() : '';
  const filteredPerfiles = useMemo(
    () =>
      perfilesArray.filter((perfil) => {
        if (!normalizedProfileSearch) return true;
        const persona = (perfil.clienteNombre || '').toLowerCase();
        const perfilLabel = perfil.nombre.toLowerCase();
        return persona.includes(normalizedProfileSearch) || perfilLabel.includes(normalizedProfileSearch);
      }),
    [normalizedProfileSearch, perfilesArray]
  );
  const profilePageCount = Math.max(Math.ceil(filteredPerfiles.length / PROFILES_PAGE_SIZE), 1);
  const visiblePerfiles = useMemo(() => {
    if (!showProfileControls) return filteredPerfiles;
    const start = profilePage * PROFILES_PAGE_SIZE;
    return filteredPerfiles.slice(start, start + PROFILES_PAGE_SIZE);
  }, [filteredPerfiles, profilePage, showProfileControls]);
  const visibleProfileNumbers = useMemo(
    () => visiblePerfiles.map((perfil) => perfil.numero),
    [visiblePerfiles]
  );

  useEffect(() => {
    if (!showProfileControls) return;
    setProfilePage((prev) => Math.min(prev, Math.max(profilePageCount - 1, 0)));
  }, [profilePageCount, showProfileControls]);

  useEffect(() => {
    if (!showProfileControls) {
      setProfilePage(0);
      setProfileSearch('');
    }
  }, [showProfileControls]);

  useEffect(() => {
    if (expandedProfileNumber === null) return;
    if (!visibleProfileNumbers.includes(expandedProfileNumber)) {
      setExpandedProfileNumber(null);
    }
  }, [expandedProfileNumber, visibleProfileNumbers]);

  const toggleProfile = (profileNumber: number) => {
    setExpandedProfileNumber((prev) => (prev === profileNumber ? null : profileNumber));
  };

  // Estado de carga
  if (isLoadingData) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cargando servicio...</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            {' / '}
            <Link href="/servicios" className="hover:text-foreground transition-colors">Servicios</Link>
            {' / '}
            <span className="text-foreground">Detalles</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-muted-foreground">Cargando datos del servicio...</p>
        </div>
      </div>
    );
  }

  if (!servicio) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Servicio no encontrado</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link href="/servicios" className="hover:text-foreground transition-colors">
              Servicios
            </Link>{' '}
            / <span className="text-foreground">Detalles</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-muted-foreground">No se encontró el servicio con el ID proporcionado.</p>
          <Link href="/servicios" className="inline-block mt-4 text-primary hover:underline">
            Volver a Servicios
          </Link>
        </div>
      </div>
    );
  }

  const returnToServicios = (() => {
    if (from && from.startsWith('/servicios/')) return from;
    if (servicio?.categoriaId) return `/servicios/${servicio.categoriaId}`;
    return '/servicios';
  })();

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href={returnToServicios}>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Servicio: {servicio.nombre}</h1>
              <p className="text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
                {' / '}
                <Link href="/servicios" className="hover:text-foreground transition-colors">
                  Servicios
                </Link>
                {' / '}
                <Link href={`/servicios/${servicio.categoriaId}`} className="hover:text-foreground transition-colors">
                  {categoria?.nombre || 'Categoría'}
                </Link>
                {' / '}
                <span className="text-foreground">Detalles</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={handleRenovar} className="bg-purple-600 hover:bg-purple-700">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Renovar
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/servicios/${id}/editar?from=${encodeURIComponent(`/servicios/detalle/${id}`)}`}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[380px_1fr]">
          {/* Left Column - Service Info */}
          <div className="space-y-4">
            {/* Service Card */}
            <Card className="p-6">
              <div className="flex flex-col items-center space-y-4">
                {/* Service Icon */}
                <div className="w-32 h-32 flex items-center justify-center">
                  <Monitor className="h-16 w-16 text-muted-foreground" />
                </div>

                {/* Service Info */}
                <div className="w-full space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-muted-foreground mt-0.5">Categoría</span>
                    <span className="text-sm font-medium ml-auto text-right">{categoria?.nombre || 'Sin categoría'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-muted-foreground">Costo</span>
                    <span className="text-sm font-medium ml-auto text-right">{currencySymbol} {(servicio.costoServicio || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-muted-foreground">Ciclo de Facturación</span>
                    <span className="text-sm font-medium ml-auto text-right">{getCicloPagoLabel(servicio.cicloPago ?? '')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-muted-foreground mt-0.5">Fecha de Inicio</span>
                    <Badge variant="outline" className="ml-auto font-normal text-sm bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30 [a&]:hover:bg-green-200 dark:[a&]:hover:bg-green-500/30">
                      {servicio.fechaInicio ? formatearFecha(new Date(servicio.fechaInicio)) : '-'}
                    </Badge>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-muted-foreground mt-0.5">Fecha de Vencimiento</span>
                    <Badge variant="outline" className="ml-auto font-normal text-sm bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30 [a&]:hover:bg-green-200 dark:[a&]:hover:bg-green-500/30">
                      {servicio.fechaVencimiento ? formatearFecha(new Date(servicio.fechaVencimiento)) : '-'}
                    </Badge>
                  </div>
                  {servicio.fechaVencimiento && (() => {
                    const dias = calcularDiasRelativosCalendario(servicio.fechaVencimiento);
                    if (dias === null) return null;
                    let badgeClass: string;
                    let texto: string;
                    if (dias < 0) {
                      badgeClass = 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                      texto = `${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''} de retraso`;
                    } else if (dias === 0) {
                      badgeClass = 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                      texto = 'Vence hoy';
                    } else if (dias <= 7) {
                      badgeClass = 'border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300';
                      texto = `${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`;
                    } else {
                      badgeClass = 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
                      texto = `${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`;
                    }
                    return (
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground mt-0.5">Días Restantes</span>
                        <Badge variant="outline" className={`ml-auto font-normal text-sm ${badgeClass}`}>
                          {texto}
                        </Badge>
                      </div>
                    );
                  })()}
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-muted-foreground mt-0.5">Método de Pago</span>
                    <span className="text-sm font-medium ml-auto text-right text-purple-600">{metodoPago?.nombre || 'Sin método'}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Additional Info Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-0.5">Información Adicional</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {servicio.correo || 'Sin especificar'}
                    {servicio.correo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(servicio.correo!);
                          toast.success('Email copiado', { description: 'El email se ha copiado al portapapeles.' });
                        }}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Contraseña</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {servicio.contrasena || 'Sin especificar'}
                    {servicio.contrasena && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(servicio.contrasena!);
                          toast.success('Contraseña copiada', { description: 'La contraseña se ha copiado al portapapeles.' });
                        }}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Creado:</p>
                  <p className="text-sm">{formatearFechaHora(new Date(servicio.createdAt))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Última Actualización:</p>
                  <p className="text-sm">{formatearFechaHora(new Date(servicio.updatedAt))}</p>
                </div>
              </div>
            </Card>

            {/* Notes Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Notas</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {servicio.notas || 'Sin notas'}
              </p>
            </Card>
          </div>

          {/* Right Column - Profiles */}
          <div className="space-y-4">
            {/* Profiles Card */}
            <Card
              className="h-full p-6"
            >
              <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Perfiles</h2>
                  <p className="text-sm text-muted-foreground">
                    {servicio.activo ? `${perfilesDisponibles} de ${servicio.perfilesDisponibles} perfiles disponibles` : 'Servicio inactivo'}
                  </p>
                </div>
                {showProfileControls && (
                  <div className="w-full sm:w-64">
                    <Input
                      value={profileSearch}
                      onChange={(event) => {
                        setProfileSearch(event.target.value);
                        setProfilePage(0);
                      }}
                      placeholder="Buscar persona..."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {visiblePerfiles.map((perfil) => {
                  const venta = perfil.venta;
                  const ventaCurrency = getCurrencySymbol(venta?.moneda || metodoPago?.moneda);
                  const diasRestantes = venta?.fechaFin
                    ? calcularDiasRelativosCalendario(venta.fechaFin)
                    : null;
                  return (
                  <div
                    key={perfil.numero}
                    className={`rounded-lg border px-4 py-3 ${
                      perfil.estado === 'ocupado' ? 'bg-green-950/30 border-green-900/50' :
                      perfil.estado === 'inactivo' ? 'bg-muted/30 border-muted opacity-50' :
                      'bg-muted/50 border-border'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => perfil.estado === 'ocupado' && toggleProfile(perfil.numero)}
                      className="w-full flex items-center justify-between"
                      disabled={perfil.estado === 'inactivo'}
                    >
                      <div className="flex items-center gap-3">
                        <User className={`h-5 w-5 ${
                          perfil.estado === 'ocupado' ? 'text-green-500' :
                          perfil.estado === 'inactivo' ? 'text-gray-600' :
                          'text-blue-500'
                        }`} />
                        <span className={`font-medium ${perfil.estado === 'inactivo' ? 'text-gray-600' : ''}`}>
                          {perfil.estado === 'ocupado' && perfil.clienteNombre
                            ? perfil.clienteNombre
                            : perfil.nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {perfil.estado === 'inactivo' ? (
                          <Badge variant="secondary" className="bg-gray-200 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-700">
                            Inactivo
                          </Badge>
                        ) : perfil.estado === 'disponible' ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-600 dark:text-white dark:hover:bg-green-700">
                            Disponible
                          </Badge>
                        ) : (
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedProfileNumber === perfil.numero ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </button>

                    {perfil.estado === 'ocupado' && expandedProfileNumber === perfil.numero && venta && (
                      <div className="mt-4 space-y-3">
                        <div className="pt-3 border-t border-border">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-muted-foreground">Detalles de la venta:</p>
                            {venta.ventaId && (
                              <Link href={`/ventas/${venta.ventaId}`}>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Ver venta
                                </Button>
                              </Link>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                            {/* Columna 1: Cliente, Precio, Descuento */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium truncate">{venta.clienteNombre || 'Sin cliente'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">{ventaCurrency} {(venta.precioFinal ?? 0).toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Desc: {(venta.descuento ?? 0).toFixed(2)}%</span>
                              </div>
                            </div>
                            {/* Columna 2: Ciclo, Inicio, Vence */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">Ciclo:</span>
                                <span className="font-medium">{venta.cicloPago ? getCicloPagoLabel(venta.cicloPago) : '-'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">
                                  Inicio: {venta.fechaInicio ? format(new Date(venta.fechaInicio), 'd MMM yyyy', { locale: es }) : '-'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">
                                  Vence: {venta.fechaFin ? format(new Date(venta.fechaFin), 'd MMM yyyy', { locale: es }) : '-'}
                                </span>
                              </div>
                            </div>
                            {/* Columna 3: Perfil, Código, Días restantes */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">Perfil:</span>
                                <span className="font-medium truncate">{venta.perfilNombre || '-'}</span>
                              </div>
                              {venta.codigo && (
                                <div className="flex items-center gap-2">
                                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground">Código:</span>
                                  <span className="font-medium select-all">{venta.codigo}</span>
                                </div>
                              )}
                              {diasRestantes !== null && (() => {
                                let badgeClass: string;
                                let badgeText: string;
                                if (diasRestantes < 0) {
                                  const d = Math.abs(diasRestantes);
                                  badgeClass = 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                                  badgeText = `${d} día${d > 1 ? 's' : ''} de retraso`;
                                } else if (diasRestantes === 0) {
                                  badgeClass = 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                                  badgeText = 'Vence hoy';
                                } else if (diasRestantes <= 7) {
                                  badgeClass = 'border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300';
                                  badgeText = `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`;
                                } else {
                                  badgeClass = 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
                                  badgeText = `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`;
                                }
                                return (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={badgeClass}>
                                      {badgeText}
                                    </Badge>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-neutral-800 bg-black p-3">
                          <p className="text-sm text-muted-foreground mb-2">Notas de la venta:</p>
                          <div className="text-sm whitespace-pre-line">
                            {venta.notas ? venta.notas : 'Sin notas'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )})}
              </div>

              <div className="mt-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-600"></div>
                    <span className="text-muted-foreground">En uso</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-muted-foreground">Disponible</span>
                  </div>
                  {!servicio.activo && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                      <span className="text-muted-foreground">Inactivo</span>
                    </div>
                  )}
                </div>
                {showProfileControls ? (
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-muted-foreground mr-2">
                      Pagina {Math.min(profilePage + 1, profilePageCount)} de {profilePageCount}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={() => setProfilePage((prev) => Math.max(prev - 1, 0))}
                      disabled={profilePage === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={() => setProfilePage((prev) => Math.min(prev + 1, profilePageCount - 1))}
                      disabled={profilePage >= profilePageCount - 1}
                    >
                      Siguiente
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground" />
                )}
              </div>
            </Card>

            {/* Payment History Card */}
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Historial de pagos del servicio</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b text-sm text-muted-foreground">
                      <th className="text-left py-3 font-medium">Fecha</th>
                      <th className="text-left py-3 font-medium">Descripción</th>
                      <th className="text-left py-3 font-medium">Ciclo de facturación</th>
                      <th className="text-left py-3 font-medium">Fecha de Inicio</th>
                      <th className="text-left py-3 font-medium">Fecha de Vencimiento</th>
                      <th className="text-left py-3 font-medium">Monto</th>
                      <th className="text-center py-3 font-medium w-[10%]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagosHistorialLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                          Cargando historial de pagos...
                        </td>
                      </tr>
                    ) : (
                      <>
                    {pagosOrdenados.map((pago) => {
                      const esInicial = pago.isPagoInicial || pago.descripcion === 'Pago inicial';
                      const pagoMetodo = pago.metodoPagoId
                        ? metodosPago.find((m) => m.id === pago.metodoPagoId)
                        : undefined;
                      const pagoCurrency = getCurrencySymbol(pago.moneda || pagoMetodo?.moneda || metodoPago?.moneda);
                      return (
                        <tr key={pago.id} className="border-b text-sm">
                            <td className="py-3">
                              {format(new Date(pago.fecha), 'd MMM yyyy', { locale: es })}
                            </td>
                            <td className="py-3">{pago.descripcion}</td>
                            <td className="py-3">
                              {getCicloPagoLabel(pago.cicloPago ?? '') || '-'}
                            </td>
                            <td className="py-3">
                              {format(new Date(pago.fechaInicio), 'd MMM yyyy', { locale: es })}
                            </td>
                            <td className="py-3">
                              {format(new Date(pago.fechaVencimiento), 'd MMM yyyy', { locale: es })}
                            </td>
                            <td className="py-3 text-left">
                              {pagoCurrency} {pago.monto.toFixed(2)}
                            </td>
                            <td className="py-3 text-center">
                              {pago.id === pagosOrdenados[0]?.id && !esInicial ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <span className="text-lg">...</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center">
                                    <DropdownMenuItem onClick={() => handleEditarPago(pago)}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteRenovacion(pago)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <div className="h-8 flex items-center justify-center text-muted-foreground">-</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-4 border-t -mx-6 px-6">
                <div className="flex justify-end items-center mt-2">
                  <span className="text-sm text-muted-foreground mr-2">Total Gastado:</span>
                  <span className="text-lg font-semibold text-purple-600">
                    {isCalculatingTotal ? (
                      <span className="text-xs">Calculando...</span>
                    ) : (
                      formatAggregateInUSD(totalGastadoUSD)
                    )}
                  </span>
                </div>
              </div>
            </Card>
          </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletePayments(false);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar Servicio"
        description={`¿Estás seguro de que quieres eliminar el servicio "${servicio.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      >
        <div className="flex items-start space-x-2 py-2">
          <Checkbox
            id="delete-payments-detalle"
            checked={deletePayments}
            onCheckedChange={(checked) => setDeletePayments(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label
              htmlFor="delete-payments-detalle"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Eliminar también los registros de pago
            </Label>
            <p className="text-sm text-muted-foreground">
              Al marcar esta opción, se eliminarán todos los registros de pago de la base de datos. Si no se marca, se conservarán para historial.
            </p>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteRenovacionDialogOpen}
        onOpenChange={(open) => {
          setDeleteRenovacionDialogOpen(open);
          if (!open) setPagoToDelete(null);
        }}
        onConfirm={handleConfirmDeleteRenovacion}
        title="Eliminar renovación"
        description={pagoToDelete ? `¿Eliminar "${pagoToDelete.descripcion}" del historial? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        variant="danger"
      />

      <PagoDialog
        context="servicio"
        mode="renew"
        open={renovarDialogOpen}
        onOpenChange={setRenovarDialogOpen}
        servicio={servicio}
        metodosPago={metodosPago}
        categoriaPlanes={categoria?.planes}
        tipoPlan={servicio?.tipo}
        onConfirm={handleConfirmRenovacion}
      />

      <PagoDialog
        context="servicio"
        mode="edit"
        open={editarPagoDialogOpen}
        onOpenChange={(open) => {
          setEditarPagoDialogOpen(open);
          if (!open) setPagoToEdit(null);
        }}
        pago={pagoToEdit}
        servicio={servicio}
        metodosPago={metodosPago}
        categoriaPlanes={categoria?.planes}
        tipoPlan={servicio?.tipo}
        onConfirm={handleConfirmEditarPago}
      />
    </>
  );
}

export default function ServicioDetallePage() {
  return (
    <ModuleErrorBoundary moduleName="Detalle de Servicio">
      <ServicioDetallePageContent />
    </ModuleErrorBoundary>
  );
}
