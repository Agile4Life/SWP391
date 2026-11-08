import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { subscribeMembershipChanges } from './membershipRealtime';
import { apiFetch } from '../../shared/api/client';

const fake = vi.hoisted(() => {
  const on = vi.fn();
  const subscribe = vi.fn();
  return {
    on,
    subscribe,
    removeAllChannels: vi.fn(),
    disconnect: vi.fn(),
    channel: vi.fn(),
    createClient: vi.fn(),
  };
});

vi.mock('../../shared/api/client', () => ({ apiFetch: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: fake.createClient }));

let dispose = () => {};

beforeEach(() => {
  fake.on.mockReturnValue({ subscribe: fake.subscribe });
  fake.subscribe.mockReturnValue({});
  fake.channel.mockReturnValue({ on: fake.on });
  fake.removeAllChannels.mockResolvedValue([]);
  fake.createClient.mockReturnValue({
    realtime: { disconnect: fake.disconnect },
    channel: fake.channel,
    removeAllChannels: fake.removeAllChannels,
  });
});

afterEach(() => {
  dispose();
  vi.clearAllMocks();
});

it('treats disabled Realtime configuration on VPS PostgreSQL as optional and auto-polls without reporting unavailable', async () => {
  vi.useFakeTimers();
  try {
    vi.mocked(apiFetch).mockResolvedValue({ enabled: false, url: '', publishableKey: '', topic: 'membership:test' });
    const changed = vi.fn();
    const unavailable = vi.fn();

    dispose = subscribeMembershipChanges(changed, unavailable);
    await vi.advanceTimersByTimeAsync(0);

    expect(unavailable).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(fake.createClient).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4000);
    expect(changed).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(changed).toHaveBeenCalledTimes(3);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it('cleans up failed channel and reconnects on focus/online when Realtime is enabled', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    enabled: true,
    url: 'https://test.supabase.co',
    publishableKey: 'sb_publishable_test',
    topic: 'membership:test',
  });
  const changed = vi.fn();
  const unavailable = vi.fn();

  dispose = subscribeMembershipChanges(changed, unavailable);
  await Promise.resolve();

  expect(fake.createClient).toHaveBeenCalledTimes(1);
  fake.subscribe.mock.calls[0][0]('CHANNEL_ERROR');
  expect(unavailable).toHaveBeenCalledTimes(1);
  expect(fake.disconnect).toHaveBeenCalledTimes(1);

  window.dispatchEvent(new Event('online'));
  await Promise.resolve();
  expect(fake.createClient).toHaveBeenCalledTimes(2);
  fake.subscribe.mock.calls[1][0]('SUBSCRIBED');
  expect(changed).toHaveBeenCalledTimes(1);
});
