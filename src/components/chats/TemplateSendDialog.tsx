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
import { CHAT_TEMPLATES, type ChatTemplate } from './chat-format';

type TemplateSendDialogProps = {
  open: boolean;
  greeting: string;
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (templateName: ChatTemplate['name'], params: string[]) => void;
};

function initialValues(template: ChatTemplate, greeting: string) {
  return template.params.map((param) => (param === 'Saludo y nombre' ? greeting : ''));
}

export function TemplateSendDialog({ open, greeting, isSending, onOpenChange, onSend }: TemplateSendDialogProps) {
  const [template, setTemplate] = useState<ChatTemplate>(CHAT_TEMPLATES[0]);
  const [values, setValues] = useState<string[]>(() => initialValues(CHAT_TEMPLATES[0], greeting));

  const selectTemplate = (name: string) => {
    const next = CHAT_TEMPLATES.find((item) => item.name === name) ?? CHAT_TEMPLATES[0];
    setTemplate(next);
    setValues(initialValues(next, greeting));
  };

  const complete = values.every((value) => value.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar plantilla</DialogTitle>
          <DialogDescription>
            El cliente no ha escrito en las últimas 24 horas, así que WhatsApp solo permite plantillas aprobadas.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (complete) onSend(template.name, values.map((value) => value.trim()));
          }}
        >
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
                onChange={(event) => setValues((current) => current.map((value, position) =>
                  position === index ? event.target.value.replace(/[\n\t]/g, ' ') : value
                ))}
              />
            </div>
          ))}

          <DialogFooter>
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
