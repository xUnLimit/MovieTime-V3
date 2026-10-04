import { getCurrentSession } from '@/platform/supabase/auth';
import { getAutomationControl, postAutomationControl, type AutomationControlCommand,
  type AutomationSimulation } from '@/platform/api/automation-control-client';
import type { AutomationSettings } from '@/types/automation-control';
import { assertOnlineMutation } from '@/platform/utils/online-mutation';

async function accessToken(): Promise<string> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Inicia sesión para administrar las automatizaciones.');
  return session.access_token;
}
export async function fetchAutomationControlUseCase() {
  return getAutomationControl(await accessToken());
}
async function command<T>(input: AutomationControlCommand): Promise<T> {
  assertOnlineMutation();
  return postAutomationControl<T>(await accessToken(), input);
}
export function updateAutomationSettingsUseCase(settings: AutomationSettings) {
  return command<string>({ command: 'settings', settings });
}
export function updateServiceAccessUseCase(input: { serviceId: string; mode: 'password' | 'code'; rotationConfirmed: boolean }) {
  return command<string>({ command: 'access', ...input });
}
export function updateInterestUseCase(input: { id: string; action: 'pause' | 'resume' | 'cancel' | 'notify' }) {
  return command<string>({ command: 'interest', ...input });
}
export function simulateAutomationIntentUseCase(text: string) {
  return command<AutomationSimulation>({ command: 'simulate', text });
}
