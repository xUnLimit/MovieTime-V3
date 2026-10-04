'use client';

import { useState } from 'react';
import { diffDefinitions } from '@/modules/bot-config';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import type { BotAdminApi } from '@/types/bot';
import { BotState } from './BotState';
import { VersionCompare } from './VersionCompare';

export function VersionsTab({ api }: { api: BotAdminApi }) {
  const [error, setError] = useState<string | null>(null);
  const [showDifferences, setShowDifferences] = useState(false);
  async function load(version: number, showDiff: boolean) {
    try { await api.loadVersionIntoDraft(version); setError(null); setShowDifferences(showDiff); }
    catch { setError('No se pudo cargar la versión. Inténtalo de nuevo.'); }
  }
  return <BotState api={api} empty={api.versions.length === 0}><div className="space-y-3">
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    {showDifferences && api.published && api.draft ? <Panel title="Diferencias con la versión publicada"><ul className="list-inside list-disc text-sm">{diffDefinitions(api.published, api.draft).length ? diffDefinitions(api.published, api.draft).map((difference, index) => <li key={index}>{difference}</li>) : <li>Sin diferencias</li>}</ul></Panel> : null}
    {api.versions.length >= 2 ? <VersionCompare versions={api.versions} /> : null}
    {api.versions.map(version => <Panel key={version.version} title={`Versión ${version.version}`} actions={version.isPublished ? <StatusBadge tone="success">Publicada</StatusBadge> : null}>
      <p className="text-sm">{version.note || 'Sin nota'}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString('es-PA')} · {version.createdBy ?? 'Autor desconocido'}</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load(version.version, false)}>Cargar en el borrador</Button><Button variant="outline" onClick={() => void load(version.version, true)}>Ver diferencias</Button></div>
    </Panel>)}
  </div></BotState>;
}
