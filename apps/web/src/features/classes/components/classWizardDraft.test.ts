import { afterEach, describe, expect, it } from 'vitest';
import { CLASS_WIZARD_DRAFT_KEY, clearClassWizardDraft, readClassWizardDraft, writeClassWizardDraft } from './classWizardDraft';

const sample = {
  step: 2, disciplineId: '1', name: 'A', level: 'all', price: '0', description: '', startDate: '2026-12-10',
  sessionCount: '12', recurringDays: ['THURSDAY'], autoAddedDay: 'THURSDAY', slotCode: 'SLOT_1',
  roomId: '10', coachId: '5', capacity: '14',
};

describe('classWizardDraft', () => {
  afterEach(() => localStorage.clear());

  it('round-trips a draft and clears it', () => {
    writeClassWizardDraft(sample);
    expect(readClassWizardDraft()).toMatchObject(sample);
    clearClassWizardDraft();
    expect(readClassWizardDraft()).toBeNull();
  });

  it('drops corrupt or malformed drafts', () => {
    localStorage.setItem(CLASS_WIZARD_DRAFT_KEY, '{not json');
    expect(readClassWizardDraft()).toBeNull();
    localStorage.setItem(CLASS_WIZARD_DRAFT_KEY, JSON.stringify({ ...sample, recurringDays: 'THURSDAY', savedAt: 'x' }));
    expect(readClassWizardDraft()).toBeNull();
    expect(localStorage.getItem(CLASS_WIZARD_DRAFT_KEY)).toBeNull();
  });
});
