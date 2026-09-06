'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createMutationIntent } from '@/platform/utils/mutation-intent';
import { RotateCcw, Scissors } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCurrencySymbol } from '@/platform/constants';
import { getTerceroMetodoPagoMoneda, getTerceroMetodoPagoNombre, isPendingTerceroPaymentMethodId } from '@/platform/utils/terceroMetodoPago';
import type { MetodoPago, VentaDoc } from '@/types';

import type { VentaReembolsoConfirm } from './types';

interface VentaReembolsoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venta: VentaDoc;
  metodosPago: MetodoPago[];
  montoSugerido: number;
  onConfirm: VentaReembolsoConfirm;
}

type ReembolsoAccion = 'reembolso' | 'reembolso-corte';

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function VentaReembolsoDialog({
  open,
  onOpenChange,
  venta,
  metodosPago,
  montoSugerido,
  onConfirm,
}: VentaReembolsoDialogProps) {
  const intent = useRef(createMutationIntent());
  const submitting = useRef(false);
  useEffect(() => { if (open) intent.current = createMutationIntent(); }, [open]);
  const [step, setStep] = useState<'accion' | 'detalle'>('accion');
  const [accion, setAccion] = useState<ReembolsoAccion>('reembolso');
  const [monto, setMonto] = useState('');
  const [metodoPagoId, setMetodoPagoId] = useState('');
  const [destinoReembolso, setDestinoReembolso] = useState('');
  const [fecha, setFecha] = useState(toDateInputValue(new Date()));
  const [nota, setNota] = useState('');
  const [motivoCorte, setMotivoCorte] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const metodosDisponibles = useMemo(
    () => metodosPago
      .filter((metodo) => metodo.activo && metodo.asociadoA === 'tercero' && !isPendingTerceroPaymentMethodId(metodo.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [metodosPago]
  );
  const metodoSeleccionado = metodosDisponibles.find((metodo) => metodo.id === metodoPagoId);
  const moneda = getTerceroMetodoPagoMoneda(metodoPagoId, metodoSeleccionado?.moneda || venta.moneda || 'USD');
  const currencySymbol = getCurrencySymbol(moneda);
  const requiereMotivo = accion === 'reembolso-corte';
  const montoNumber = Number(monto);
  const canSubmit =
    Number.isFinite(montoNumber) &&
    montoNumber > 0 &&
    !!metodoPagoId &&
    destinoReembolso.trim().length > 0 &&
    !!fecha &&
    (!requiereMotivo || motivoCorte.trim().length > 0);

  useEffect(() => {
    if (!open) return;
    setStep('accion');
    setAccion('reembolso');
    setMonto(montoSugerido > 0 ? montoSugerido.toFixed(2) : '');
    setMetodoPagoId(
      venta.metodoPagoId && !isPendingTerceroPaymentMethodId(venta.metodoPagoId)
        ? venta.metodoPagoId
        : ''
    );
    setDestinoReembolso('');
    setFecha(toDateInputValue(new Date()));
    setNota('');
    setMotivoCorte('');
    setIsSubmitting(false);
  }, [open, montoSugerido, venta.metodoPagoId]);

  const handleClose = () => {
    if (!isSubmitting) onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm({
        idempotencyKey: intent.current.keyFor([venta.id, montoNumber, metodoPagoId, destinoReembolso, moneda, fecha, nota, requiereMotivo, motivoCorte]),
        monto: montoNumber,
        metodoPagoId,
        metodoPagoNombre: getTerceroMetodoPagoNombre(metodoPagoId, metodoSeleccionado?.nombre),
        destinoReembolso: destinoReembolso.trim(),
        moneda,
        fecha: new Date(`${fecha}T00:00:00`),
        nota: nota.trim(),
        cortarServicio: requiereMotivo,
        motivoCorte: motivoCorte.trim(),
      });
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
        <div className="px-6 pt-6 pb-4 bg-muted/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </div>
              Reembolso - Venta
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">Cliente</span>
              <span className="font-medium">{venta.clienteNombre}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">Servicio</span>
              <span className="font-medium">{venta.servicioNombre}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">Sugerido</span>
              <span className="font-medium">{getCurrencySymbol(venta.moneda || 'USD')} {montoSugerido.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {step === 'accion' ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Que accion deseas realizar?</p>
              <RadioGroup value={accion} onValueChange={(value) => setAccion(value as ReembolsoAccion)} className="space-y-2">
                <label
                  htmlFor="refund-only"
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    accion === 'reembolso'
                      ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem id="refund-only" value="reembolso" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-sm font-medium">Reembolsar</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Registra el reembolso y mantiene la venta activa.</p>
                  </div>
                </label>

                <label
                  htmlFor="refund-cut"
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    accion === 'reembolso-corte'
                      ? 'border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem id="refund-cut" value="reembolso-corte" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-sm font-medium">Reembolsar y cortar servicio</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Registra el reembolso, inactiva la venta y libera el perfil.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="refund-amount">Monto a reembolsar</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                  <Input
                    id="refund-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={monto}
                    onChange={(event) => setMonto(event.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Metodo de reembolso</Label>
                <Select value={metodoPagoId} onValueChange={setMetodoPagoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {metodosDisponibles.map((metodo) => (
                      <SelectItem key={metodo.id} value={metodo.id}>
                        {metodo.nombre} - {metodo.moneda || 'USD'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="refund-destination">Cuenta destino del cliente</Label>
                <Input
                  id="refund-destination"
                  value={destinoReembolso}
                  onChange={(event) => setDestinoReembolso(event.target.value)}
                  placeholder="Ej: Yappy 6XX-XXXX, banco, cuenta o referencia"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="refund-date">Fecha</Label>
                <Input id="refund-date" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="refund-note">Nota</Label>
                <Textarea
                  id="refund-note"
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Detalle del reembolso..."
                />
              </div>

              {requiereMotivo ? (
                <div className="grid gap-2">
                  <Label htmlFor="cut-reason">Motivo de corte</Label>
                  <Textarea
                    id="cut-reason"
                    value={motivoCorte}
                    onChange={(event) => setMotivoCorte(event.target.value)}
                    placeholder="Motivo por el que se corta la venta..."
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-5 pt-2 flex gap-2">
          <Button type="button" variant="outline" onClick={step === 'accion' ? handleClose : () => setStep('accion')} disabled={isSubmitting} className="flex-1">
            {step === 'accion' ? 'Cancelar' : 'Atras'}
          </Button>
          {step === 'accion' ? (
            <Button type="button" onClick={() => setStep('detalle')} className="flex-1 bg-purple-600 hover:bg-purple-700">
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="flex-1 bg-purple-600 hover:bg-purple-700">
              {isSubmitting ? 'Procesando...' : requiereMotivo ? 'Reembolsar y cortar' : 'Reembolsar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
