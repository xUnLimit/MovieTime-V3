'use client';

import { useMemo } from 'react';

import { useChatSavedMessages } from '@/hooks/use-chat-saved-messages';
import { useTemplates } from '@/hooks/use-templates';
import type { VentaMessageContext } from '@/platform/utils/whatsapp-template-render';

import { buildSlashItems, type SlashItem } from './chat-slash';

// Solo "/palabra" sin espacios activa el popup: una barra en medio de una
// frase (p. ej. una URL) sigue siendo texto normal.
export function useSlashItems(draft: string, context: VentaMessageContext | null, fallbackName: string): { items: SlashItem[]; term: string | null } {
  const match = /^\/(\S*)$/.exec(draft);
  const active = match !== null;
  const term = match?.[1] ?? null;
  const { data: savedMessages = [] } = useChatSavedMessages(active);
  const { data: tipos = [] } = useTemplates();
  const items = useMemo(
    () => (active ? buildSlashItems({ term: term ?? '', savedMessages, tipos, context, fallbackName }) : []),
    [active, term, savedMessages, tipos, context, fallbackName],
  );
  return { items, term };
}
