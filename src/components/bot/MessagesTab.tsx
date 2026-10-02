'use client';

import { MESSAGE_CATALOG, VARIABLE_CATALOG, renderTemplate, setMessage } from '@/modules/bot-config';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { BotAdminApi, BotMessageKey } from '@/types/bot';
import { BotState } from './BotState';

const values = Object.fromEntries(Object.entries(VARIABLE_CATALOG).map(([key, variable]) => [key, variable.example]));

export function MessagesTab({ api }: { api: BotAdminApi }) {
  return <BotState api={api} empty={!api.draft}><div className="space-y-5">
    {(['netflix', 'sistema'] as const).map(group => <section key={group} className="space-y-3" aria-label={group === 'netflix' ? 'Mensajes de Netflix' : 'Mensajes del sistema'}>
      <h2 className="text-base font-semibold">{group === 'netflix' ? 'Netflix' : 'Sistema'}</h2>
      <div className="grid gap-3 lg:grid-cols-2">{(Object.entries(MESSAGE_CATALOG) as [BotMessageKey, typeof MESSAGE_CATALOG[BotMessageKey]][]).filter(([, item]) => item.group === group).map(([key, item]) => {
        const message = api.draft?.messages[key] ?? '';
        return <Panel key={key} title={item.label} description={item.description} actions={<Button variant="outline" size="sm" onClick={() => api.updateDraft(current => setMessage(current, key, item.defaultText))}>Restablecer</Button>}>
          <div className="space-y-2"><label className="block text-sm font-medium">Texto de {item.label}<Textarea value={message} maxLength={item.maxLength} onChange={event => api.updateDraft(current => setMessage(current, key, event.target.value))} /></label>
            <p className="text-xs text-muted-foreground">{message.length}/{item.maxLength} caracteres</p>
            {item.variables.length > 0 ? <div className="flex flex-wrap gap-1" aria-label={`Marcadores de ${item.label}`}>{item.variables.map(variable => <Button key={variable} size="sm" variant="outline" onClick={() => api.updateDraft(current => setMessage(current, key, `${current.messages[key]}{{${variable}}}`))}>{VARIABLE_CATALOG[variable]?.label ?? variable} · {`{{${variable}}}`}</Button>)}</div> : null}
            <div className="rounded-md border bg-muted p-3"><p className="text-xs text-muted-foreground">Vista previa</p><p className="whitespace-pre-wrap break-words text-sm">{renderTemplate(message, values)}</p></div>
          </div>
        </Panel>;
      })}</div>
    </section>)}
  </div></BotState>;
}
