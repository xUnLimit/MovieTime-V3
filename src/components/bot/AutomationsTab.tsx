'use client';

import { useAutomations } from '@/hooks/use-automations';
import { AutomationsView } from './AutomationsView';

// Se monta solo con la pestaña activa, así sus consultas no se hacen mientras no se mira.
export function AutomationsTab() {
  return <AutomationsView api={useAutomations()} />;
}
