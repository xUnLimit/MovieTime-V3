'use client';

import { RotateCcw, Scissors } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCurrencySymbol } from '@/platform/constants';
import { useVentaReembolsoForm, type ReembolsoAccion, type VentaReembolsoDialogProps } from './useVentaReembolsoForm';


export function VentaReembolsoDialog({
  open,
  onOpenChange,
  venta,
  metodosPago,
  montoSugerido,
  onConfirm,
}: VentaReembolsoDialogProps) {
  const {
    step, setStep, accion, setAccion, monto, setMonto, metodoPagoId, setMetodoPagoId,
    destinoReembolso, setDestinoReembolso, fecha, nota, setNota, motivoCorte, setMotivoCorte,
    inactivarServicio, setInactivarServicio, isSubmitting, montoSugeridoFecha,
    metodosDisponibles, currencySymbol, requiereMotivo, canSubmit,
    handleDateChange, handleClose, handleSubmit,
  } = useVentaReembolsoForm({ open, onOpenChange, venta, metodosPago, montoSugerido, onConfirm });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden gap-0">
        <div className="shrink-0 px-6 pt-6 pb-4 bg-muted/30">
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
              <span className="font-medium" data-testid="refund-suggested-amount">
                {getCurrencySymbol(venta.moneda || 'USD')} {montoSugeridoFecha.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-4">
          {step === 'accion' ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Que accion deseas realizar?</p>
              <RadioGroup value={accion} onValueChange={(value) => setAccion(value as ReembolsoAccion)} className="space-y-2">
                <label
                  htmlFor="refund-only"
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    accion === 'reembolso'
                      ? 'border-success-border bg-success-subtle'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem id="refund-only" value="reembolso" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5 text-success" />
                      <span className="text-sm font-medium">Reembolsar</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Registra el reembolso y mantiene la venta activa.</p>
                  </div>
                </label>

                <label
                  htmlFor="refund-cut"
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    accion === 'reembolso-corte'
                      ? 'border-warning-border bg-warning-subtle'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem id="refund-cut" value="reembolso-corte" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-warning" />
                      <span className="text-sm font-medium">Reembolsar y cortar</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Registra el reembolso y permite elegir el alcance del corte.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="refund-date">Fecha efectiva del reembolso</Label>
                <Input
                  id="refund-date"
                  type="date"
                  value={fecha}
                  onChange={(event) => handleDateChange(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Al cambiar la fecha se recalculan el monto sugerido y el monto a reembolsar.
                </p>
              </div>

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
                <Label htmlFor="refund-method">Metodo de reembolso</Label>
                <Select value={metodoPagoId} onValueChange={setMetodoPagoId}>
                  <SelectTrigger id="refund-method">
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
                <Label htmlFor="refund-note">Nota</Label>
                <Textarea
                  id="refund-note"
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Detalle del reembolso..."
                />
              </div>

              {requiereMotivo ? (
                <div className="grid gap-4 rounded-lg border border-warning-border bg-warning-subtle p-3">
                  <div className="grid gap-2">
                    <Label>Alcance del corte</Label>
                    <RadioGroup
                      value={inactivarServicio ? 'venta-servicio' : 'venta'}
                      onValueChange={(value) => setInactivarServicio(value === 'venta-servicio')}
                      className="space-y-2"
                    >
                      <label htmlFor="cut-sale-only" className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3">
                        <RadioGroupItem id="cut-sale-only" value="venta" className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-medium">Cortar solo la venta</span>
                          <span className="block text-xs text-muted-foreground">Inactiva esta venta y libera el perfil. El servicio permanece activo.</span>
                        </span>
                      </label>
                      <label htmlFor="cut-sale-service" className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3">
                        <RadioGroupItem id="cut-sale-service" value="venta-servicio" className="mt-0.5" disabled={!venta.servicioId} />
                        <span>
                          <span className="block text-sm font-medium">Cortar venta e inactivar servicio</span>
                          <span className="block text-xs text-muted-foreground">También inactiva la cuenta de servicio completa y afecta sus demás perfiles.</span>
                        </span>
                      </label>
                    </RadioGroup>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cut-reason">Motivo de corte</Label>
                    <Textarea
                      id="cut-reason"
                      value={motivoCorte}
                      onChange={(event) => setMotivoCorte(event.target.value)}
                      placeholder="Motivo por el que se realiza el corte..."
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 px-6 pb-5 pt-2 flex gap-2">
          <Button type="button" variant="outline" onClick={step === 'accion' ? handleClose : () => setStep('accion')} disabled={isSubmitting} className="flex-1">
            {step === 'accion' ? 'Cancelar' : 'Atras'}
          </Button>
          {step === 'accion' ? (
            <Button type="button" onClick={() => setStep('detalle')} className="flex-1 bg-primary hover:bg-primary/90">
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
              {isSubmitting ? 'Procesando...' : requiereMotivo ? 'Reembolsar y cortar' : 'Reembolsar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
