import { expect, it, vi } from 'vitest';
import type { ReportRealtimeStatus } from './customer-reports-realtime';

const fake = vi.hoisted(() => ({ on: vi.fn(), subscribe: vi.fn(), remove: vi.fn(async () => 'ok'), channel: vi.fn() }));
vi.mock('./client', () => ({ supabase: { channel: fake.channel, removeChannel: fake.remove } }));
import { subscribeToReportChanges } from './customer-reports-realtime';

it('listens only to reports, maps connection state and ignores callbacks after disposal', () => {
  let change: (() => void) | undefined;
  let status: ((value: string) => void) | undefined;
  const channel = { on: fake.on, subscribe: fake.subscribe };
  fake.channel.mockReturnValue(channel);
  fake.on.mockImplementation((_event: string, _filter: unknown, next: () => void) => { change = next; return channel; });
  fake.subscribe.mockImplementation((next: (value: string) => void) => { status = next; return channel; });
  const listener = { onChange: vi.fn(), onStatus: vi.fn<(status: ReportRealtimeStatus) => void>() };
  const cancel = subscribeToReportChanges(listener);
  expect(fake.on).toHaveBeenCalledWith('postgres_changes', { event: '*', schema: 'public', table: 'customer_reports' }, expect.any(Function));
  change?.(); status?.('SUBSCRIBED'); status?.('CHANNEL_ERROR'); status?.('TIMED_OUT'); status?.('CLOSED');
  expect(listener.onChange).toHaveBeenCalledOnce();
  expect(listener.onStatus.mock.calls.map(([value]) => value)).toEqual(['offline', 'live', 'offline', 'offline', 'offline']);
  cancel(); change?.(); status?.('SUBSCRIBED');
  expect(listener.onChange).toHaveBeenCalledOnce();
  expect(listener.onStatus).toHaveBeenCalledTimes(5);
  expect(fake.remove).toHaveBeenCalledWith(channel);
  cancel();
  expect(fake.remove).toHaveBeenCalledTimes(1);
});
it('keeps backup polling available when channel creation fails', () => {
  fake.channel.mockImplementationOnce(() => { throw new Error('connection unavailable'); });
  const listener = { onChange: vi.fn(), onStatus: vi.fn() };
  const cancel = subscribeToReportChanges(listener);
  expect(listener.onStatus).toHaveBeenCalledWith('offline');
  expect(listener.onChange).not.toHaveBeenCalled();
  cancel();
});
