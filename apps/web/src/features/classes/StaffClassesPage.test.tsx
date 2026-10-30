import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffClassesPage } from './StaffClassesPage';
import * as clientModule from '../../shared/api/client';
import { classesApi, type ClassItem, type ClassSessionDto } from './classesApi';

describe('StaffClassesPage (SCRUM-131 & SCRUM-132)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const sampleClasses: ClassItem[] = [
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
      status: 'ACTIVE',
    },
  ];

  const sampleSessions: ClassSessionDto[] = [
    {
      id: 501,
      classId: 101,
      sessionDate: '2026-11-10',
      startTime: '08:00:00',
      endTime: '09:30:00',
      status: 'scheduled',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.spyOn(classesApi, 'getClasses').mockResolvedValue(sampleClasses);
    vi.spyOn(classesApi, 'getSessions').mockResolvedValue(sampleSessions);
    vi.spyOn(classesApi, 'getDisciplines').mockResolvedValue([
      { id: 1, name: 'Mindful Yoga', description: 'Yoga tĩnh tâm' },
    ]);
    vi.spyOn(classesApi, 'getAvailableRooms').mockResolvedValue([
      { id: 2, name: 'Studio A', capacity: 20, location: 'Tầng 2', status: 'available' },
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

  it('hides create, edit, reschedule, and delete buttons for Receptionist (STAFF role)', async () => {
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({
      id: '2',
      name: 'Lễ tân Lan',
      identifier: 'reception@scms.local',
      role: 'STAFF',
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
      id: '1',
      name: 'Quản lý Trung tâm',
      identifier: 'manager@scms.local',
      role: 'MANAGER',
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

    // Click Delete -> opens Step 1 of Double Confirm (in document.body via Modal portal or host)
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

  it('SCRUM-132: blocks and warns Manager on form when room or coach has overlapping schedule', async () => {
    vi.spyOn(clientModule, 'getCurrentUser').mockReturnValue({
      id: '1',
      name: 'Quản lý Trung tâm',
      identifier: 'manager@scms.local',
      role: 'MANAGER',
    });

    vi.spyOn(classesApi, 'getClasses').mockResolvedValue([
      ...sampleClasses,
      {
        id: 102,
        name: 'Power Boxing',
        disciplineId: 1,
        disciplineName: 'Mindful Yoga',
        coachId: 10,
        coachName: 'HLV Nguyễn Minh Quân',
        roomId: 2,
        roomName: 'Studio A',
        capacity: 15,
        level: 'all',
        status: 'ACTIVE',
      },
    ]);

    vi.spyOn(classesApi, 'getSessions').mockResolvedValue([
      ...sampleSessions,
      {
        id: 502,
        classId: 102,
        sessionDate: '2026-11-10',
        startTime: '08:30:00',
        endTime: '10:00:00',
        status: 'scheduled',
      },
    ]);

    await act(async () => {
      root.render(<StaffClassesPage />);
    });

    const rescheduleBtn = host.querySelector('[data-testid="reschedule-class-102"]') as HTMLButtonElement;
    expect(rescheduleBtn).not.toBeNull();

    await act(async () => {
      rescheduleBtn.click();
    });

    const warningBanner = document.body.querySelector('[data-testid="reschedule-conflict-warning"]');
    expect(warningBanner).not.toBeNull();
    expect(warningBanner?.textContent).toContain('Trùng lịch phòng tập');
    expect(warningBanner?.textContent).toContain('Morning Yoga Flow');

    const submitRescheduleBtn = document.body.querySelector('[data-testid="submit-reschedule-button"]') as HTMLButtonElement;
    expect(submitRescheduleBtn.disabled).toBe(true);
  });
});
