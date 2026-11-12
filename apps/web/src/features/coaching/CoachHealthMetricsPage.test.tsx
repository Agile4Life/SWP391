import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CoachHealthMetricsPage } from './CoachHealthMetricsPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { setLanguage } from '../../shared/i18n/language';
import { aiApi, type MemberOption } from './aiApi';
import * as profileApi from '../member/profileApi';

vi.mock('../member/profileApi', () => ({ listHealthMetrics: vi.fn().mockResolvedValue([]), addHealthMetric: vi.fn().mockResolvedValue({}) }));

const MEMBERS: MemberOption[] = [
  { id: 1, memberCode: 'MB-2026-001', fullName: 'Lê Hoàng Long', fitnessGoal: 'Tăng cơ nạc', healthNotes: 'Bình thường', fitnessLevel: 'intermediate' },
  { id: 2, memberCode: 'MB-2026-014', fullName: 'Trần Thị Thu Thảo', fitnessGoal: 'Săn chắc cơ mông', healthNotes: 'Bình thường', fitnessLevel: 'beginner' },
];

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setLanguage('vi');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '3', name: 'HLV Marcus Vance', identifier: 'COACH-003', role: 'COACH' }));
  vi.spyOn(aiApi, 'getCoachMembers').mockResolvedValue(MEMBERS);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('records measurements for the selected member on its own tab', async () => {
  await act(async () => root.render(<CoachHealthMetricsPage />));
  expect(host.textContent).toContain('Lê Hoàng Long');
  const value = host.querySelector('#coach-metric-value') as HTMLInputElement;
  expect(value).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(value, '68');
    value.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => value.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(profileApi.addHealthMetric).toHaveBeenCalledWith(1, expect.objectContaining({ metricValue: 68 }));
});

it('shows an empty state when the coach has no members and a retry when the roster fails', async () => {
  vi.mocked(aiApi.getCoachMembers).mockResolvedValueOnce([]);
  await act(async () => root.render(<CoachHealthMetricsPage />));
  expect(host.textContent).toContain('Chưa có học viên để soạn giáo án');
  expect(host.querySelector('#coach-metric-value')).toBeNull();

  vi.mocked(aiApi.getCoachMembers).mockRejectedValueOnce(new Error('offline'));
  await act(async () => root.render(<CoachHealthMetricsPage key="again" />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải danh sách học viên');
});
