import { legacySettingsKeys } from '@/modules/automation-control/contracts';
import { createAutomationControlStore } from '@/modules/automation-control/store';
import { createUserRequestClient } from '@/platform/server/supabase-server';
import { assertRpcStringId, assertUuid } from '@/platform/utils/safety';
import type { AutomationControlCommand } from '@/platform/api/automation-control-client';
import type { AutomationControl } from '@/types/automation-control';
import { notifyInterestUseCase } from './interest-notification-use-case';

export async function readAutomationControlUseCase(): Promise<AutomationControl> {
  const store = createAutomationControlStore();
  const [settings, interests, access, operations] = await Promise.all([store.settings(), store.interests(), store.access(), store.metrics()]);
  return { settings, interests, access, operations,
    health: { integrationConfigured: !!process.env.AUTOMATION_INTEGRATION_TOKEN },
    providers: [{ id: 'netflix', name: 'Netflix', loginCode: true, travelCode: true, verified: true }],
  };
}

export async function executeAutomationControlUseCase(input: AutomationControlCommand, authorization: string) {
  const client = createUserRequestClient(authorization);
  if (input.command === 'interest' && input.action === 'notify') return notifyInterestUseCase(input.id);
  if (input.command === 'access') assertUuid(input.serviceId, 'Cuenta');
  if (input.command === 'interest') assertUuid(input.id, 'Interés');
  const result = input.command === 'settings'
    ? await client.rpc('mt_update_automation_settings', { p_settings: { ...legacySettingsKeys, ...input.settings } })
    : input.command === 'access'
      ? await client.rpc('mt_set_service_access', { p_service_id: input.serviceId, p_mode: input.mode,
        p_rotation_confirmed: input.rotationConfirmed })
      : await client.rpc('mt_manage_interest', { p_id: input.id, p_action: input.action });
  if (result.error) throw new Error('No se pudo aplicar el cambio. Revisa el estado y vuelve a intentar.', { cause: result.error });
  return assertRpcStringId(result.data, 'Administrar automatización');
}
