import Link from 'next/link';

import { Card } from '@/components/ui/card';

export function VentaLoadingState() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Cargando venta...</h1>
    </div>
  );
}

export function VentaNotFoundState() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Venta no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
          {' / '}
          <Link prefetch={false} href="/ventas" className="hover:text-foreground transition-colors">Ventas</Link>
          {' / '}
          <span className="text-foreground">Detalles</span>
        </p>
      </div>
      <Card className="p-6">
        <p className="text-muted-foreground">No se encontró la venta solicitada.</p>
        <Link prefetch={false} href="/ventas" className="inline-block mt-4 text-primary hover:underline">
          Volver a Ventas
        </Link>
      </Card>
    </div>
  );
}
