import Link from 'next/link';

export function ServicioLoadingState() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cargando servicio...</h1>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
          {' / '}
          <Link prefetch={false} href="/servicios" className="hover:text-foreground transition-colors">Servicios</Link>
          {' / '}
          <span className="text-foreground">Detalles</span>
        </p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground">Cargando datos del servicio...</p>
      </div>
    </div>
  );
}

export function ServicioNotFoundState() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Servicio no encontrado</h1>
        <p className="text-sm text-muted-foreground">
          <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>{' '}
          /{' '}
          <Link prefetch={false} href="/servicios" className="hover:text-foreground transition-colors">
            Servicios
          </Link>{' '}
          / <span className="text-foreground">Detalles</span>
        </p>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground">No se encontró el servicio con el ID proporcionado.</p>
        <Link prefetch={false} href="/servicios" className="inline-block mt-4 text-primary hover:underline">
          Volver a Servicios
        </Link>
      </div>
    </div>
  );
}
