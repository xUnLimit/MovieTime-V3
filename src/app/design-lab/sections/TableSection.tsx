'use client';

import { MoreHorizontal } from 'lucide-react';

import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { Money } from '@/components/shared/Money';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { LabRow, LabSection } from './LabSection';

interface DemoVenta {
  id: string;
  cliente: string;
  servicio: string;
  monto: number;
  dias: number;
}

const DEMO: DemoVenta[] = [
  { id: '1', cliente: 'Ana Rodríguez', servicio: 'Netflix Premium', monto: 8, dias: -2 },
  { id: '2', cliente: 'Luis Pérez', servicio: 'Disney+', monto: 6, dias: 0 },
  { id: '3', cliente: 'María Castillo', servicio: 'Max', monto: 5.5, dias: 3 },
  { id: '4', cliente: 'Carlos Vega', servicio: 'Netflix Premium', monto: 8, dias: 21 },
  { id: '5', cliente: 'Sofía Herrera', servicio: 'Prime Video', monto: 4.5, dias: 12 },
];

function estadoDe(dias: number): { tone: Tone; label: string } {
  if (dias < 0) return { tone: 'danger', label: `${Math.abs(dias)} días de retraso` };
  if (dias === 0) return { tone: 'danger', label: 'Vence hoy' };
  if (dias <= 7) return { tone: 'warning', label: `${dias} días restantes` };
  return { tone: 'success', label: `${dias} días restantes` };
}

const columns = defineDataTableColumns<DemoVenta>([
  { key: 'cliente', header: 'Cliente', sortable: true, render: (v) => <span className="font-medium">{v.cliente}</span> },
  { key: 'servicio', header: 'Servicio', sortable: true },
  { key: 'monto', header: 'Monto', align: 'right', sortable: true, render: (v) => <Money value={v.monto} /> },
  {
    key: 'dias',
    header: 'Estado',
    render: (v) => {
      const estado = estadoDe(v.dias);
      return <StatusBadge tone={estado.tone}>{estado.label}</StatusBadge>;
    },
  },
]);

function RowActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="Acciones de la fila">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Renovar</DropdownMenuItem>
        <DropdownMenuItem>Enviar aviso</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Cortar venta</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TableSection() {
  return (
    <LabSection id="tabla" title="Tabla" description="Densidad media (~40px por fila), cabecera sutil, dinero alineado a la derecha. Datos sintéticos.">
      <div className="space-y-5">
        <LabRow label="DataTable con estados, orden y acciones">
          <div className="w-full">
            <DataTable data={DEMO} columns={columns} actions={() => <RowActions />} pagination itemsPerPageOptions={[5, 10]} />
          </div>
        </LabRow>
        <LabRow label="Cargando">
          <div className="w-full">
            <DataTable data={[]} columns={columns} loading />
          </div>
        </LabRow>
        <LabRow label="Vacío">
          <div className="w-full">
            <DataTable data={[]} columns={columns} emptyMessage="Aún no hay ventas" />
          </div>
        </LabRow>
      </div>
    </LabSection>
  );
}
