'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Logo } from '@/components/shared/Logo';
import { useTheme } from '@/components/layout/ThemeProvider';
import { Button } from '@/components/ui/button';

import { ButtonsSection } from './sections/ButtonsSection';
import { FormsSection } from './sections/FormsSection';
import { MetricsSection } from './sections/MetricsSection';
import { NavigationSection } from './sections/NavigationSection';
import { OverlaysSection } from './sections/OverlaysSection';
import { StatesSection } from './sections/StatesSection';
import { StatusSection } from './sections/StatusSection';
import { TableSection } from './sections/TableSection';
import { TokensSection } from './sections/TokensSection';

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['botones', 'Botones'],
  ['formularios', 'Formularios'],
  ['estados', 'Badges'],
  ['metricas', 'Métricas'],
  ['tabla', 'Tabla'],
  ['navegacion', 'Navegación'],
  ['overlays', 'Overlays'],
  ['feedback', 'Feedback'],
] as const;

type PrimaryStyle = 'violet' | 'ink';

/** Aplica el estilo del boton primario sobre <html> para que tambien alcance dialogs y menus en portal. */
function usePrimaryStyle(style: PrimaryStyle) {
  useEffect(() => {
    const root = document.documentElement;
    if (style === 'ink') {
      root.style.setProperty('--primary', 'var(--foreground)');
      root.style.setProperty('--primary-foreground', 'var(--background)');
    }
    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
    };
  }, [style]);
}

export function DesignLab() {
  const { resolvedTheme, setTheme } = useTheme();
  const [primary, setPrimary] = useState<PrimaryStyle>('violet');
  usePrimaryStyle(primary);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="size-5" />
            <span className="text-sm font-semibold">Design Lab</span>
          </div>
          <nav aria-label="Secciones" className="tabs-scroll-shell order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <div className="tabs-scroll-list gap-1">
              {SECTIONS.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant={primary === 'violet' ? 'default' : 'outline'}
              onClick={() => setPrimary(primary === 'violet' ? 'ink' : 'violet')}
              aria-label="Alternar color del botón primario"
            >
              Primario: {primary === 'violet' ? 'violeta' : 'tinta'}
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={resolvedTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
        <TokensSection />
        <ButtonsSection />
        <FormsSection />
        <StatusSection />
        <MetricsSection />
        <TableSection />
        <NavigationSection />
        <OverlaysSection />
        <StatesSection />
      </main>
    </div>
  );
}
