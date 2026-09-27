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
import { CHAT_TEMPLATES, renderTemplatePreview, type ChatTemplate } from './chat-format';
import { WhatsAppText } from './WhatsAppText';

type TemplateSendDialogProps = {
  open: boolean;
  initialTemplate: ChatTemplate['name'];
  paramsFor: (name: ChatTemplate['name']) => string[];
  contextLabel: string | null;
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (templateName: ChatTemplate['name'], params: string[]) => void;
};

function templateByName(name: string) {
  return CHAT_TEMPLATES.find((item) => item.name === name) ?? CHAT_TEMPLATES[0];
}

// Remontar con una key nueva al abrir reinicia plantilla y valores sugeridos.
export function TemplateSendDialog({
  open, initialTemplate, paramsFor, contextLabel, isSending, onOpenChange, onSend,
}: TemplateSendDialogProps) {
  const [template, setTemplate] = useState<ChatTemplate>(() => templateByName(initialTemplate));
  const [values, setValues] = useState<string[]>(() => paramsFor(initialTemplate));

  const selectTemplate = (name: string) => {
    const next = templateByName(name);
    setTemplate(next);
    setValues(paramsFor(next.name));
  };

  const complete = values.length === template.params.length && values.every((value) => value.trim().length > 0);

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

        <form
          className="grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (complete) onSend(template.name, values.map((value) => value.trim()));
          }}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chat-template">Plantilla</Label>
              <Select value={template.name} onValueChange={selectTemplate}>
                <SelectTrigger id="chat-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAT_TEMPLATES.map((item) => (
                    <SelectItem key={item.name} value={item.name}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {template.params.map((param, index) => (
              <div key={`${template.name}-${param}`} className="space-y-2">
                <Label htmlFor={`chat-template-param-${index}`}>{param}</Label>
                <Input
                  id={`chat-template-param-${index}`}
                  value={values[index] ?? ''}
                  maxLength={256}
                  onChange={(event) => setValues((current) => template.params.map((_, position) =>
                    position === index ? event.target.value.replace(/[\n\t]/g, ' ') : current[position] ?? ''
                  ))}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Así lo verá el cliente</p>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-card px-3 py-2 text-sm leading-snug shadow-[0_1px_1.5px_rgb(0_0_0/0.18)] dark:bg-muted">
                <WhatsAppText text={renderTemplatePreview(template.body, values)} />
              </p>
            </div>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!complete || isSending}>
              {isSending ? 'Enviando...' : 'Enviar plantilla'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
