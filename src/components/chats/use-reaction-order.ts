'use client';

import { useCallback, useState } from 'react';

import { QUICK_REACTIONS } from './chat-format';
import { bumpReaction, orderReactions, readReactionUsage, writeReactionUsage, type ReactionUsage } from './chat-reactions';

/**
 * Orden del selector de reacciones: el emoji que mas usas pasa al frente en todos los chats.
 * El conteo vive en este navegador (localStorage). Los emojis solo se dibujan al abrir el selector,
 * por eso leer el almacenamiento al montar no desajusta el HTML del servidor.
 */
export function useReactionOrder() {
  const [usage, setUsage] = useState<ReactionUsage>(readReactionUsage);

  const record = useCallback((emoji: string) => {
    if (!emoji) return;
    setUsage((current) => {
      const next = bumpReaction(current, emoji);
      writeReactionUsage(next);
      return next;
    });
  }, []);

  return { emojis: orderReactions(QUICK_REACTIONS, usage), record };
}
