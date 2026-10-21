import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LuxuryLoginForm } from './LuxuryLoginForm';

let host: HTMLDivElement;
let root: Root;
let oauthCallback: ((response: { access_token?: string }) => void) | undefined;
const requestAccessToken = vi.fn();

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  oauthCallback = undefined;
  requestAccessToken.mockReset();
  window.history.replaceState({}, '', '/login');
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com');
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn((config) => {
          oauthCallback = config.callback;
          return { requestAccessToken };
        }),
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderForm() {
  await act(async () => root.render(<MemoryRouter><LuxuryLoginForm /></MemoryRouter>));
}

it('shows exactly one Google sign-in button with the requested label', async () => {
  await renderForm();
  const buttons = [...host.querySelectorAll('button')].filter((button) => /google|gmail/i.test(button.textContent || ''));
  expect(buttons).toHaveLength(1);
  expect(buttons[0].textContent?.trim()).toBe('Đăng nhập bằng Google');
  expect(host.querySelector('#google-official-btn')).toBeNull();
  await act(async () => buttons[0].click());
  expect(requestAccessToken).toHaveBeenCalledWith({ prompt: 'select_account' });
});

it('transitions to email OTP verification screen when the single Google button returns an access token', async () => {
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
  await act(async () => host.querySelector<HTMLButtonElement>('#google-oauth-btn')!.click());
  expect(oauthCallback).toBeDefined();
  await act(async () => {
    oauthCallback!({ access_token: 'mock-google-access-token' });
  });

  expect(mockFetch).toHaveBeenCalledWith(
    '/api/v1/auth/google/oauth-callback',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ accessToken: 'mock-google-access-token' }),
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


it('returns to the single Google entry point when choosing another account', async () => {
  window.history.replaceState({}, '', '/login?google_oauth=callback&email=user%40gmail.com');
  await renderForm();
  const changeAccount = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Chọn tài khoản Google khác'))!;
  await act(async () => changeAccount.click());
  expect(host.querySelector('#google-otp-code')).toBeNull();
  expect(host.querySelector('input[type="email"]')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('#google-oauth-btn')!.click());
  expect(requestAccessToken).toHaveBeenCalledTimes(1);
});

it('shows a configuration error instead of introducing a separate Gmail flow', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
  await renderForm();
  await act(async () => host.querySelector<HTMLButtonElement>('#google-oauth-btn')!.click());
  expect(host.textContent).toContain('Google chưa được cấu hình');
  expect(host.querySelector('input[type="email"]')).toBeNull();
  expect(requestAccessToken).not.toHaveBeenCalled();
});
