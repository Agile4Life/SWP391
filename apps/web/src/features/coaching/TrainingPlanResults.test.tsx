import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TrainingPlanResults, type PlanResults } from './TrainingPlanResults';
import { apiFetch } from '../../shared/api/client';
vi.mock('../../shared/api/client',()=>({apiFetch:vi.fn()}));
let host:HTMLDivElement;let root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.mocked(apiFetch).mockResolvedValue({planId:1,exerciseDate:'2026-11-03',items:[]});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.resetAllMocks();vi.unstubAllGlobals();});
async function render(id=1){await act(async()=>root.render(<TrainingPlanResults planId={id}/>));}
it('renders authoritative completed and unfinished items',async()=>{vi.mocked(apiFetch).mockResolvedValue({planId:1,exerciseDate:'2026-11-03',items:[{itemId:5,exerciseName:'Squat',completed:true},{itemId:6,exerciseName:'Run',completed:false}]});await render();expect(host.textContent).toContain('1/2');expect(host.textContent).toContain('Squat · Đã hoàn thành');expect(host.textContent).toContain('Run · Chưa hoàn thành');expect(apiFetch).toHaveBeenCalledWith(expect.stringMatching(/^\/coaching\/training-plans\/1\/completions\?exerciseDate=/));});
it('shows GET error and retries rather than inventing results',async()=>{vi.mocked(apiFetch).mockRejectedValueOnce(new Error('forbidden'));await render();expect(host.querySelector('[role="alert"]')).not.toBeNull();await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Thử lại')!.click());expect(host.textContent).toContain('Không có bài tập');});
it('ignores old plan responses',async()=>{let finish!:(value:PlanResults)=>void;vi.mocked(apiFetch).mockImplementationOnce(()=>new Promise(r=>{finish=r;}));await render(1);await render(2);await act(async()=>finish({planId:1,exerciseDate:'2026-11-03',items:[{itemId:5,exerciseName:'Old member',completed:true}]}));expect(host.textContent).not.toContain('Old member');});

it('renders all plan exercises grouped by day and switches tabs', async () => {
  const dummyPlan = {
    id: 10,
    memberId: 5,
    memberName: 'Trần Nhật',
    goal: 'Tăng cơ giảm mỡ',
    startDate: '2026-11-14',
    endDate: '2026-12-14',
    status: 'active',
    items: [
      { id: 101, exerciseName: 'Barbell Squat', dayOfWeek: 1, sets: 4, reps: 10, restSeconds: 60, durationMinutes: null, description: 'Lưng thẳng' },
      { id: 102, exerciseName: 'Bench Press', dayOfWeek: 3, sets: 3, reps: 12, restSeconds: 45, durationMinutes: null, description: null },
    ],
  };
  await act(async () => root.render(<TrainingPlanResults plan={dummyPlan} planId={10} />));
  expect(host.textContent).toContain('Toàn bộ bài tập giáo án');
  expect(host.textContent).toContain('Thứ 2');
  expect(host.textContent).toContain('Barbell Squat');
  expect(host.textContent).toContain('4 hiệp × 10 lần');
  expect(host.textContent).toContain('Thứ 4');
  expect(host.textContent).toContain('Bench Press');

  // Switch to daily progress tab
  const dailyTab = host.querySelector('#tab-daily-progress') as HTMLButtonElement;
  await act(async () => dailyTab.click());
  expect(host.textContent).toContain('Ngày tập');
});
