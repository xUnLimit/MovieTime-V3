'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VentasForm } from '@/components/ventas/VentasForm';

export default function CrearVentaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/ventas">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nueva Venta</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link href="/ventas" className="hover:text-foreground transition-colors">
              Ventas
            </Link>{' '}
            / <span className="text-foreground">Crear</span>
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <VentasForm />
      </div>
    </div>
  );
}
