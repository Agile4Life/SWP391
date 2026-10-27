import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiApi } from './aiApi';

describe('aiApi errors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not report a successful recommendation or save when the server fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: 'Server error' }), { status: 500 })));
    await expect(aiApi.generateWorkoutPlan({ memberId: 1 })).rejects.toThrow('Server error');
    await expect(aiApi.saveTrainingPlan({ memberId: 1, title: 'Plan', goal: 'Goal', startDate: '2026-10-19', endDate: '2026-10-25', items: [] })).rejects.toThrow('Server error');
  });
});
