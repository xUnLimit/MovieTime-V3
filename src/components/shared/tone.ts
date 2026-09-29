/**
 * Tonos semanticos compartidos. Cada tono mapea a tokens de `globals.css`
 * (success/warning/danger/info/primary), nunca a colores de paleta cruda.
 */
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export const toneText: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  brand: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

export const toneSurface: Record<Tone, string> = {
  neutral: 'bg-muted',
  brand: 'bg-primary/10',
  success: 'bg-success-subtle',
  warning: 'bg-warning-subtle',
  danger: 'bg-danger-subtle',
  info: 'bg-info-subtle',
};

export const toneDot: Record<Tone, string> = {
  neutral: 'bg-muted-foreground/60',
  brand: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};
