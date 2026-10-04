'use client';

import { useState } from 'react';
import { compareBotVersionsUseCase } from '@/application/use-cases/bot-admin-use-cases';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import type { BotVersionSummary } from '@/types/bot';
import { SELECT_CLASS } from './flow/OptionRow';

/** Diferencias entre dos versiones guardadas, sin tocar el borrador ni lo publicado. */
export function VersionCompare({ versions }: { versions: readonly BotVersionSummary[] }) {
  const [from, setFrom] = useState(versions[1]?.version ?? versions[0]?.version ?? 0);
  const [to, setTo] = useState(versions[0]?.version ?? 0);
  const [changes, setChanges] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function compare() {
    try { setChanges(await compareBotVersionsUseCase(from, to)); setError(null); }
    catch { setChanges(null); setError('No se pudieron comparar las versiones. Inténtalo de nuevo.'); }
  }
  const picker = (label: string, value: number, set: (version: number) => void) => <label className="block min-w-40 flex-1 text-sm font-medium">{label}
    <select className={SELECT_CLASS} value={value} onChange={(event) => { set(Number(event.target.value)); setChanges(null); }}>
      {versions.map((version) => <option key={version.version} value={version.version}>Versión {version.version}{version.isPublished ? ' (publicada)' : ''}</option>)}</select></label>;
  return <Panel title="Comparar versiones" description="Muestra qué cambió de una versión a otra. No modifica el borrador.">
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {picker('Desde', from, setFrom)}{picker('Hasta', to, setTo)}
        <Button variant="outline" disabled={from === to} onClick={() => void compare()}>Comparar</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {changes ? <ul aria-label={`Cambios de la versión ${from} a la ${to}`} className="list-inside list-disc text-sm">
        {changes.length ? changes.map((change, index) => <li key={index}>{change}</li>) : <li>Sin diferencias</li>}</ul> : null}
    </div>
  </Panel>;
}
