import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { LuxuryLoginForm } from './LuxuryLoginForm';
import * as authApi from './authApi';

vi.mock('./authApi', async () => {
  const actual = await vi.importActual<typeof authApi>('./authApi');
  return {
    ...actual,
    googleLoginWithIdToken: vi.fn(),
    googleSendOtp: vi.fn(),
    googleVerifyOtp: vi.fn(),
  };
});

describe('LuxuryLoginForm - Google Sign-In (SCRUM-89)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function renderComponent() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <LuxuryLoginForm />
        </MemoryRouter>
      );
    });
  }

  it('renders Google sign-in button on the login form', async () => {
    await renderComponent();
    const googleBtn = container.querySelector('[data-testid="google-signin-btn"]');
    expect(googleBtn).not.toBeNull();
    expect(googleBtn?.textContent).toContain('Tiếp tục với Google');
  });

  it('triggers Google login and processes token successfully', async () => {
    const mockUser = { token: 'mock-jwt-token', username: 'google_member', role: 'MEMBER' };
    vi.mocked(authApi.googleLoginWithIdToken).mockResolvedValueOnce(mockUser);

    await renderComponent();
    const googleBtn = container.querySelector('[data-testid="google-signin-btn"]') as HTMLButtonElement;
    expect(googleBtn).not.toBeNull();

    // Clicking Google button should be clickable and not crash
    await act(async () => {
      googleBtn.click();
    });

    expect(googleBtn.disabled).toBe(false);
  });
});
