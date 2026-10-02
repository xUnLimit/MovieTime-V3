'use client';

import { useState } from 'react';
import { NODE_LIMITS, PARAM_CATALOG, normalizeText, setKeywords, setParam } from '@/modules/bot-config';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotAdminApi, BotParams } from '@/types/bot';
import { BotState } from './BotState';

export function RulesTab({ api }: { api: BotAdminApi }) {
  const [keyword, setKeyword] = useState('');
  const normalized = normalizeText(keyword);
  return <BotState api={api} empty={!api.draft}><div className="space-y-4">
    <Panel title="Parámetros" description="Ajusta tiempos y límites de respuesta."><div className="grid gap-4 md:grid-cols-2">{(Object.entries(PARAM_CATALOG) as [keyof BotParams, typeof PARAM_CATALOG[keyof BotParams]][]).map(([key, item]) => <label key={key} className="block space-y-1 text-sm font-medium">{item.label}<span className="block text-xs font-normal text-muted-foreground">{item.description} · {item.min}–{item.max} {item.unit}</span><Input type="number" min={item.min} max={item.max} value={api.draft?.params[key] ?? item.defaultValue} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) api.updateDraft(current => setParam(current, key, value)); }} /></label>)}</div></Panel>
    <Panel title="Palabras clave" description="El bot ofrece el menú cuando recibe una de estas palabras.">
      <div className="flex flex-wrap gap-2"><label className="min-w-40 flex-1 text-sm font-medium">Nueva palabra<Input value={keyword} maxLength={60} onChange={event => setKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (normalized && !api.draft?.keywords.includes(normalized)) { api.updateDraft(current => setKeywords(current, [...current.keywords, normalized])); setKeyword(''); } } }} /></label><Button className="self-end" disabled={!normalized || api.draft?.keywords.includes(normalized) || (api.draft?.keywords.length ?? 0) >= NODE_LIMITS.keywordsMax} onClick={() => { api.updateDraft(current => setKeywords(current, [...current.keywords, normalized])); setKeyword(''); }}>Agregar</Button></div>
      <ul className="mt-3 flex flex-wrap gap-2">{api.draft?.keywords.map(word => <li key={word} className="flex items-center gap-1 rounded-md border px-2 text-sm">{word}<Button size="sm" variant="ghost" aria-label={`Quitar ${word}`} onClick={() => api.updateDraft(current => setKeywords(current, current.keywords.filter(item => item !== word)))}>Quitar</Button></li>)}</ul>
    </Panel>
  </div></BotState>;
}
