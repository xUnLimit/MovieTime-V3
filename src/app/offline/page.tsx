export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Sin conexion</h1>
        <p className="text-sm text-muted-foreground">
          MovieTime no pudo cargar contenido nuevo. Si ya sincronizaste antes,
          puedes seguir navegando en modo lectura cuando vuelvas a la app.
        </p>
      </div>
    </div>
  );
}
