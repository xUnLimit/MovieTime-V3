import { createAutomationControlStore } from '@/modules/automation-control/store';
import { intentSchema } from '@/modules/automation-control/contracts';
import { requestOpenAiIntent } from '@/platform/server/openai-intent';
import { createLogger } from '@/platform/observability/logger';
import type { AutomationIntent, AutomationSettings } from '@/types/automation-control';

type Dependencies = {
  settings(): Promise<AutomationSettings>;
  claimBudget(tokens: number): Promise<boolean>;
  interpret(text: string, model: string): Promise<unknown>;
};
const log = createLogger('AutomationIntent');

export async function suggestAutomationIntent(
  text: string, deps?: Dependencies,
  automatic = false,
): Promise<AutomationIntent | null> {
  // Avoid transferring credentials pasted by a customer to a model.
  if (!text.trim() || text.length > 2000 || /(?:contrase[ñn]a|password|pin|token|clave)\s*[:=]/i.test(text)) return null;
  try {
    const dependencies = deps ?? { ...createAutomationControlStore(), interpret: requestOpenAiIntent };
    const settings = await dependencies.settings();
    if (settings.aiMode === 'off' || (automatic && settings.aiMode !== 'queries')) return null;
    // Reserve a conservative worst-case input/output budget; failed calls still consume it.
    if (!await dependencies.claimBudget(4096)) return null;
    const result = intentSchema.safeParse(await dependencies.interpret(text, settings.model));
    if (!result.success || result.data.confidence < 0.75) return null;
    return result.data;
  } catch {
    log.warn('No se pudo interpretar la intención; se conserva el recorrido guiado.');
    return null;
  }
}
