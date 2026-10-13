import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberCardPage } from './MemberCardPage';
import { getProfile } from './profileApi';
import { getMySubscription } from './memberCardApi';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

vi.mock('./profileApi', () => ({ getProfile: vi.fn() }));
vi.mock('./memberCardApi', () => ({ getMySubscription: vi.fn() }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn() } }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));

const profile = { fullName: 'Nguyễn Minh', membershipCode: 'MB-01' };
const subscription = { id: 1, packageName: 'SÖL Gold', startDate: '2026-01-01', endDate: '2099-12-31', status: 'active', qrCode: 'backend-qr' };
let host: HTMLDivElement;
let root: Root;

async function renderPage() {
  await act(async () => { root.render(<MemberCardPage />); });
}

async function finishQrLoading() {
  const image = host.querySelector('img[alt="Mã QR check-in của hội viên"]');
  expect(image).not.toBeNull();
  await act(async () => { image?.dispatchEvent(new Event('load')); });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(getProfile).mockResolvedValue(profile as never);
  vi.mocked(getMySubscription).mockResolvedValue(subscription as never);
  vi.mocked(QRCode.toDataURL).mockResolvedValue('data:image/png;base64,AA' as never);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

describe('MemberCardPage', () => {
  it('shows a real active card and renders the backend QR value', async () => {
    vi.mocked(QRCode.toDataURL).mockResolvedValue('https://example.invalid/qr.png' as never);
    await renderPage();
    expect(host.textContent).toContain('Nguyễn Minh');
    expect(host.textContent).toContain('SÖL Gold');
    expect(host.textContent).toContain('Ngày bắt đầu: 01/01/2026');
    expect(vi.mocked(QRCode.toDataURL).mock.calls[0][0]).toBe('backend-qr');
    expect(host.querySelector('img[alt="Mã QR check-in của hội viên"]')).not.toBeNull();
    expect(host.querySelector('button')?.disabled).toBe(true);
    await finishQrLoading();
    expect(host.querySelector('button')?.disabled).toBe(false);
  });

  it.each([
    [{ ...subscription, status: 'pending_payment' }, 'Gói tập chưa hoạt động'],
    [{ ...subscription, endDate: '2020-01-01' }, 'Gói tập đã hết hạn'],
    [{ ...subscription, qrCode: null }, 'Chưa có mã QR hợp lệ'],
  ])('hides QR and download for invalid subscription', async (value, message) => {
    vi.mocked(getMySubscription).mockResolvedValue(value as never);
    await renderPage();
    expect(host.textContent).toContain(message);
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('button')?.disabled).toBe(true);
  });

  it('shows an empty state only for a successful null response', async () => {
    vi.mocked(getMySubscription).mockResolvedValue(null);
    await renderPage();
    expect(host.textContent).toContain('Chưa có gói tập');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/#packages');
    expect(host.querySelector('a')?.textContent).toBe('Xem gói tập');
  });

  it('shows API errors and retries the request', async () => {
    vi.mocked(getMySubscription).mockRejectedValueOnce(new Error('server down')).mockResolvedValueOnce(subscription as never);
    await renderPage();
    expect(host.textContent).toContain('Không thể tải');
    await act(async () => { host.querySelector('button')?.click(); });
    expect(getMySubscription).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('SÖL Gold');
  });

  it('downloads only after QR generation succeeds', async () => {
    vi.mocked(QRCode.toDataURL).mockResolvedValue('https://example.invalid/qr.png' as never);
    vi.mocked(html2canvas).mockResolvedValue({ toDataURL: () => 'data:image/png;base64,AA' } as never);
    await renderPage();
    await act(async () => { host.querySelector('button')?.click(); });
    expect(html2canvas).not.toHaveBeenCalled();
    await finishQrLoading();
    await act(async () => { host.querySelector('button')?.click(); });
    expect(html2canvas).toHaveBeenCalledTimes(1);
  });

  it('reports a download failure and allows another attempt', async () => {
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error('canvas failure'));
    await renderPage();
    await finishQrLoading();
    await act(async () => { host.querySelector('button')?.click(); });
    expect(document.querySelector('.sol-toast--error')?.textContent).toContain('Không thể tải thẻ');
    expect(host.querySelector('button')?.disabled).toBe(false);
  });

  it('shows a warning when fewer than seven days remain', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 6);
    const date = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    vi.mocked(getMySubscription).mockResolvedValue({ ...subscription, endDate: date } as never);
    await renderPage();
    expect(host.textContent).toContain('Gói tập sắp hết hạn');
    expect(host.querySelector('img')).not.toBeNull();
  });

  it('shows a QR error and keeps download disabled if image generation fails', async () => {
    vi.mocked(QRCode.toDataURL).mockRejectedValueOnce(new Error('QR failure'));
    await renderPage();
    expect(host.textContent).toContain('Không thể hiển thị mã QR');
    expect(host.querySelector('button')?.disabled).toBe(true);
  });

  it('keeps download disabled when the QR image itself fails to load', async () => {
    await renderPage();
    const image = host.querySelector('img[alt="Mã QR check-in của hội viên"]');
    await act(async () => { image?.dispatchEvent(new Event('error')); });
    expect(host.textContent).toContain('Không thể hiển thị mã QR');
    expect(host.querySelector('button')?.disabled).toBe(true);
  });
});
