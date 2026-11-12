import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletTopupHistory } from './WalletTopupHistory';

const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('./receptionApi', async (original) => ({
  ...await original<typeof import('./receptionApi')>(),
  receptionApi: { getCounterTopupHistory: mocks.history },
}));

describe('WalletTopupHistory', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    mocks.history.mockReset();
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it('lists the wallet top-ups the desk took', async () => {
    mocks.history.mockResolvedValue([
      { paymentId: 1, memberId: 5, membershipCode: 'MEM-111', memberName: 'Thịnh Lê', amount: 1000000, paymentMethod: 'cash', paidAt: '2026-11-12T22:50:00', receivedByName: 'Lễ Tân Trần Thu Hà' },
    ]);
    await act(async () => root.render(<WalletTopupHistory />));
    const text = host.textContent ?? '';
    expect(mocks.history).toHaveBeenCalledWith(30);
    expect(text).toContain('Lịch sử nạp tiền vào Ví SÖL');
    expect(text).toContain('Thịnh Lê');
    expect(text).toContain('MEM-111');
    expect(text).toContain('Tiền mặt');
    expect(text).toContain('Lễ Tân Trần Thu Hà');
    expect(text).toContain('1.000.000');
  });

  it('shows an empty state when nothing was topped up', async () => {
    mocks.history.mockResolvedValue([]);
    await act(async () => root.render(<WalletTopupHistory />));
    expect(host.textContent).toContain('Chưa có giao dịch nạp ví nào tại quầy');
  });
});
