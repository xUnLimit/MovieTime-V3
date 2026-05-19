'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, ChevronDown, Scissors } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { fetchVentasByFiltersUseCase } from '@/lib/use-cases/ventas-use-cases';
import { rankServicios } from '@/lib/utils/servicioRanking';
import { cn } from '@/lib/utils';
import { calcularDiasRelativosCalendario } from '@/lib/utils/calculations';
import type { Servicio, VentaDoc } from '@/types';

export interface TransferSalePayload {
  servicio: Servicio;
  perfilNumero: number;
  perfilNombre: string;
  codigo: string;
  notificarWhatsApp: boolean;
}

interface CutVentaDialogProps {
  isSubmitting: boolean;
  open: boolean;
  venta: VentaDoc | null;
  onConfirm: (motivoCorte: string) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

interface TransferVentaDialogProps {
  isSubmitting: boolean;
  open: boolean;
  servicios: Servicio[];
  venta: VentaDoc | null;
  onConfirm: (payload: TransferSalePayload) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

function getVentaEstadoDisplay(venta: VentaDoc | null) {
  if (!venta) {
    return {
      className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
      text: '-',
    };
  }

  if ((venta.estado ?? 'activo') === 'inactivo') {
    return {
      className: 'border-orange-500/40 bg-orange-950/30 text-orange-400',
      text: 'Inactiva',
    };
  }

  const dias = venta.fechaFin ? calcularDiasRelativosCalendario(venta.fechaFin) : null;
  if (dias === null) {
    return {
      className: 'border-green-500/40 bg-green-950/30 text-green-400',
      text: 'Activa',
    };
  }
  if (dias < 0) {
    const d = Math.abs(dias);
    return {
      className: 'border-red-500/50 bg-red-950/30 text-red-400',
      text: `${d} dia${d !== 1 ? 's' : ''} vencida`,
    };
  }
  if (dias === 0) {
    return {
      className: 'border-red-500/50 bg-red-950/30 text-red-400',
      text: 'Vence hoy',
    };
  }
  if (dias <= 7) {
    return {
      className: 'border-yellow-500/50 bg-yellow-950/30 text-yellow-400',
      text: `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`,
    };
  }
  return {
    className: 'border-green-500/40 bg-green-950/30 text-green-400',
    text: `${dias} dias restantes`,
  };
}

export function CutVentaDialog({
  isSubmitting,
  onConfirm,
  onOpenChange,
  open,
  venta,
}: CutVentaDialogProps) {
  const [motivoCorte, setMotivoCorte] = useState('');

  const handleConfirm = async () => {
    const motivo = motivoCorte.trim();
    if (!motivo) return;
    await onConfirm(motivo);
  };
  const estado = getVentaEstadoDisplay(venta);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <div className="bg-muted/20 px-5 pb-4 pt-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <Scissors className="h-4 w-4 text-muted-foreground" />
              </span>
              Cortar — Venta
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-1.5 text-sm">
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{venta?.clienteNombre ?? 'Cliente'}</span>
            </div>
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Servicio</span>
              <span className="font-medium">{venta?.servicioNombre ?? 'Servicio'}</span>
            </div>
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant="outline" className={`w-fit text-xs font-normal ${estado.className}`}>
                {estado.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="motivo-corte">Motivo de corte</Label>
            <Textarea
              id="motivo-corte"
              value={motivoCorte}
              onChange={(event) => setMotivoCorte(event.target.value)}
              placeholder="Escribe el motivo del corte..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 px-5 pb-5 pt-0 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || motivoCorte.trim().length === 0}
            className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
          >
            {isSubmitting ? 'Cortando...' : 'Cortar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransferVentaDialog({
  isSubmitting,
  onConfirm,
  onOpenChange,
  open,
  servicios,
  venta,
}: TransferVentaDialogProps) {
  const [loadingVentasRanking, setLoadingVentasRanking] = useState(false);
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(false);
  const [servicioId, setServicioId] = useState('');
  const [ventasActivasPorServicio, setVentasActivasPorServicio] = useState<Record<string, VentaDoc[]>>({});

  const servicioOrigen = useMemo(
    () => servicios.find((servicio) => servicio.id === venta?.servicioId) ?? null,
    [servicios, venta?.servicioId],
  );

  const serviciosCandidatos = useMemo(
    () =>
      servicios
        .filter((servicio) => {
          if (!venta) return false;
          return (
            servicio.id !== venta.servicioId &&
            servicio.categoriaId === venta.categoriaId &&
            (!servicioOrigen?.tipo || servicio.tipo === servicioOrigen.tipo) &&
            servicio.activo &&
            !servicio.enReposo
          );
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [servicios, servicioOrigen?.tipo, venta],
  );

  const serviciosDestino = useMemo(
    () =>
      rankServicios(
        serviciosCandidatos,
        ventasActivasPorServicio,
        {
          planCicloPago: venta?.cicloPago ?? 'mensual',
          fechaInicio: venta?.fechaInicio ? new Date(venta.fechaInicio) : new Date(),
          fechaFin: venta?.fechaFin ? new Date(venta.fechaFin) : undefined,
        },
      ).filter((servicio) => {
        const ocupados =
          ventasActivasPorServicio[servicio.id]
            ?.map((item) => item.perfilNumero)
            .filter((numero): numero is number => numero != null).length ??
          servicio.perfilesOcupados ??
          0;
        return (servicio.perfilesDisponibles ?? 0) - ocupados > 0;
      }),
    [serviciosCandidatos, venta?.cicloPago, venta?.fechaFin, venta?.fechaInicio, ventasActivasPorServicio],
  );

  const selectedServicioId = servicioId || serviciosDestino[0]?.id || '';

  const servicioSeleccionado = useMemo(
    () => serviciosDestino.find((servicio) => servicio.id === selectedServicioId) ?? null,
    [selectedServicioId, serviciosDestino],
  );

  const selectedServicioVentas = useMemo(
    () => ventasActivasPorServicio[selectedServicioId] ?? [],
    [selectedServicioId, ventasActivasPorServicio],
  );

  const perfilNumeroDisponible = useMemo(() => {
    if (!servicioSeleccionado) return null;
    const occupiedProfiles = new Set(
      selectedServicioVentas
        .map((item) => item.perfilNumero)
        .filter((numero): numero is number => numero != null),
    );
    return Array.from(
      { length: Math.max(servicioSeleccionado.perfilesDisponibles, 0) },
      (_, index) => index + 1,
    ).find((numero) => !occupiedProfiles.has(numero)) ?? null;
  }, [selectedServicioVentas, servicioSeleccionado]);

  const getSlotsDisponibles = (servicio: Servicio) => {
    const ventas = ventasActivasPorServicio[servicio.id] ?? [];
    const ocupados = new Set(
      ventas
        .map((item) => item.perfilNumero)
        .filter((numero): numero is number => numero != null),
    ).size || servicio.perfilesOcupados || 0;
    return Math.max((servicio.perfilesDisponibles || 0) - ocupados, 0);
  };

  const getDisponiblesColorClass = (disponibles: number, total: number) => {
    if (total <= 0) return 'text-muted-foreground';
    const ratio = disponibles / total;
    if (ratio <= 0.25) return 'text-[#ff1744]';
    if (ratio <= 0.5) return 'text-[#ffea00]';
    return 'text-[#00ff85]';
  };

  useEffect(() => {
    if (!open || serviciosCandidatos.length === 0) return;

    let cancelled = false;
    const candidateIds = serviciosCandidatos.map((servicio) => servicio.id);
    const loadVentasRanking = async () => {
      setLoadingVentasRanking(true);
      try {
        const ventas = await fetchVentasByFiltersUseCase<VentaDoc>([
          { field: 'servicioId', operator: 'in', value: candidateIds },
          { field: 'estado', operator: '!=', value: 'inactivo' },
        ]);
        if (cancelled) return;
        const grouped: Record<string, VentaDoc[]> = Object.fromEntries(
          candidateIds.map((id) => [id, []]),
        );
        ventas.forEach((venta) => {
          if (grouped[venta.servicioId]) {
            grouped[venta.servicioId].push(venta);
          }
        });
        setVentasActivasPorServicio(grouped);
      } catch (error) {
        console.error('Error cargando ventas activas para transferencia:', error);
        if (!cancelled) setVentasActivasPorServicio({});
      } finally {
        if (!cancelled) setLoadingVentasRanking(false);
      }
    };

    loadVentasRanking();
    return () => {
      cancelled = true;
    };
  }, [open, serviciosCandidatos]);

  const handleConfirm = async () => {
    if (!servicioSeleccionado || !perfilNumeroDisponible) return;
    await onConfirm({
      servicio: servicioSeleccionado,
      perfilNumero: perfilNumeroDisponible,
      perfilNombre: venta?.perfilNombre?.trim() || `Perfil ${perfilNumeroDisponible}`,
      codigo: venta?.codigo?.trim() ?? '',
      notificarWhatsApp,
    });
  };
  const estado = getVentaEstadoDisplay(venta);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <div className="bg-muted/20 px-5 pb-4 pt-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              </span>
              Transferir — Venta
            </DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-1.5 text-sm">
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{venta?.clienteNombre ?? 'Cliente'}</span>
            </div>
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Servicio</span>
              <span className="font-medium">{venta?.servicioNombre ?? 'Servicio actual'}</span>
            </div>
            <div className="grid grid-cols-[56px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant="outline" className={`w-fit text-xs font-normal ${estado.className}`}>
                {estado.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label>Servicio destino</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="relative w-full justify-start pr-10 text-left"
                  disabled={serviciosDestino.length === 0 || loadingVentasRanking}
                >
                  <span className="min-w-0 truncate">
                    {loadingVentasRanking
                      ? 'Cargando servicios...'
                      : servicioSeleccionado
                        ? `${servicioSeleccionado.nombre} - ${servicioSeleccionado.correo}`
                        : 'Seleccionar servicio'}
                  </span>
                  <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
              >
                {serviciosDestino.map((servicio) => {
                  const disponibles = getSlotsDisponibles(servicio);
                  const totalPerfiles = servicio.perfilesDisponibles || 0;
                  return (
                    <DropdownMenuItem
                      key={servicio.id}
                      onClick={() => setServicioId(servicio.id)}
                      className={cn(
                        'group flex h-8 min-h-8 items-center gap-0 py-0 pr-1 leading-none',
                        servicio.id === selectedServicioId && 'bg-accent',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {servicio.nombre} - {servicio.correo}
                      </span>
                      <span className="w-[112px] shrink-0 whitespace-nowrap pr-1 text-right text-xs tabular-nums text-foreground">
                        <span
                          className={cn(
                            'font-extrabold',
                            getDisponiblesColorClass(disponibles, totalPerfiles),
                          )}
                        >
                          {disponibles}
                        </span>{' '}
                        Disponible{disponibles === 1 ? '' : 's'}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {serviciosDestino.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay otro servicio activo disponible en esta categoria.
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="notificar-transferencia-whatsapp">
                Notificar al cliente por WhatsApp
              </Label>
              <p className="text-xs text-muted-foreground">
                Prepara el mensaje con las credenciales del nuevo servicio.
              </p>
            </div>
            <Switch
              id="notificar-transferencia-whatsapp"
              checked={notificarWhatsApp}
              onCheckedChange={setNotificarWhatsApp}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 px-5 pb-5 pt-0 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              !servicioSeleccionado ||
              !perfilNumeroDisponible ||
              loadingVentasRanking
            }
            className="flex-1 bg-green-600 text-white hover:bg-green-700"
          >
            {isSubmitting ? 'Transfiriendo...' : 'Transferir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
