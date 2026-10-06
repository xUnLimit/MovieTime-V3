'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { NODE_LIMITS, normalizeText } from '@/modules/bot-config';
import { KEYWORD_MAX_LENGTH } from '@/modules/bot-config/catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type KeywordsEditorProps = { keywords: readonly string[]; onChange: (keywords: string[]) => void };

/** Palabras que hacen que el bot ofrezca el menú: se agregan con Enter o con comas (también al pegar) y se quitan con la X. */
export function KeywordsEditor({ keywords, onChange }: KeywordsEditorProps) {
  const [text, setText] = useState('');
  const incoming = text.split(/[,\n]/).map(normalizeText).filter((word) => word !== '');
  const fresh = [...new Set(incoming)].filter((word) => !keywords.includes(word));
  const full = keywords.length >= NODE_LIMITS.keywordsMax;
  const duplicate = incoming.length > 0 && fresh.length === 0;
  const add = () => {
    if (fresh.length === 0 || full) return;
    onChange([...keywords, ...fresh].slice(0, NODE_LIMITS.keywordsMax));
    setText('');
  };
  return <div className="space-y-3">
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <Input aria-label="Nueva palabra clave" placeholder="Escribe una palabra y pulsa Enter" value={text} maxLength={KEYWORD_MAX_LENGTH * 4} disabled={full} aria-invalid={duplicate}
          onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
        <p role={duplicate ? 'alert' : undefined} className={duplicate ? 'text-xs text-danger' : 'text-xs text-muted-foreground'}>
          {duplicate ? 'Esa palabra ya está en la lista.' : full ? `Llegaste al máximo de ${NODE_LIMITS.keywordsMax} palabras.` : 'Se guardan sin acentos ni mayúsculas. Separa varias con comas.'}
        </p>
      </div>
      <Button type="button" variant="outline" disabled={fresh.length === 0 || full} onClick={add}><Plus />Agregar</Button>
    </div>
    {keywords.length === 0
      ? <p className="text-sm text-muted-foreground">Sin palabras clave: el bot solo ofrece el menú cuando pasa el tiempo de inactividad.</p>
      : <ul aria-label="Palabras clave" className="flex flex-wrap gap-1.5">
        {keywords.map((word) => <li key={word} className="inline-flex h-7 items-center gap-0.5 rounded-full border bg-muted pr-0.5 pl-3 text-sm">
          {word}
          <button type="button" aria-label={`Quitar ${word}`} onClick={() => onChange(keywords.filter((item) => item !== word))}
            className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><X className="size-3.5" /></button>
        </li>)}
      </ul>}
    <p className="text-xs text-muted-foreground tabular-nums">{keywords.length}/{NODE_LIMITS.keywordsMax} palabras</p>
  </div>;
}
