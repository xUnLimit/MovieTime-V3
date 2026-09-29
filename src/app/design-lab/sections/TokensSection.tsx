import { LabRow, LabSection } from './LabSection';

const GROUPS: { title: string; tokens: string[] }[] = [
  { title: 'Superficies', tokens: ['background', 'card', 'popover', 'muted', 'accent', 'secondary'] },
  { title: 'Texto y bordes', tokens: ['foreground', 'muted-foreground', 'border', 'input', 'ring'] },
  { title: 'Marca', tokens: ['primary', 'primary-foreground'] },
  { title: 'Éxito', tokens: ['success', 'success-subtle', 'success-border'] },
  { title: 'Advertencia', tokens: ['warning', 'warning-subtle', 'warning-border'] },
  { title: 'Peligro', tokens: ['danger', 'danger-subtle', 'danger-border'] },
  { title: 'Información', tokens: ['info', 'info-subtle', 'info-border'] },
  { title: 'Gráficos', tokens: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] },
];

const TYPE_SCALE = [
  ['text-xl font-semibold tracking-tight', 'Título de página y cifra de KPI · 20 semibold'],
  ['text-base font-semibold', 'Título de diálogo y sección grande · 16 semibold'],
  ['text-sm', 'Cuerpo: tablas, formularios, botones, menús · 14'],
  ['text-sm font-semibold', 'Título de panel y tarjeta · 14 semibold'],
  ['text-xs text-muted-foreground', 'Descripciones, fechas, leyendas y ejes · 12'],
] as const;

function Swatch({ token }: { token: string }) {
  return (
    <div className="w-28 space-y-1.5">
      <div className="h-12 rounded-md border" style={{ backgroundColor: `var(--${token})` }} />
      <p className="truncate font-mono text-xs text-muted-foreground">{token}</p>
    </div>
  );
}

export function TokensSection() {
  return (
    <LabSection id="tokens" title="Tokens" description="Colores semánticos y escala tipográfica. Nunca se usan colores de paleta cruda.">
      <div className="space-y-5 rounded-xl border bg-card p-5">
        {GROUPS.map((group) => (
          <LabRow key={group.title} label={group.title}>
            {group.tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </LabRow>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Geist Sans</p>
          {TYPE_SCALE.map(([cls, label]) => (
            <p key={cls} className={cls}>
              {label}
            </p>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Cifras tabulares (Sans) vs. Geist Mono</p>
          <p className="text-xl font-semibold tracking-tight tabular-nums">$12,480.00 · $4,210.50 · $8,269.50</p>
          <p className="font-mono text-sm">$12,480.00 · 28 sep 2026 · 5 vencen hoy</p>
          <p className="text-sm text-muted-foreground">Las columnas de dinero usan tabular-nums para alinear los decimales.</p>
        </div>
      </div>
    </LabSection>
  );
}
