import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffClassesPage } from './StaffClassesPage';
import * as clientModule from '../../shared/api/client';
import { classesApi } from './classesApi';

describe('StaffClassesPage (SCRUM-131: Quản lý Lớp học, Đổi lịch, Xóa 2 bước & Khóa quyền Lễ tân)', () => {
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
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.spyOn(classesApi, 'getClasses').mockResolvedValue(sampleClasses);
    vi.spyOn(classesApi, 'getSessions').mockResolvedValue(sampleSessions);
    vi.spyOn(classesApi, 'getDisciplines').mockResolvedValue([{ id: 1, name: 'Mindful Yoga' }]);
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
});
