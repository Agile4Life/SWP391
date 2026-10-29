import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

it('does not register a worker during development', async () => {
  vi.stubEnv('PROD', false);
  const register = vi.fn();
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
  const { registerPwa } = await import('./registerPwa');
  await registerPwa();
  expect(register).not.toHaveBeenCalled();
});

it('announces an update but activates it only after user action', async () => {
  vi.stubEnv('PROD', true);
  const waiting = { postMessage: vi.fn() };
  const registration = Object.assign(new EventTarget(), { waiting, installing: null, update: vi.fn().mockResolvedValue(undefined) });
  const container = Object.assign(new EventTarget(), { controller: {}, register: vi.fn().mockResolvedValue(registration) });
  const listen = vi.spyOn(container, 'addEventListener');
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
  const { registerPwa, applyPwaUpdate, getWaitingRegistration, subscribePwaUpdate } = await import('./registerPwa');
  const onUpdate = vi.fn();
  const unsubscribe = subscribePwaUpdate(onUpdate);
  await registerPwa();
  expect(container.register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  expect(onUpdate).toHaveBeenCalledOnce();
  expect(getWaitingRegistration()).toBe(registration);
  expect(waiting.postMessage).not.toHaveBeenCalled();
  expect(applyPwaUpdate()).toBe(true);
  expect(listen).toHaveBeenCalledWith('controllerchange', expect.any(Function), { once: true });
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  unsubscribe();
});

it('does not offer a first installation as an update and tolerates blocked registration', async () => {
  vi.stubEnv('PROD', true);
  const registration = Object.assign(new EventTarget(), { waiting: { postMessage: vi.fn() }, installing: null });
  const container = { controller: null, register: vi.fn().mockRejectedValueOnce(new Error('blocked')).mockResolvedValueOnce(registration) };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
  const { registerPwa, getWaitingRegistration, applyPwaUpdate } = await import('./registerPwa');
  await expect(registerPwa()).resolves.toBeUndefined();
  await registerPwa();
  expect(getWaitingRegistration()).toBeNull();
  expect(applyPwaUpdate()).toBe(false);
});
