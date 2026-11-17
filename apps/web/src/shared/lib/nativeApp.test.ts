import { afterEach, expect, it, vi } from 'vitest';
import { isNativeApp } from './nativeApp';

afterEach(() => { vi.restoreAllMocks(); });

it('detects the iOS shell from the User-Agent marker', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 SOLiOSApp');
  expect(isNativeApp()).toBe(true);
});

it('treats a regular browser as web', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/604.1');
  expect(isNativeApp()).toBe(false);
});
