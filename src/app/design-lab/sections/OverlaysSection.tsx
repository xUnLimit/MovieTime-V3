'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { LabRow, LabSection } from './LabSection';

export function OverlaysSection() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <LabSection id="overlays" title="Overlays" description="Diálogos para tareas enfocadas; menús ordenados por frecuencia; toasts por tono.">
      <div className="space-y-5 rounded-xl border bg-card p-5">
        <LabRow label="Dialog · Menú · Popover">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Abrir diálogo
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cortar venta</DialogTitle>
                <DialogDescription>El cliente perderá el acceso al perfil. Esta acción se registra en el log.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button variant="destructive">Cortar venta</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Abrir menú</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem>Renovar</DropdownMenuItem>
              <DropdownMenuItem>Enviar aviso</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Eliminar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Abrir popover</Button>
            </PopoverTrigger>
            <PopoverContent className="text-sm">Contenido auxiliar con información breve.</PopoverContent>
          </Popover>
        </LabRow>

        <LabRow label="Toasts">
          <Button variant="outline" onClick={() => toast.success('Pago registrado', { description: 'Venta de Ana Rodríguez renovada.' })}>
            Éxito
          </Button>
          <Button variant="outline" onClick={() => toast.warning('Vence pronto', { description: '3 ventas vencen mañana.' })}>
            Advertencia
          </Button>
          <Button variant="outline" onClick={() => toast.error('No se pudo guardar', { description: 'Revisa tu conexión e intenta de nuevo.' })}>
            Error
          </Button>
          <Button variant="outline" onClick={() => toast.info('Sincronizando plantillas con Meta')}>
            Info
          </Button>
        </LabRow>
      </div>
    </LabSection>
  );
}
