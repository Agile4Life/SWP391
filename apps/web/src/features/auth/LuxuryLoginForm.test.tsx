import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LuxuryLoginForm } from './LuxuryLoginForm';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com');
  window.google = { accounts: { id: {
    initialize: vi.fn(),
    renderButton: (parent) => {
      const button = document.createElement('button');
      button.textContent = 'Continue with Google';
      parent.replaceChildren(button);
    },
    // FedCM may suppress One Tap without calling its moment listener.
    prompt: vi.fn(),
    cancel: vi.fn(),
  } } };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete window.google;
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
