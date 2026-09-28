'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataKeyLabel, renderMetaBody, resizeParamMap } from '@/modules/messaging/meta-template-mapping';
import { tipoLabel } from '@/modules/messaging/template-tipos';
import type { TemplateOption } from './chat-templates';
import { WhatsAppText } from './WhatsAppText';

type TemplateSendDialogProps = {
  open: boolean;
  options: TemplateOption[];
  initialTipo: string;
  paramsFor: (option: TemplateOption) => string[];
  contextLabel: string | null;
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (templateName: string, params: string[]) => void;
};

// Remontar con una key nueva al abrir reinicia el tipo y los valores sugeridos.
export function TemplateSendDialog({
  open, options, initialTipo, paramsFor, contextLabel, isSending, onOpenChange, onSend,
}: TemplateSendDialogProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [edits, setEdits] = useState<{ tipo: string; values: string[] } | null>(null);

  const selected = options.find((item) => item.tipo.tipo === (chosen ?? initialTipo)) ?? options[0] ?? null;
  const paramCount = selected?.meta.paramCount ?? 0;
  const values = selected
    ? resizeParamMap(edits?.tipo === selected.tipo.tipo ? edits.values : paramsFor(selected), paramCount)
    : [];
  const complete = selected !== null && values.every((value) => value.trim().length > 0);

  const setValue = (index: number, raw: string) => {
    if (!selected) return;
    const next = [...values];
    next[index] = raw.replace(/[\n\t]/g, ' ');
    setEdits({ tipo: selected.tipo.tipo, values: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar plantilla</DialogTitle>
          <DialogDescription>
            {contextLabel
              ? `Datos tomados de ${contextLabel}. Revísalos antes de enviar.`
              : 'Completa los datos. Si eliges una venta en la ficha del cliente, se llenan solos.'}
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (complete) onSend(selected.meta.name, values.map((value) => value.trim()));
            }}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chat-template">Plantilla</Label>
                <Select value={selected.tipo.tipo} onValueChange={setChosen}>
                  <SelectTrigger id="chat-template" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((item) => (
                      <SelectItem key={item.tipo.tipo} value={item.tipo.tipo}>
                        {tipoLabel(item.tipo.tipo)} · {item.meta.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {values.map((value, index) => {
                const label = dataKeyLabel(selected.tipo.metaParamMap?.[index] ?? '') || `Variable ${index + 1}`;
                return (
                  <div key={`${selected.meta.name}-${index}`} className="space-y-2">
                    <Label htmlFor={`chat-template-param-${index}`}>{label}</Label>
                    <Input
                      id={`chat-template-param-${index}`}
                      value={value}
                      maxLength={256}
                      onChange={(event) => setValue(index, event.target.value)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Así lo verá el cliente</p>
              <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-card px-3 py-2 text-sm leading-snug shadow-[0_1px_1.5px_rgb(0_0_0/0.18)] dark:bg-muted">
                  {selected.meta.header ? <p className="font-semibold">{selected.meta.header}</p> : null}
                  <WhatsAppText text={renderMetaBody(selected.meta.body, values)} />
                  {selected.meta.footer ? <p className="mt-1 text-xs text-muted-foreground">{selected.meta.footer}</p> : null}
                </div>
                {selected.meta.buttons.map((button) => (
                  <p key={`${button.type}-${button.text}`} className="rounded-2xl bg-card px-3 py-2 text-center text-sm font-medium text-primary shadow-sm dark:bg-muted">{button.text}</p>
                ))}
              </div>
            </div>

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={!complete || isSending}>
                {isSending ? 'Enviando...' : 'Enviar plantilla'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No hay plantillas de Meta aprobadas vinculadas a un tipo de mensaje. Vincúlalas y sincronízalas en el Editor de mensajes.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
