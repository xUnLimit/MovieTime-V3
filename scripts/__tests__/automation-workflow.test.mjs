import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = JSON.parse(readFileSync('integrations/n8n/demand-summary.workflow.json', 'utf8'));
describe('versioned external demand pilot', () => {
  it('is inactive, retains no executions and uses bounded HTTP requests without code nodes', () => {
    expect(workflow.active).toBe(false);
    expect(workflow.settings).toMatchObject({ executionTimeout: 240, saveDataErrorExecution: 'none',
      saveDataSuccessExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false });
    expect(workflow.pinData).toEqual({});
    for (const node of workflow.nodes.filter(node => node.type === 'n8n-nodes-base.httpRequest')) {
      expect(node.parameters.authentication).toBe('genericCredentialType');
      expect(node.parameters.genericAuthType).toBe('httpHeaderAuth');
      expect(node.parameters.options.timeout).toBe(12000);
      expect(node.parameters.options.redirect.redirect.followRedirects).toBe(false);
      expect(node.maxTries).toBe(3);
      expect(node.continueOnFail).toBeUndefined();
      expect(node.parameters.options.response?.response?.neverError).not.toBe(true);
    }
    expect(workflow.nodes.every(node => ['scheduleTrigger', 'httpRequest', 'splitOut'].some(type => node.type.endsWith(`.${type}`)))).toBe(true);
  });
  it('acknowledges only after target success and excludes the lease from external data', () => {
    expect(workflow.connections['Enviar resumen'].main[0][0].node).toBe('Confirmar recepción');
    const target = workflow.nodes.find(node => node.id === 'deliver-event');
    expect(target.parameters.jsonBody).not.toContain('token');
    expect(target.parameters.headerParameters.parameters[0]).toEqual({ name: 'Idempotency-Key', value: '={{ $json.event.id }}' });
    const commands = workflow.nodes.filter(node => ['poll-events', 'ack-event'].includes(node.id));
    expect(commands.every(node => node.parameters.url.includes('/api/automations/integrations'))).toBe(true);
    expect(commands.every(node => node.parameters.jsonBody.includes('demand-summary'))).toBe(true);
    expect(JSON.stringify(workflow)).not.toMatch(/service_role|SUPABASE|password|accessToken/);
  });
});
