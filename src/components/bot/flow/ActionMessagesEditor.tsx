'use client';

import { useState } from 'react';
import { MESSAGE_CATALOG, validateDefinition } from '@/modules/bot-config';
import type { BotActionKey, BotDefinition, BotMessageKey } from '@/types/bot';
import { ResponseEditor } from '../studio/ResponseEditor';
import type { FlowActions } from './flow-actions';
import { SELECT_CLASS } from './OptionRow';

const ACTION_MESSAGES: Partial<Record<BotActionKey, readonly BotMessageKey[]>> = {
  create_report: ['report_ack'],
  handoff: ['handoff_ack'],
  netflix_login_code: ['login_code_sent', 'login_not_found', 'account_picker_body', 'account_picker_button', 'no_netflix_account', 'already_sent', 'rate_limited', 'mailbox_unavailable'],
  netflix_travel_code: ['travel_code_sent', 'travel_link_sent', 'travel_not_found', 'profile_missing', 'account_picker_body', 'account_picker_button', 'no_netflix_account', 'already_sent', 'rate_limited', 'mailbox_unavailable'],
  service_access: ['access_none', 'access_picker_body', 'access_picker_button', 'access_code_notice', 'access_unavailable'],
};

/** Los mismos textos de Respuestas, editables donde se elige la acción. */
export function ActionMessagesEditor({ action, def, actions }: { action: BotActionKey | undefined; def: BotDefinition; actions: Pick<FlowActions, 'setMessage'> }) {
  const keys = action ? ACTION_MESSAGES[action] : undefined;
  const [selected, setSelected] = useState<BotMessageKey | undefined>(keys?.[0]);
  const key = keys?.find(candidate => candidate === selected) ?? keys?.[0];
  if (!key || !keys) return null;
  const issues = validateDefinition(def).filter(issue => issue.path === `messages.${key}`);
  return <section aria-label="Mensajes de la acción" className="space-y-3 border-t pt-3">
    {keys.length > 1 ? <label className="block text-sm font-medium">Respuesta de la acción
      <select className={SELECT_CLASS} value={key} onChange={event => setSelected(keys.find(candidate => candidate === event.target.value))}>
        {keys.map(candidate => <option key={candidate} value={candidate}>{MESSAGE_CATALOG[candidate].label}</option>)}
      </select>
    </label> : null}
    <ResponseEditor compact messageKey={key} value={def.messages[key]} issues={issues} onChange={text => actions.setMessage(key, text)} />
    <p className="text-xs text-muted-foreground">Se guarda en el borrador al escribir. Publica el recorrido para que los clientes vean el cambio. Este texto también se usa en las otras acciones del mismo tipo.</p>
  </section>;
}
