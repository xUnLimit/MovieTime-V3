import { readApiResponse } from './client';
import type { AutomationControl, AutomationIntent, AutomationSettings } from '@/types/automation-control';

export async function getAutomationControl(token: string): Promise<AutomationControl> {
  return readApiResponse<AutomationControl>(await fetch('/api/automations/control', {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  }));
}
export async function postAutomationControl<T>(token: string, command: unknown): Promise<T> {
  return readApiResponse<T>(await fetch('/api/automations/control', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  }));
}
export type AutomationControlCommand =
  | { command: 'settings'; settings: AutomationSettings }
  | { command: 'access'; serviceId: string; mode: 'password' | 'code'; rotationConfirmed: boolean }
  | { command: 'interest'; id: string; action: 'pause' | 'resume' | 'cancel' | 'notify' }
  | { command: 'simulate'; text: string };
export type AutomationSimulation = AutomationIntent | null;
