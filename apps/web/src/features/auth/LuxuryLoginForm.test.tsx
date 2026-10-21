import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LuxuryLoginForm } from './LuxuryLoginForm';

let host: HTMLDivElement;
let root: Root;
let gisCallback: ((response: { credential: string }) => void) | undefined;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  gisCallback = undefined;
  window.history.replaceState({}, '', '/login');
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com');
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn((config) => {
          gisCallback = config.callback;
        }),
        renderButton: (parent) => {
          const button = document.createElement('button');
          button.textContent = 'Continue with Google';
          parent.replaceChildren(button);
        },
        // FedCM may suppress One Tap without calling its moment listener.
        prompt: vi.fn(),
        cancel: vi.fn(),
      },
    },
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete window.google;
  window.history.replaceState({}, '', '/');
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function renderForm() {
  await act(async () => root.render(<MemoryRouter><LuxuryLoginForm /></MemoryRouter>));
}

it('shows the official sign-in button even when One Tap never responds', async () => {
  await renderForm();
  const official = host.querySelector<HTMLElement>('#google-official-btn')!;
  expect(official.textContent).toContain('Continue with Google');
  expect(getComputedStyle(official).display).not.toBe('none');
});

it('offers Gmail OTP independently of the Google prompt and restores GIS after returning', async () => {
  await renderForm();
  const fallback = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Gmail OTP'));
  expect(fallback).toBeDefined();
  await act(async () => fallback!.click());
  expect(host.querySelector('input[type="email"]')).not.toBeNull();
  const back = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Quay lại'))!;
  await act(async () => back.click());
  expect(host.querySelector('#google-official-btn')?.textContent).toContain('Continue with Google');
});

it('transitions to email OTP verification screen when Google OAuth callback returns an ID token', async () => {
  const mockFetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {
        email: 'oauthuser@gmail.com',
        message: 'Đã gửi mã xác nhận đến gmail oauthuser@gmail.com. Hãy nhập mã xác nhận để kích hoạt tài khoản.',
        expiresInMinutes: 5,
        debugOtp: '654321',
      },
    }),
  });
  vi.stubGlobal('fetch', mockFetch);

  await renderForm();
  expect(gisCallback).toBeDefined();

  await act(async () => {
    gisCallback!({ credential: 'mock-google-id-token' });
  });

  expect(mockFetch).toHaveBeenCalledWith(
    '/api/v1/auth/google/oauth-callback',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ idToken: 'mock-google-id-token' }),
    }),
  );

  const otpInput = host.querySelector<HTMLInputElement>('#google-otp-code');
  expect(otpInput).not.toBeNull();
  expect(otpInput?.value).toBe('654321');
  expect(host.textContent).toContain('Xác thực tài khoản');
  expect(host.textContent).toContain('oauthuser@gmail.com');
});

it('opens email OTP verification screen automatically when redirected back from Google OAuth 2.0 callback URL', async () => {
  window.history.replaceState(
    {},
    '',
    '/login?google_oauth=callback&email=redirected%40gmail.com&message=Da+gui+OTP&debug_otp=998877',
  );

  await renderForm();

  const otpInput = host.querySelector<HTMLInputElement>('#google-otp-code');
  expect(otpInput).not.toBeNull();
  expect(otpInput?.value).toBe('998877');
  expect(host.textContent).toContain('Xác thực tài khoản');
  expect(host.textContent).toContain('redirected@gmail.com');
  expect(window.location.search).toBe('');
});


it('accepts legacy debugOtp and removes sensitive callback parameters from history', async () => {
  window.history.replaceState({}, '', '/login?google_oauth=callback&email=user%40gmail.com&debugOtp=123456&state=old-state&error=old-error');
  await renderForm();
  expect(host.querySelector<HTMLInputElement>('#google-otp-code')?.value).toBe('123456');
  expect(window.location.search).toBe('');
});
