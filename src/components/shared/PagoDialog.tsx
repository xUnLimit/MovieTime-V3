'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronDown, Pencil, RefreshCw, MessageCircle } from 'lucide-react';
import { addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MetodoPago, PagoServicio, Servicio } from '@/types';
import { Plan } from '@/types/categorias';
import { getCurrencySymbol } from '@/lib/constants';
import { calculateDiscountedAmount, formatearFecha, roundToDecimals } from '@/lib/utils/calculations';
import { generarMensajeVenta } from '@/lib/utils/whatsapp';
import { useTemplatesStore } from '@/store/templatesStore';
import {
  getUsuarioMetodoPagoMoneda,
  getUsuarioMetodoPagoNombre,
  isPendingUserPaymentMethodId,
  PENDING_USER_PAYMENT_ID,
  withPendingUserPaymentMethod,
} from '@/lib/utils/usuarioMetodoPago';
import { getServicioMetodoPagoNombre } from '@/lib/utils/servicioMetodoPago';

const pagoDialogSchema = z.object({
  periodoRenovacion: z
    .string()
    .refine((v) => ['mensual', 'trimestral', 'semestral', 'anual'].includes(v), {
      message: 'Seleccione el ciclo de facturación',
    }),
  metodoPagoId: z.string().min(1, 'El método de pago es requerido'),
  costo: z.number().min(0, 'El costo debe ser mayor a 0'),
  descuento: z.number().min(0).max(100).optional(),
  fechaInicio: z.date(),
  fechaVencimiento: z.date(),
  notas: z.string().optional(),
  notificarWhatsApp: z.boolean().optional(),
});

type PagoDialogFormData = z.infer<typeof pagoDialogSchema>;

export type EnrichedPagoDialogFormData = PagoDialogFormData & {
  metodoPagoNombre?: string;
  moneda?: string;
  mensajeWhatsApp?: string;
};

type PagoDialogMode = 'edit' | 'renew';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metodosPago: MetodoPago[];
  mode: PagoDialogMode;
  onConfirm: (data: EnrichedPagoDialogFormData) => void;
  categoriaPlanes?: Plan[];
  tipoPlan?: Plan['tipoPlan'];
  clienteNombre?: string;
  clienteSoloNombre?: string;
  servicioNombre?: string;
  categoriaNombre?: string;
  perfilNombre?: string;
  correo?: string;
  contrasena?: string;
  codigo?: string;
}

interface VentaDialogProps extends BaseProps {
  context: 'venta';
  venta: {
    clienteNombre: string;
    metodoPagoId?: string;
    precioFinal: number;
    fechaFin: Date;
    notas?: string;
  };
  pago?: {
    id?: string; // ID del pago (para editar)
    descripcion?: string; // Descripción del pago (para logs)
    metodoPagoId?: string | null;
    cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual' | null;
    precio: number;
    descuento?: number | null;
    fechaInicio?: Date | null;
    fechaVencimiento?: Date | null;
    notas?: string | null;
  } | null;
}

interface ServicioDialogProps extends BaseProps {
  context: 'servicio';
  servicio: Servicio;
  pago?: PagoServicio | null;
}

type PagoDialogProps = VentaDialogProps | ServicioDialogProps;

