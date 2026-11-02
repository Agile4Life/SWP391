import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffClassesPage } from './StaffClassesPage';
import * as clientModule from '../../shared/api/client';
import { classesApi } from './classesApi';
import type { Discipline } from '../manager/catalogApi';

describe('StaffClassesPage (SCRUM-131 & Catalog Resilience)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const sampleClasses = [
    {
      id: 101,
      name: 'Morning Yoga Flow',
      disciplineId: 1,
      disciplineName: 'Mindful Yoga',
      coachId: 10,
      coachName: 'HLV Nguyễn Minh Quân',
      roomId: 2,
      roomName: 'Studio A',
      capacity: 15,
      level: 'all',
      status: 'active',
    },
  ];

  const sampleSessions = [
    {
      id: 501,
      classId: 101,
      className: 'Morning Yoga Flow',
      disciplineId: 1,
      disciplineName: 'Mindful Yoga',
      coachId: 10,
      coachName: 'HLV Nguyễn Minh Quân',
      roomId: 2,
      roomName: 'Studio A',
      sessionDate: '2026-11-10',
      startTime: '08:00:00',
      endTime: '09:30:00',
      capacity: 15,
      bookedCount: 3,
      availableSeats: 12,
      status: 'scheduled',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });

    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.spyOn(classesApi, 'getClasses').mockResolvedValue(sampleClasses);
    vi.spyOn(classesApi, 'getSessions').mockResolvedValue(sampleSessions);
    vi.spyOn(classesApi, 'getDisciplines').mockResolvedValue([{ id: 1, name: 'Mindful Yoga', description: '' }]);
    vi.spyOn(classesApi, 'getAvailableRooms').mockResolvedValue([
      { id: 2, name: 'Studio A', capacity: 20, status: 'available' },
    ]);
    vi.spyOn(classesApi, 'getActiveCoaches').mockResolvedValue([
      { id: 10, fullName: 'HLV Nguyễn Minh Quân', email: 'coach@scms.local', status: 'active' },
    ]);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const openForm = async () => {
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({
      id: 1,
      name: 'Quản lý Trung tâm',
      email: 'manager@scms.local',
      role: 'MANAGER',
      token: 'fake-jwt',
    });
    await act(async () => {
      root.render(<StaffClassesPage />);
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="create-class-button"]')!.click();
    });
  };

  it('hides create, edit, reschedule, and delete buttons for Receptionist (STAFF role)', async () => {
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({
      id: 2,
      name: 'Lễ tân Lan',
      email: 'reception@scms.local',
      role: 'STAFF',
      token: 'fake-jwt',
    });

    await act(async () => {
      root.render(<StaffClassesPage />);
    });

    expect(host.textContent).toContain('Morning Yoga Flow');
    expect(host.querySelector('[data-testid="read-only-schedule-badge"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="create-class-button"]')).toBeNull();
    expect(host.querySelector('[data-testid="edit-class-101"]')).toBeNull();
    expect(host.querySelector('[data-testid="reschedule-class-101"]')).toBeNull();
    expect(host.querySelector('[data-testid="delete-class-101"]')).toBeNull();
    expect(host.querySelector('[data-testid="view-class-101"]')).not.toBeNull();
  });

  it('shows edit, reschedule, and 2-step double confirm delete for Manager (MANAGER role)', async () => {
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({
      id: 1,
      name: 'Quản lý Trung tâm',
      email: 'manager@scms.local',
      role: 'MANAGER',
      token: 'fake-jwt',
    });
    const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(undefined);

    await act(async () => {
      root.render(<StaffClassesPage />);
    });

    expect(host.textContent).toContain('Morning Yoga Flow');
    expect(host.querySelector('[data-testid="create-class-button"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="edit-class-101"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="reschedule-class-101"]')).not.toBeNull();

    const deleteBtn = host.querySelector('[data-testid="delete-class-101"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    // Click Delete -> opens Step 1 of Double Confirm
    await act(async () => {
      deleteBtn.click();
    });
    expect(document.body.querySelector('[data-testid="delete-step-1-box"]')).not.toBeNull();
    expect(apiFetchSpy).not.toHaveBeenCalled();

    // Click Step 1 confirm -> transitions to Step 2
    const step1Btn = document.body.querySelector('[data-testid="delete-confirm-step1-btn"]') as HTMLButtonElement;
    expect(step1Btn).not.toBeNull();
    await act(async () => {
      step1Btn.click();
    });
    expect(document.body.querySelector('[data-testid="delete-step-2-box"]')).not.toBeNull();
    expect(apiFetchSpy).not.toHaveBeenCalled();

    // Click Step 2 confirm -> calls DELETE /classes/101
    const step2Btn = document.body.querySelector('[data-testid="delete-confirm-step2-btn"]') as HTMLButtonElement;
    expect(step2Btn).not.toBeNull();
    await act(async () => {
      step2Btn.click();
    });
    expect(apiFetchSpy).toHaveBeenCalledWith('/classes/101', { method: 'DELETE' });
  });

  it('keeps catalog fields pending until their request resolves and then reveals the form immediately', async () => {
    let resolveDisciplines!: (value: Discipline[]) => void;
    vi.spyOn(classesApi, 'getDisciplines').mockReturnValue(
      new Promise((resolve) => {
        resolveDisciplines = resolve;
      }),
    );
    await openForm();
    expect(host.querySelector('dialog [aria-busy="true"]')).not.toBeNull();
    expect(host.querySelector('#class-discipline')).toBeNull();

    await act(async () => resolveDisciplines([{ id: 7, name: 'Yoga đã tải', description: '' }]));
    expect(host.querySelector('dialog [aria-busy="true"]')).toBeNull();
    expect(host.querySelector('#class-discipline')?.parentElement?.querySelector('select')?.textContent).toContain(
      'Yoga đã tải',
    );
  });

  it('shows catalog failure with retry instead of an apparently empty creation form', async () => {
    vi.spyOn(classesApi, 'getDisciplines').mockRejectedValueOnce(new Error('Mất kết nối danh mục'));
    await openForm();
    expect(host.querySelector('dialog [role="alert"]')?.textContent).toContain('Mất kết nối danh mục');
    expect(host.querySelector('#class-discipline')).toBeNull();

    const retry = [...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(
      (button) => button.textContent === 'Thử lại',
    )!;
    await act(async () => retry.click());
    expect(host.querySelector('#class-discipline')?.parentElement?.querySelector('select')?.textContent).toContain(
      'Mindful Yoga',
    );
  });
});
