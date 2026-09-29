'use client';

import { Bell, Monitor, Moon, ShoppingCart } from 'lucide-react';
import type { QueryClient } from '@tanstack/react-query';

import { ReposoNotificacionesTable } from '@/components/notificaciones/ReposoNotificacionesTable';
import { ServiciosProximosTable } from '@/components/notificaciones/ServiciosProximosTable';
import { VentasProximasTable } from '@/components/notificaciones/VentasProximasTable';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/platform/query-keys';
import type { Notificacion } from '@/types/notificaciones';

import { ShellPreview } from '../shell/ShellPreview';

const NOMBRES = ['Ana Rodríguez', 'Luis Pérez', 'María Castillo', 'Carlos Vega', 'Emmanuel Del Rosario'];
const CATEGORIAS = ['Netflix', 'Disney+', 'Max', 'Prime Video', 'Spotify'];
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

function demoNotifications(): Notificacion[] {
  const base = { tipo: 'sistema' as const, prioridad: 'media' as const, leida: false, resaltada: false, createdAt: new Date() };
  const rows: Notificacion[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dias = (i % 9) - 2;
    rows.push({
      ...base,
      id: `v${i}`,
      entidad: 'venta',
      titulo: 'Venta vence',
      diasRestantes: dias,
      resaltada: i % 7 === 3,
      ventaId: `venta-${i}`,
      clienteId: `c${i}`,
      servicioId: `s${i}`,
      clienteNombre: NOMBRES[i % NOMBRES.length],
      servicioNombre: `${CATEGORIAS[i % 5]} cuenta ${i}`,
      servicioCorreo: `cuenta${i}@movietime.pa`,
      servicioContrasena: 'clave-segura',
      categoriaNombre: CATEGORIAS[i % 5],
      perfilNombre: `Perfil ${(i % 5) + 1}`,
      codigo: '1234',
      estado: 'activo',
      cicloPago: 'mensual',
      fechaInicio: day(dias - 30),
      fechaFin: day(dias),
      precioFinal: 5 + (i % 4),
      moneda: 'USD',
    });
  }
  for (let i = 0; i < 24; i += 1) {
    const dias = (i % 10) - 1;
    rows.push({
      ...base,
      id: `s${i}`,
      entidad: 'servicio',
      titulo: 'Servicio vence',
      diasRestantes: dias,
      servicioId: `srv-${i}`,
      categoriaId: `cat-${i % 5}`,
      servicioNombre: `${CATEGORIAS[i % 5]} cuenta ${i}`,
      categoriaNombre: CATEGORIAS[i % 5],
      tipoServicio: 'perfiles',
      correo: `servicio${i}@movietime.pa`,
      contrasena: 'clave-segura',
      metodoPagoNombre: 'Tarjeta Visa',
      moneda: 'USD',
      costoServicio: 12,
      cicloPago: 'mensual',
      fechaVencimiento: day(dias),
      renovacionAutomatica: i % 2 === 0,
    });
  }
  for (let i = 0; i < 12; i += 1) {
    rows.push({
      ...base,
      id: `r${i}`,
      entidad: 'reposo',
      titulo: 'Reposo',
      diasRestantes: i - 3,
      servicioId: `rep-${i}`,
      categoriaId: 'cat-0',
      servicioNombre: `Netflix cuenta ${i}`,
      categoriaNombre: CATEGORIAS[i % 5],
      correo: `reposo${i}@movietime.pa`,
      diasReposo: 30,
      fechaInicioReposo: day(-30),
      fechaFinReposo: day(i - 3),
      fechaInicio: day(-60),
      fechaFin: day(-30),
    });
  }
  return rows;
}

function seed(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.notificaciones.lists(), demoNotifications());
}

export function NotificacionesPreview() {
  return (
    <ShellPreview seed={seed}>
      <div className="min-w-0 space-y-4 overflow-x-hidden">
        <PageHeader title="Notificaciones" />
        <MetricGrid>
          <MetricCard title="Total" value={66} icon={Bell} />
          <MetricCard title="Ventas próximas" value={30} icon={ShoppingCart} tone="danger" />
          <MetricCard title="Servicios próximos" value={24} icon={Monitor} tone="warning" />
          <MetricCard title="En reposo" value={12} icon={Moon} />
        </MetricGrid>
        <Tabs defaultValue={typeof window === 'undefined' ? 'ventas' : new URLSearchParams(window.location.search).get('tab') ?? 'ventas'} className="min-w-0">
          <TabsList>
            <TabsTrigger value="ventas">Ventas Próximas</TabsTrigger>
            <TabsTrigger value="servicios">Servicios Próximos</TabsTrigger>
            <TabsTrigger value="reposo">Servicios en Reposo</TabsTrigger>
          </TabsList>
          <TabsContent value="ventas" className="min-w-0"><VentasProximasTable /></TabsContent>
          <TabsContent value="servicios" className="min-w-0"><ServiciosProximosTable /></TabsContent>
          <TabsContent value="reposo" className="min-w-0"><ReposoNotificacionesTable /></TabsContent>
        </Tabs>
      </div>
    </ShellPreview>
  );
}