export function PagoDialog(props: PagoDialogProps) {
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaVencimientoOpen, setFechaVencimientoOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [isCostoFocused, setIsCostoFocused] = useState(false);
  const [isDescuentoFocused, setIsDescuentoFocused] = useState(false);
  const [costoInput, setCostoInput] = useState('');
  const [descuentoInput, setDescuentoInput] = useState('');
  const isVenta = props.context === 'venta';
  const isEdit = props.mode === 'edit';
  const venta = props.context === 'venta' ? props.venta : null;
  const servicio = props.context === 'servicio' ? props.servicio : null;
  const pago = props.pago ?? null;
  const { metodosPago } = props;
  const { getTemplateByTipo } = useTemplatesStore();
  const getPrecioPorCiclo = (ciclo?: Plan['cicloPago']) => {
    if (!ciclo || !props.categoriaPlanes?.length) return null;
    const match = props.categoriaPlanes.find((plan) =>
      plan.cicloPago === ciclo && (!props.tipoPlan || plan.tipoPlan === props.tipoPlan)
    );
    return match?.precio ?? null;
  };

  const defaultMetodoPagoId = isVenta
    ? (venta?.metodoPagoId || PENDING_USER_PAYMENT_ID)
    : (servicio?.metodoPagoId || '');
  const defaultCosto = venta
    ? (props.mode === 'renew' ? roundToDecimals(venta.precioFinal || 0) : 0)
    : (props.mode === 'renew' ? roundToDecimals(servicio?.costoServicio || 0) : 0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<PagoDialogFormData>({
    resolver: zodResolver(pagoDialogSchema),
    defaultValues: {
      periodoRenovacion: '',
      metodoPagoId: defaultMetodoPagoId,
      costo: defaultCosto,
      descuento: 0,
      fechaInicio: new Date(),
      fechaVencimiento: new Date(),
      notas: '',
      notificarWhatsApp: false,
    },
  });

  const periodoValue = watch('periodoRenovacion');
  const metodoPagoIdValue = watch('metodoPagoId');
  const notificarWhatsAppValue = watch('notificarWhatsApp');
  const costoValue = watch('costo');
  const descuentoValue = watch('descuento');
  const fechaInicioValue = watch('fechaInicio');
  const fechaVencimientoValue = watch('fechaVencimiento');
  const notasValue = watch('notas');

  // Sincronizar inputs locales con valores del formulario cuando cambian externamente (ej: dropdown de ciclo)
  useEffect(() => {
    if (!isCostoFocused) {
      setCostoInput(costoValue !== undefined ? costoValue.toString() : '');
    }
  }, [costoValue, isCostoFocused]);

  useEffect(() => {
    if (!isDescuentoFocused) {
      setDescuentoInput(descuentoValue !== undefined ? descuentoValue.toString() : '');
    }
  }, [descuentoValue, isDescuentoFocused]);

  const metodosFiltrados = useMemo(() => {
    const metodosBase = metodosPago.filter((m) =>
      m.activo && (isVenta ? m.asociadoA === 'usuario' : (m.asociadoA === 'servicio' || !m.asociadoA))
    );

    return isVenta ? withPendingUserPaymentMethod(metodosBase) : metodosBase;
  }, [isVenta, metodosPago]);
  const metodosPagoOrdenados = useMemo(() => {
    if (isVenta) {
      const pendientes = metodosFiltrados.filter((metodo) => isPendingUserPaymentMethodId(metodo.id));
      const restantes = metodosFiltrados
        .filter((metodo) => !isPendingUserPaymentMethodId(metodo.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

      return [...pendientes, ...restantes];
    }

    return [...metodosFiltrados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [isVenta, metodosFiltrados]);
  const metodoPagoSeleccionado = metodosPagoOrdenados.find((m) => m.id === metodoPagoIdValue);
  const metodoPagoDisplayName = isVenta
    ? getUsuarioMetodoPagoNombre(metodoPagoIdValue, metodoPagoSeleccionado?.nombre)
    : getServicioMetodoPagoNombre(metodoPagoSeleccionado, 'Seleccionar método');
  const currencySymbol = getCurrencySymbol(getUsuarioMetodoPagoMoneda(metodoPagoIdValue, metodoPagoSeleccionado?.moneda));
  const costoNormalizado = roundToDecimals(Number(costoValue) || 0);
  const descuentoNumero = Number(descuentoValue) || 0;
  const precioFinal = calculateDiscountedAmount(costoNormalizado, descuentoNumero);

  useEffect(() => {
    if (!props.open) return;

    if (props.context === 'venta') {
      if (isEdit) {
        if (props.pago) {
          reset({
            periodoRenovacion: props.pago.cicloPago || '',
            metodoPagoId: (props.pago.metodoPagoId as string) || venta?.metodoPagoId || PENDING_USER_PAYMENT_ID,
            costo: roundToDecimals(props.pago.precio ?? 0),
            descuento: (props.pago.descuento as number) ?? 0,
            fechaInicio: props.pago.fechaInicio ? new Date(props.pago.fechaInicio) : new Date(),
            fechaVencimiento: props.pago.fechaVencimiento ? new Date(props.pago.fechaVencimiento) : new Date(),
            notas: props.pago.notas ?? '',
          });
          return;
        }
        reset({
          periodoRenovacion: '',
          metodoPagoId: venta?.metodoPagoId || PENDING_USER_PAYMENT_ID,
          costo: 0,
          descuento: 0,
          fechaInicio: new Date(),
          fechaVencimiento: new Date(),
          notas: '',
        });
        return;
      }

      const fechaVencimientoActual = venta?.fechaFin ? new Date(venta.fechaFin) : new Date();
      reset({
        periodoRenovacion: '',
        metodoPagoId: venta?.metodoPagoId || PENDING_USER_PAYMENT_ID,
        costo: roundToDecimals(venta?.precioFinal || 0),
        descuento: 0,
        fechaInicio: fechaVencimientoActual,
        fechaVencimiento: fechaVencimientoActual,
        notas: venta?.notas ?? '',
      });
      return;
    }

    if (isEdit) {
      if (!props.pago || !servicio) return;
      reset({
        periodoRenovacion: servicio.cicloPago || '',
        metodoPagoId: servicio.metodoPagoId || '',
        costo: roundToDecimals(props.pago.monto),
        fechaInicio: new Date(props.pago.fechaInicio),
        fechaVencimiento: new Date(props.pago.fechaVencimiento),
        notas: props.pago.notas ?? servicio?.notas ?? '',
      });
      return;
    }

    const fechaVencimientoActual = servicio?.fechaVencimiento
      ? new Date(servicio.fechaVencimiento)
      : new Date();
    reset({
      periodoRenovacion: '',
      metodoPagoId: servicio?.metodoPagoId || '',
      costo: roundToDecimals(servicio?.costoServicio || 0),
      fechaInicio: fechaVencimientoActual,
      fechaVencimiento: fechaVencimientoActual,
      notas: servicio?.notas ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.pago, servicio?.fechaVencimiento, servicio?.metodoPagoId, servicio?.costoServicio]);

  useEffect(() => {
    if (fechaInicioValue && periodoValue && periodoValue !== '') {
      const meses =
        periodoValue === 'mensual' ? 1 :
        periodoValue === 'trimestral' ? 3 :
        periodoValue === 'semestral' ? 6 : 12;
      const nuevaFechaVencimiento = addMonths(fechaInicioValue, meses);
      setValue('fechaVencimiento', nuevaFechaVencimiento);
    }
  }, [periodoValue, fechaInicioValue, setValue]);

  // Generar vista previa del mensaje cuando notificarWhatsApp está activo
  useEffect(() => {
    if (!isVenta || !notificarWhatsAppValue || isEdit) {
      setPreviewMessage('');
      return;
    }

    const template = getTemplateByTipo('renovacion');
    if (!template) {
      setPreviewMessage('Template de renovación no encontrado');
      return;
    }

    const precioFinal = calculateDiscountedAmount(Number(costoValue) || 0, Number(descuentoValue) || 0);

    try {
      const mensaje = generarMensajeVenta(template.contenido, {
        clienteNombre: props.clienteNombre || 'Cliente',
        clienteSoloNombre: props.clienteSoloNombre,
        servicioNombre: props.servicioNombre || 'Servicio',
        categoriaNombre: props.categoriaNombre || 'Categoría',
        perfilNombre: props.perfilNombre || '',
        correo: props.correo || '',
        contrasena: props.contrasena || '',
        codigo: props.codigo || '',
        fechaVencimiento: fechaVencimientoValue || new Date(),
        monto: precioFinal,
      });
      setPreviewMessage(mensaje);
    } catch (error) {
      console.error('Error generando mensaje:', error);
      setPreviewMessage('Error generando mensaje de vista previa');
    }
  }, [
    notificarWhatsAppValue,
    isEdit,
    costoValue,
    descuentoValue,
    fechaVencimientoValue,
    props.clienteNombre,
    props.clienteSoloNombre,
    props.servicioNombre,
    props.categoriaNombre,
    props.perfilNombre,
    props.correo,
    props.contrasena,
    props.codigo,
    getTemplateByTipo,
    isVenta,
  ]);

  const hasChanges = useMemo(() => {
    if (props.context !== 'servicio' || props.mode !== 'edit') return true;
    if (!props.pago || !servicio) return false;
    const inicioPago = new Date(props.pago.fechaInicio).getTime();
    const vencimientoPago = new Date(props.pago.fechaVencimiento).getTime();
    return (
      periodoValue !== (servicio.cicloPago || '') ||
      metodoPagoIdValue !== (servicio.metodoPagoId || '') ||
      costoValue !== roundToDecimals(props.pago.monto) ||
      fechaInicioValue?.getTime() !== inicioPago ||
      fechaVencimientoValue?.getTime() !== vencimientoPago ||
      (notasValue ?? '') !== (props.pago.notas ?? '')
    );
  }, [
    costoValue,
    fechaInicioValue,
    fechaVencimientoValue,
    notasValue,
    props.context,
    props.mode,
    metodoPagoIdValue,
    periodoValue,
    props.pago,
    servicio,
  ]);

  const onSubmit = async (data: PagoDialogFormData) => {
    // Agregar campos denormalizados del método de pago
    const metodoPago = metodosFiltrados.find(m => m.id === data.metodoPagoId);
    const costo = roundToDecimals(data.costo);
    const descuento = data.descuento === undefined ? undefined : roundToDecimals(data.descuento);
    const enrichedData = {
      ...data,
      costo,
      descuento,
      notas: data.notas?.trim() ?? '',
      metodoPagoNombre: getUsuarioMetodoPagoNombre(data.metodoPagoId, metodoPago?.nombre),
      moneda: getUsuarioMetodoPagoMoneda(data.metodoPagoId, metodoPago?.moneda),
      // Pasar el mensaje editado (solo si hay WhatsApp activado)
      mensajeWhatsApp: data.notificarWhatsApp && previewMessage ? previewMessage : undefined,
    };
    props.onConfirm(enrichedData);
    props.onOpenChange(false);
  };

  const handleCancel = () => {
    setIsCostoFocused(false);
    reset();
    props.onOpenChange(false);
  };

  if (!isVenta && isEdit && !pago) return null;

  const title = isVenta
    ? (isEdit ? 'Editar Pago' : `Renovar Venta: ${venta?.clienteNombre || ''}`)
    : (isEdit ? `Editar pago del servicio: ${servicio?.nombre || ''}` : `Renovar Servicio: ${servicio?.nombre || ''}`);
  const description = isVenta
    ? (isEdit
        ? 'Actualiza la información del pago seleccionado.'
        : 'Registre un nuevo pago para esta venta para extender su fecha de vencimiento.')
    : (isEdit
        ? `Corrija los datos del último pago registrado (${(pago as PagoServicio | null)?.descripcion ?? 'Pago'}) si se ingresó algo incorrecto.`
        : 'Registre un nuevo pago para este servicio para extender su fecha de vencimiento.');

  const submitDisabled = isSubmitting || (!isVenta && isEdit && !hasChanges);
  const dialogContentClassName = isVenta
    ? 'sm:max-w-[600px]'
    : 'sm:max-w-[760px]';
  const notasLabel = isEdit ? 'Nota del pago' : 'Nota principal';
  const notasPlaceholder = isEdit
    ? 'Edita la nota historica de este pago...'
    : 'Edita la nota principal que se conservara para futuras renovaciones...';

  const renderPeriodoField = () => (
    <div className="space-y-2">
      <Label htmlFor="periodoRenovacion">Ciclo de facturación</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className="h-9 w-full justify-between gap-2 border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50"
          >
            {periodoValue === 'mensual' ? 'Mensual' : periodoValue === 'trimestral' ? 'Trimestral' : periodoValue === 'semestral' ? 'Semestral' : periodoValue === 'anual' ? 'Anual' : 'Seleccionar ciclo'}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          {(() => {
            const order: Plan['cicloPago'][] = ['mensual', 'trimestral', 'semestral', 'anual'];
            const planes = props.categoriaPlanes
              ? props.categoriaPlanes.filter((plan) => !props.tipoPlan || plan.tipoPlan === props.tipoPlan)
              : [];
            const ciclosDisponibles = planes.length > 0
              ? order.filter((ciclo) => planes.some((p) => p.cicloPago === ciclo))
              : order;
            return ciclosDisponibles.map((ciclo) => (
              <DropdownMenuItem
                key={ciclo}
                onClick={() => {
                  setValue('periodoRenovacion', ciclo);
                  const precio = getPrecioPorCiclo(ciclo);
                  if (precio !== null) setValue('costo', precio);
                  clearErrors('periodoRenovacion');
                }}
              >
                {ciclo === 'mensual' ? 'Mensual' : ciclo === 'trimestral' ? 'Trimestral' : ciclo === 'semestral' ? 'Semestral' : 'Anual'}
              </DropdownMenuItem>
            ));
          })()}
        </DropdownMenuContent>
      </DropdownMenu>
      {errors.periodoRenovacion && (
        <p className="text-sm text-red-500">{errors.periodoRenovacion.message}</p>
      )}
    </div>
  );

  const renderMetodoField = () => (
    <div className="space-y-2">
      <Label htmlFor="metodoPagoId">Método de pago</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className="h-9 w-full justify-between gap-2 border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50"
          >
            <span className="min-w-0 truncate text-left">{metodoPagoIdValue
              ? metodoPagoDisplayName
              : 'Seleccionar método'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          {metodosPagoOrdenados.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => { setValue('metodoPagoId', m.id); clearErrors('metodoPagoId'); }}>
              <span className="block w-full truncate">
                {isVenta ? m.nombre : getServicioMetodoPagoNombre(m)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {errors.metodoPagoId && (
        <p className="text-sm text-red-500">{errors.metodoPagoId.message}</p>
      )}
    </div>
  );

  const renderCostoField = (label: string) => (
    <div className="space-y-2">
      <Label htmlFor="costo">{label}</Label>
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] outline-none">
        <span className="text-muted-foreground shrink-0 pr-2">{currencySymbol}</span>
        <input
          id="costo"
          type="text"
          inputMode="decimal"
          value={isCostoFocused ? costoInput : costoNormalizado.toFixed(2)}
          onFocus={() => {
            setIsCostoFocused(true);
            setCostoInput(costoValue !== undefined ? costoValue.toString() : '');
          }}
          onBlur={(e) => {
            const val = e.target.value.replace(',', '.');
            const normalizedValue = roundToDecimals(parseFloat(val) || 0);
            setValue('costo', normalizedValue);
            setIsCostoFocused(false);
          }}
          onChange={(e) => {
            const val = e.target.value.replace(',', '.');
            // Permitir solo números decimales parciales válidos (ej: "10.", "10.5")
            if (/^\d*\.?\d*$/.test(val)) {
              setCostoInput(val);
              const parsed = parseFloat(val);
              if (!isNaN(parsed)) {
                setValue('costo', parsed);
              } else if (val === '' || val === '.') {
                setValue('costo', 0);
              }
            }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      {errors.costo && (
        <p className="text-sm text-red-500">{errors.costo.message}</p>
      )}
    </div>
  );

  const renderDescuentoField = () => (
    <div className="space-y-2">
      <Label htmlFor="descuento">Descuento %</Label>
      <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] outline-none">
        <input
          id="descuento"
          type="text"
          inputMode="decimal"
          value={isDescuentoFocused ? descuentoInput : (descuentoValue ?? 0).toString()}
          onFocus={() => {
            setIsDescuentoFocused(true);
            if (descuentoValue === 0) {
              setDescuentoInput('');
              setValue('descuento', undefined);
            } else {
              setDescuentoInput(descuentoValue?.toString() || '');
            }
          }}
          onBlur={(e) => {
            const val = e.target.value.replace(',', '.');
            const parsed = parseFloat(val);
            setValue('descuento', isNaN(parsed) ? undefined : parsed);
            setIsDescuentoFocused(false);
          }}
          onChange={(e) => {
            const val = e.target.value.replace(',', '.');
            // Permitir solo números decimales parciales válidos
            if (/^\d*\.?\d*$/.test(val)) {
              setDescuentoInput(val);
              const parsed = parseFloat(val);
              if (!isNaN(parsed)) {
                setValue('descuento', parsed);
              } else if (val === '' || val === '.') {
                setValue('descuento', undefined);
              }
            }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-muted-foreground shrink-0 pl-2">%</span>
      </div>
      {errors.descuento && (
        <p className="text-sm text-red-500">{errors.descuento.message}</p>
      )}
    </div>
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={cn('max-w-[calc(100vw-2rem)]', dialogContentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {isVenta ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {renderPeriodoField()}
                {renderMetodoField()}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderCostoField('Precio')}
                {renderDescuentoField()}
              </div>

              <div className="space-y-2">
                <Label>Precio Final</Label>
                <div className="h-9 w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm font-medium">
                  {currencySymbol} {precioFinal.toFixed(2)}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {renderPeriodoField()}
              {renderMetodoField()}
              {renderCostoField('Costo')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de Inicio</Label>
              <Popover open={fechaInicioOpen} onOpenChange={setFechaInicioOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !fechaInicioValue && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaInicioValue ? (
                      formatearFecha(fechaInicioValue)
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaInicioValue}
                    onSelect={(date) => {
                      setValue('fechaInicio', date || new Date());
                    }}
                    defaultMonth={fechaInicioValue ?? new Date()}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Vencimiento</Label>
              <Popover open={fechaVencimientoOpen} onOpenChange={setFechaVencimientoOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !fechaVencimientoValue && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaVencimientoValue ? (
                      formatearFecha(fechaVencimientoValue)
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaVencimientoValue}
                    onSelect={(date) => {
                      setValue('fechaVencimiento', date || new Date());
                    }}
                    defaultMonth={fechaVencimientoValue ?? new Date()}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">{notasLabel}</Label>
            <Textarea
              id="notas"
              {...register('notas')}
              placeholder={notasPlaceholder}
              rows={3}
            />
          </div>

          {!isEdit && isVenta && (
            <div className="rounded-lg border bg-background/40 p-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={Boolean(notificarWhatsAppValue)}
                  onCheckedChange={(checked) => setValue('notificarWhatsApp', checked as boolean)}
                />
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  <span>Notificar al cliente por WhatsApp</span>
                </div>
              </div>

              {notificarWhatsAppValue && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">Vista Previa del Mensaje</p>
                  <p className="text-xs text-muted-foreground">Puedes ajustar el mensaje antes de enviarlo. Los cambios no se guardan en las plantillas.</p>
                  <Textarea
                    value={previewMessage}
                    onChange={(e) => setPreviewMessage(e.target.value)}
                    rows={10}
                    className="min-h-[220px] resize-y text-sm leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitDisabled} className="bg-purple-600 hover:bg-purple-700">
              {isEdit ? (
                <>
                  {!isVenta && <Pencil className="h-4 w-4 mr-2" />}
                  Guardar cambios
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Confirmar Renovación
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
