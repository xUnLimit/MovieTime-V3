import type { ReactNode } from 'react';

interface LabSectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function LabSection({ id, title, description, children }: LabSectionProps) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function LabRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
