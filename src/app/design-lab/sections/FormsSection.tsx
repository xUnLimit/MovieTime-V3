'use client';

import { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { LabSection } from './LabSection';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormsSection() {
  const [notify, setNotify] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 7));

  return (
    <LabSection id="formularios" title="Formularios" description="Campos con hairline, foco visible y error cerca del campo.">
      <div className="grid gap-5 rounded-xl border bg-card p-5 md:grid-cols-2">
        <Field label="Cliente" hint="Nombre completo o razón social.">
          <Input placeholder="Ana Rodríguez" />
        </Field>
        <Field label="Correo">
          <Input type="email" defaultValue="ana@correo.com" />
        </Field>
        <Field label="Teléfono (con error)">
          <Input aria-invalid defaultValue="507" />
          <p className="text-xs text-danger">Ingresa un teléfono válido de 8 dígitos.</p>
        </Field>
        <Field label="Servicio">
          <Select defaultValue="netflix">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un servicio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="netflix">Netflix Premium</SelectItem>
              <SelectItem value="disney">Disney+</SelectItem>
              <SelectItem value="max">Max</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Notas">
          <Textarea placeholder="Comentarios internos sobre la venta" />
        </Field>
        <Field label="Fecha">
          <Calendar mode="single" defaultMonth={new Date(2026, 9, 1)}
            selected={date} onSelect={setDate} />
        </Field>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox id="lab-renovar" defaultChecked />
            <Label htmlFor="lab-renovar">Renovar automáticamente</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="lab-aviso" checked={notify} onCheckedChange={setNotify} />
            <Label htmlFor="lab-aviso">Enviar aviso por WhatsApp</Label>
          </div>
          <Field label="Deshabilitado">
            <Input disabled defaultValue="No editable" />
          </Field>
        </div>
      </div>
    </LabSection>
  );
}
