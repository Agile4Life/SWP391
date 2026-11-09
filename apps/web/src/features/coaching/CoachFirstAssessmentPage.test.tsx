import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachFirstAssessmentPage } from './CoachFirstAssessmentPage';

const mocks = vi.hoisted(() => ({ search: vi.fn(), metrics: vi.fn() }));
vi.mock('./firstAssessmentApi', () => ({ searchFirstAssessmentCandidates: mocks.search }));
vi.mock('./CoachHealthMetrics', () => ({
  CoachHealthMetrics: (props: { memberId: number; intakeOnly?: boolean }) => {
    mocks.metrics(props);
    return <div data-testid="metrics-form">member {props.memberId}</div>;
  },
}));

describe('CoachFirstAssessmentPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    mocks.search.mockReset(); mocks.metrics.mockReset();
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  async function render() { await act(async () => root.render(<CoachFirstAssessmentPage />)); }
  async function search(text: string) {
    const input = host.querySelector<HTMLInputElement>('#first-assessment-search')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  }

  it('asks for at least two characters before searching', async () => {
    await render();
    await search('a');
    expect(mocks.search).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('ít nhất 2 ký tự');
  });

  it('lists members without measurements and opens the intake form for the chosen one', async () => {
    mocks.search.mockResolvedValue([{ memberId: 10, membershipCode: 'MB-010', fullName: 'Nguyen Van A', phone: '0900000001' }]);
    await render();
    await search('Nguyen');
    expect(mocks.search).toHaveBeenCalledWith('Nguyen');
    expect(host.textContent).toContain('Nguyen Van A');
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === 'Đánh giá')!.click());
    expect(host.querySelector('[data-testid="metrics-form"]')?.textContent).toContain('member 10');
    // The first assessment never loads history: the unassigned coach is not allowed to read it.
    expect(mocks.metrics).toHaveBeenCalledWith(expect.objectContaining({ memberId: 10, intakeOnly: true }));
  });

  it('shows an empty and an error state', async () => {
    mocks.search.mockResolvedValueOnce([]);
    await render();
    await search('Nobody');
    expect(host.textContent).toContain('Không có hội viên nào chờ đánh giá');
    mocks.search.mockRejectedValueOnce(new Error('Không có quyền'));
    await search('Nobody');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không có quyền');
  });
});
