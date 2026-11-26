import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { Modal } from '../../../shared/ui/Modal';
import { Select } from '../../../shared/ui/Select';
import { DatePicker } from '../../../shared/ui/DatePicker';
import { useI18n } from '../../../shared/i18n';
import { formatCenterDate } from '../../../shared/lib/centerTime';
import { errorMessage } from '../../../shared/lib/errorMessage';
import { formatPrice } from '../../../shared/lib/membershipPresentation';
import type { Discipline, Room } from '../../manager/catalogApi';
import {
  SCHEDULE_SLOTS,
  findScheduleSlot,
  type ScheduleSlot,
  type ScheduleSlotCode,
} from '../../schedule/slots';
import { addDays, disciplineAccentColor, todayISO } from '../../schedule/timetable';
import {
  classesApi,
  type ClassItem,
  type ClassSessionDto,
  type CoachUser,
  type RecurringAvailabilityDto,
  type SlotAvailabilityDto,
} from '../classesApi';
import {
  CLASS_NAME_MAX_LENGTH,
  COURSE_SESSION_COUNT_MAX,
  computeCourseEndDate,
  daysForStartDate,
  validateCourseSessionCount,
  weekdayCodeOf,
  WIZARD_WEEKDAYS,
  formatRecurringDaysFull,
  formatRecurringDaysShort,
  pickDefaultCoachId,
  pickDefaultRoomAndCapacity,
  resolveWizardCoaches,
  resolveWizardRooms,
  sortRecurringDays,
  validateClassCapacity,
  validateWizardStep1,
  validateWizardStep2Advance,
  validateWizardStep2Local,
  validateWizardStep3,
} from './classWizardValidation';
import { clearClassWizardDraft, readClassWizardDraft, writeClassWizardDraft } from './classWizardDraft';

type WizardStep = 1 | 2 | 3 | 4;

/** Giờ lưu bản nháp dạng HH:mm dd/MM theo giờ máy người dùng. */
function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function ScheduleSlotPicker({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: ScheduleSlotCode;
  onChange: (code: ScheduleSlotCode) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="slot-picker-grid" role="group" aria-label={ariaLabel}>
      {SCHEDULE_SLOTS.map((slot) => {
        const active = slot.code === value;
        return (
          <button
            key={slot.code}
            type="button"
            data-testid={`slot-option-${slot.number}`}
            className={`slot-picker-btn${active ? ' is-active' : ''}`}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(slot.code)}
          >
            <strong className="slot-picker-btn__name">{slot.label}</strong>
            <span className="slot-picker-btn__time">{slot.rangeLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface CreateSlotPrefill {
  date?: string;
  startTime?: string;
  endTime?: string;
  roomId?: number;
  disciplineId?: number;
}

interface CreateClassOrSessionModalProps {
  prefill?: CreateSlotPrefill;
  classes: ClassItem[];
  disciplines: Discipline[];
  rooms: Room[];
  coaches: CoachUser[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/**
 * Hộp thoại tạo khóa học định kỳ theo quy trình 4 bước:
 * 1. Thông tin khóa học → 2. Lịch học & 5 Slot cố định (kiểm tra trùng lịch trực tiếp) →
 * 3. Phòng tập, sĩ số & HLV → 4. Xem lại & xác nhận.
 */
export function CreateClassOrSessionModal({
  prefill,
  classes,
  disciplines,
  rooms,
  coaches,
  onClose,
  onSuccess,
}: CreateClassOrSessionModalProps) {
  const { t } = useI18n();
  // Bản nháp còn lưu từ lần mở trước (đóng wizard giữa chừng không mất dữ liệu đã nhập).
  const [draft] = useState(() => readClassWizardDraft());
  // Bước 3–4 cần kiểm tra lại lịch trống nên bản nháp luôn mở lại tối đa ở Bước 2.
  const [step, setStep] = useState<WizardStep>(() => (draft ? (Math.min(draft.step, 2) as WizardStep) : 1));
  const [restoredAt, setRestoredAt] = useState<string | null>(draft?.savedAt ?? null);
  // Bước xa nhất đã tới: các tab bước đến mốc này bấm qua lại được tự do (đi tới vẫn kiểm tra hợp lệ từng bước).
  const [maxStep, setMaxStep] = useState<WizardStep>(step);
  useEffect(() => {
    setMaxStep((prev) => (step > prev ? step : prev));
  }, [step]);
  // Thẻ phòng/HLV không khả dụng đang mở lý do chi tiết (chỉ hiện khi bấm vào thẻ).
  const [openReason, setOpenReason] = useState<string | null>(null);
  const toggleReason = (key: string) => setOpenReason((prev) => (prev === key ? null : key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCountByDiscipline = useMemo(() => {
    const map = new Map<number, number>();
    for (const cls of classes) {
      if (String(cls.status).toLowerCase() === 'active') {
        map.set(cls.disciplineId, (map.get(cls.disciplineId) ?? 0) + 1);
      }
    }
    return map;
  }, [classes]);

  const defaultStart = prefill?.date ?? addDays(todayISO(), 14);
  const defaultDay = weekdayCodeOf(defaultStart);

  // Bước 1: Thông tin khóa học
  const [disciplineId, setDisciplineId] = useState(() => {
    if (draft && disciplines.some((d) => String(d.id) === draft.disciplineId)) return draft.disciplineId;
    if (prefill?.disciplineId && disciplines.some((d) => d.id === prefill.disciplineId)) {
      return String(prefill.disciplineId);
    }
    return disciplines[0]?.id ? String(disciplines[0].id) : '';
  });
  const [name, setName] = useState(draft?.name ?? '');
  const [level, setLevel] = useState(draft?.level ?? 'all');
  const [price, setPrice] = useState(draft?.price ?? '150000');
  const [description, setDescription] = useState(draft?.description ?? '');

  // Bước 2: Lịch học & 5 Slot cố định
  const [startDate, setStartDate] = useState(draft?.startDate ?? defaultStart);
  const [sessionCountInput, setSessionCountInput] = useState(draft?.sessionCount ?? '12');
  const [recurringDays, setRecurringDays] = useState<string[]>(draft?.recurringDays ?? [defaultDay]);
  // Thứ được thêm tự động vì là thứ khai giảng (người dùng chưa tự chọn); đổi ngày khai giảng thì gỡ lại thứ này.
  const [autoAddedDay, setAutoAddedDay] = useState<string | null>(draft ? draft.autoAddedDay : defaultDay);
  // Thứ của ngày khai giảng luôn là một ngày học (buổi đầu tiên), không được bỏ chọn.
  const startDayCode = startDate ? weekdayCodeOf(startDate) : '';
  const [selectedSlotCode, setSelectedSlotCode] = useState<ScheduleSlotCode>(() => {
    const fromDraft = SCHEDULE_SLOTS.find((slot) => slot.code === draft?.slotCode);
    if (fromDraft) return fromDraft.code;
    const matched = findScheduleSlot(prefill?.startTime, prefill?.endTime)
      ?? findScheduleSlot(prefill?.startTime);
    return matched?.code ?? SCHEDULE_SLOTS[0].code;
  });

  // Trạng thái kiểm tra lịch trống trực tiếp từ backend (gắn chữ ký đầu vào để vô hiệu hóa dữ liệu cũ ngay khi sửa lịch)
  const [availabilityState, setAvailabilityState] = useState<{
    key: string;
    data: RecurringAvailabilityDto;
  } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityRetryTick, setAvailabilityRetryTick] = useState(0);
  const [needsStep3Recheck, setNeedsStep3Recheck] = useState(false);
  const availabilityReqRef = useRef(0);

  // Bước 3: Phòng tập, sĩ số & HLV
  const [roomId, setRoomId] = useState(
    draft?.roomId ?? (prefill?.roomId ? String(prefill.roomId) : (rooms[0]?.id ? String(rooms[0].id) : '')),
  );
  const [coachId, setCoachId] = useState(draft?.coachId ?? (coaches[0]?.id ? String(coaches[0].id) : ''));
  const [capacity, setCapacity] = useState(() => {
    if (draft?.capacity) return draft.capacity;
    const initialRoom = rooms.find((r) => String(r.id) === String(prefill?.roomId ?? rooms[0]?.id));
    return String(initialRoom?.capacity ?? 15);
  });

  // Tự lưu bản nháp sau mỗi thay đổi; chỉ xóa khi tạo khóa thành công hoặc bấm "Bắt đầu lại".
  useEffect(() => {
    if (step === 1 && !name.trim() && !description.trim()) return;
    writeClassWizardDraft({
      step, disciplineId, name, level, price, description, startDate,
      sessionCount: sessionCountInput, recurringDays, autoAddedDay, slotCode: selectedSlotCode,
      roomId, coachId, capacity,
    });
  }, [step, disciplineId, name, level, price, description, startDate, sessionCountInput, recurringDays,
    autoAddedDay, selectedSlotCode, roomId, coachId, capacity]);

  const sortedDays = useMemo(() => sortRecurringDays(recurringDays), [recurringDays]);
  const sortedDaysKey = sortedDays.join(',');
  const sessionCountError = useMemo(() => validateCourseSessionCount(sessionCountInput, t), [sessionCountInput, t]);
  // Ngày kết thúc tự tính = ngày học thứ N theo số buổi và các thứ đã chọn.
  const endDate = useMemo(
    () => (sessionCountError ? '' : computeCourseEndDate(startDate, sortedDays, Number(sessionCountInput))),
    [sessionCountError, startDate, sortedDays, sessionCountInput],
  );

  const selectedSlot: ScheduleSlot = useMemo(
    () => SCHEDULE_SLOTS.find((slot) => slot.code === selectedSlotCode) ?? SCHEDULE_SLOTS[0],
    [selectedSlotCode],
  );

  const currentAvailabilityKey = `${disciplineId}|${startDate}|${endDate}|${sortedDaysKey}|${selectedSlot.number}`;
  const availability =
    availabilityState && availabilityState.key === currentAvailabilityKey
      ? availabilityState.data
      : null;
  const isAvailabilityStale = Boolean(
    availabilityState && availabilityState.key !== currentAvailabilityKey,
  );

  const selectedDiscipline = useMemo(
    () => disciplines.find((d) => String(d.id) === disciplineId) ?? null,
    [disciplines, disciplineId],
  );

  const resolvedRooms = useMemo(
    () => resolveWizardRooms(availability, rooms),
    [availability, rooms],
  );

  const resolvedCoaches = useMemo(
    () => resolveWizardCoaches(availability, coaches),
    [availability, coaches],
  );

  const selectedRoom = useMemo(
    () => resolvedRooms.find((r) => String(r.id) === roomId),
    [resolvedRooms, roomId],
  );

  const selectedCoach = useMemo(
    () => resolvedCoaches.find((c) => String(c.id) === coachId),
    [resolvedCoaches, coachId],
  );

  const step2LocalError = useMemo(
    () => sessionCountError ?? validateWizardStep2Local({ startDate, endDate, recurringDays: sortedDays }, t),
    [sessionCountError, startDate, endDate, sortedDays, t],
  );

  const capacityInlineError = useMemo(
    () => validateClassCapacity(capacity, selectedRoom, t),
    [capacity, selectedRoom, t],
  );

  // Tự động kiểm tra lịch trống 5 Slot, phòng và HLV mỗi khi vào Bước 2, đổi lịch/slot/bộ môn,
  // hoặc quay về Bước 3 sau lỗi 409 Conflict ở Bước 4 / bấm kiểm tra lại trên Bước 3.
  useEffect(() => {
    const isStep2 = step === 2;
    const isStep3Recheck = step === 3 && needsStep3Recheck;
    if (!isStep2 && !isStep3Recheck) return;
    if (!disciplineId || step2LocalError) {
      availabilityReqRef.current += 1;
      setCheckingAvailability(false);
      setAvailabilityState(null);
      setAvailabilityError(null);
      if (isStep3Recheck) setNeedsStep3Recheck(false);
      return;
    }

    let alive = true;
    const reqId = ++availabilityReqRef.current;
    const requestKey = currentAvailabilityKey;
    setCheckingAvailability(true);
    setAvailabilityError(null);

    const daysPayload = sortedDaysKey ? sortedDaysKey.split(',') : [];
    void classesApi
      .checkRecurringAvailability({
        disciplineId: Number(disciplineId),
        startDate,
        endDate,
        recurringDays: daysPayload,
        startTime: selectedSlot.startApi,
        endTime: selectedSlot.endApi,
      })
      .then((res) => {
        if (!alive || availabilityReqRef.current !== reqId) return;
        setAvailabilityState({ key: requestKey, data: res });
        if (isStep3Recheck) {
          setNeedsStep3Recheck(false);
          if (res.validSchedule) {
            setRoomId((prev) => (res.rooms.some((r) => String(r.id) === prev && r.available) ? prev : ''));
            setCoachId((prev) => (res.coaches.some((c) => String(c.id) === prev && c.available) ? prev : ''));
          }
        }
      })
      .catch((err) => {
        if (!alive || availabilityReqRef.current !== reqId) return;
        setAvailabilityState(null);
        if (isStep3Recheck) setNeedsStep3Recheck(false);
        setAvailabilityError(
          errorMessage(
            err,
            t(
              'Không thể kiểm tra lịch trống. Vui lòng thử kiểm tra lại.',
              'Could not check schedule availability. Please retry.',
            ),
          ),
        );
      })
      .finally(() => {
        if (!alive || availabilityReqRef.current !== reqId) return;
        setCheckingAvailability(false);
      });

    return () => {
      alive = false;
    };
  }, [
    step,
    needsStep3Recheck,
    disciplineId,
    startDate,
    endDate,
    sortedDaysKey,
    selectedSlot.startApi,
    selectedSlot.endApi,
    currentAvailabilityKey,
    step2LocalError,
    availabilityRetryTick,
    t,
  ]);

  const toggleDay = (code: string) => {
    if (code === startDayCode) return;
    setError(null);
    setAvailabilityState(null);
    setAvailabilityError(null);
    setRecurringDays((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  };

  /** Xóa bản nháp và đưa wizard về trạng thái ban đầu. */
  const resetWizard = () => {
    clearClassWizardDraft();
    setRestoredAt(null);
    setStep(1);
    setMaxStep(1);
    setError(null);
    setDisciplineId(
      prefill?.disciplineId && disciplines.some((d) => d.id === prefill.disciplineId)
        ? String(prefill.disciplineId)
        : (disciplines[0]?.id ? String(disciplines[0].id) : ''),
    );
    setName('');
    setLevel('all');
    setPrice('150000');
    setDescription('');
    setStartDate(defaultStart);
    setSessionCountInput('12');
    setRecurringDays([defaultDay]);
    setAutoAddedDay(defaultDay);
    setSelectedSlotCode(SCHEDULE_SLOTS[0].code);
    setRoomId(rooms[0]?.id ? String(rooms[0].id) : '');
    setCoachId(coaches[0]?.id ? String(coaches[0].id) : '');
    setCapacity(String(rooms[0]?.capacity ?? 15));
    setOpenReason(null);
  };

  const wizardSteps: { id: WizardStep; label: string }[] = [
    { id: 1, label: t('Thông tin khóa học', 'Course info') },
    { id: 2, label: t('Lịch học & Slot', 'Schedule & slot') },
    { id: 3, label: t('Phòng & HLV', 'Room & coach') },
    { id: 4, label: t('Xác nhận', 'Review') },
  ];

  /**
   * Kiểm tra bước `from` để đi tiếp; trả false (kèm lỗi) nếu chưa hợp lệ. Rời Bước 2 sẽ chọn sẵn phòng/HLV
   * còn trống như khi bấm Tiếp tục.
   */
  const canLeaveStep = (from: WizardStep): boolean => {
    if (from === 1) {
      const step1Error = validateWizardStep1({ name, disciplineId, price }, t);
      if (step1Error) {
        setError(step1Error);
        return false;
      }
      return true;
    }
    if (from === 2) {
      const step2Error = validateWizardStep2Advance(
        {
          startDate,
          endDate,
          recurringDays: sortedDays,
          checkingAvailability,
          availabilityError,
          availability,
          selectedSlot,
        },
        t,
      );
      if (step2Error) {
        setError(step2Error);
        return false;
      }
      const nextRoomSelection = pickDefaultRoomAndCapacity({
        rooms: resolvedRooms,
        prefillRoomId: prefill?.roomId,
        currentRoomId: roomId,
        currentCapacity: capacity,
      });
      setRoomId(nextRoomSelection.roomId);
      setCapacity(nextRoomSelection.capacity);
      setCoachId(
        pickDefaultCoachId({
          coaches: resolvedCoaches,
          currentCoachId: coachId,
        }),
      );
      return true;
    }
    if (from === 3) {
      const step3Error = validateWizardStep3(
        { selectedRoom, selectedCoach, capacity },
        t,
      );
      if (step3Error) {
        setError(step3Error);
        return false;
      }
      return true;
    }
    return true;
  };

  /** Chuyển tới một bước bất kỳ đã từng tới: lùi thì đi thẳng, tiến thì kiểm tra lần lượt các bước ở giữa. */
  const goToStep = (target: WizardStep) => {
    if (busy || target === step || target > maxStep) return;
    setError(null);
    let current = step;
    while (current < target) {
      if (!canLeaveStep(current)) {
        setStep(current);
        return;
      }
      current = (current + 1) as WizardStep;
    }
    setStep(target);
  };

  const handleBack = () => {
    if (busy || step === 1) return;
    setError(null);
    setStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : 1));
  };

  const handleNext = () => {
    if (busy || step === 4) return;
    setError(null);
    if (canLeaveStep(step)) {
      setStep((step + 1) as WizardStep);
    }
  };

  const handleCreate = async () => {
    if (busy) return;
    setError(null);
    const step1Error = validateWizardStep1({ name, disciplineId, price }, t);
    if (step1Error) {
      setError(step1Error);
      setStep(1);
      return;
    }
    const step3Error = validateWizardStep3({ selectedRoom, selectedCoach, capacity }, t);
    if (step3Error) {
      setError(step3Error);
      setStep(3);
      return;
    }

    setBusy(true);
    try {
      await classesApi.createRecurringClass({
        name: name.trim(),
        disciplineId: Number(disciplineId),
        roomId: Number(roomId),
        coachId: Number(coachId),
        capacity: Number(capacity),
        level,
        description: description.trim() || undefined,
        price: Math.max(0, Number(price) || 0),
        startDate,
        endDate,
        recurringDays: sortedDays,
        startTime: selectedSlot.startApi,
        endTime: selectedSlot.endApi,
      });
      clearClassWizardDraft();
      onSuccess(t('Đã tạo khóa học định kỳ thành công.', 'Recurring course created successfully.'));
    } catch (err) {
      const isConflict =
        (err instanceof ApiError && err.status === 409) ||
        (typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          (err as { status?: number }).status === 409);
      if (isConflict) {
        setNeedsStep3Recheck(true);
      }
      setError(
        errorMessage(
          err,
          t(
            'Không thể lưu khóa học. Vui lòng kiểm tra lại xung đột lịch.',
            'Could not create course. Please check for scheduling conflicts.',
          ),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step < 4) {
      return;
    }
    void handleCreate();
  };

  const findSlotAvailability = (slot: ScheduleSlot): SlotAvailabilityDto | undefined =>
    availability?.slots.find((item) => item.code === slot.code || item.slotNumber === slot.number);

  const renderSlotStatus = (slot: ScheduleSlot): { text: string; unavailable: boolean } => {
    if (checkingAvailability) {
      return {
        text: t('Đang kiểm tra lịch trống...', 'Checking availability...'),
        unavailable: false,
      };
    }
    if (availabilityError) {
      return {
        text: t('Chưa kiểm tra được', 'Could not verify'),
        unavailable: false,
      };
    }
    const info = findSlotAvailability(slot);
    if (!info) {
      return {
        text: t('Chọn lịch để kiểm tra', 'Pick schedule first'),
        unavailable: false,
      };
    }
    if (info.conflictCode === 'SCHEDULING_PAST_SESSION') {
      return {
        text: t('Đã qua giờ', 'Past slot'),
        unavailable: true,
      };
    }
    if (info.disciplineConflict) {
      return {
        text: selectedDiscipline
          ? t(`Trùng lịch môn ${selectedDiscipline.name}`, `${selectedDiscipline.name} overlap`)
          : t('Trùng lịch cùng bộ môn', 'Discipline overlap'),
        unavailable: true,
      };
    }
    if (!info.available) {
      if (info.availableRoomCount === 0 && info.availableCoachCount === 0) {
        return { text: t('Hết phòng & HLV', 'No room or coach'), unavailable: true };
      }
      if (info.availableRoomCount === 0) {
        return { text: t('Hết phòng', 'No rooms free'), unavailable: true };
      }
      if (info.availableCoachCount === 0) {
        return { text: t('Hết HLV', 'No coaches free'), unavailable: true };
      }
      return { text: t('Không khả dụng', 'Unavailable'), unavailable: true };
    }
    return {
      text: t(
        `${info.availableRoomCount} phòng · ${info.availableCoachCount} HLV trống`,
        `${info.availableRoomCount} ${info.availableRoomCount === 1 ? 'room' : 'rooms'} · ${info.availableCoachCount} ${info.availableCoachCount === 1 ? 'coach' : 'coaches'} free`,
      ),
      unavailable: false,
    };
  };

  const selectedSlotInfo = findSlotAvailability(selectedSlot);
  const parsedPrice = Math.max(0, Number(price) || 0);
  const levelLabel =
    level === 'beginner'
      ? t('Cơ bản', 'Beginner')
      : level === 'intermediate'
        ? t('Trung cấp', 'Intermediate')
        : level === 'advanced'
          ? t('Nâng cao', 'Advanced')
          : t('Mọi trình độ', 'All levels');

  return (
    <Modal
      title={t('Tạo khóa học định kỳ', 'Create recurring course')}
      onClose={onClose}
      busy={busy}
      className="class-wizard-modal"
    >
      <nav
        className="class-wizard__stepper"
        aria-label={t('Các bước tạo khóa học', 'Course creation steps')}
        data-testid="class-wizard-stepper"
      >
        {wizardSteps.map((item) => {
          const isActive = step === item.id;
          const isDone = item.id < step;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`wizard-step-tab-${item.id}`}
              className={`class-wizard__step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              disabled={busy || item.id > maxStep}
              onClick={() => goToStep(item.id)}
            >
              <span className="class-wizard__step-num" aria-hidden="true">
                {item.id}
              </span>
              <span className="class-wizard__step-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {restoredAt && (
        <div className="class-wizard__draft" role="status" data-testid="wizard-draft-banner">
          <span>
            {t(
              `Đã khôi phục bản nháp lưu lúc ${formatDraftTime(restoredAt)}.`,
              `Restored the draft saved at ${formatDraftTime(restoredAt)}.`,
            )}
          </span>
          <button type="button" className="btn-secondary btn-sm" data-testid="wizard-draft-reset" disabled={busy} onClick={resetWizard}>
            {t('Bắt đầu lại', 'Start over')}
          </button>
        </div>
      )}

      {error && (
        <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="portal-form-stack" noValidate>
        {step === 1 && (
          <div className="portal-form-stack" data-testid="wizard-step-1">
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cls-discipline">
                {t('Bộ môn', 'Discipline')}
              </label>
              <Select
                id="cls-discipline"
                value={disciplineId}
                onChange={(e) => {
                  setDisciplineId(e.target.value);
                  setAvailabilityState(null);
                  setAvailabilityError(null);
                  setError(null);
                }}
              >
                {disciplines.map((d) => {
                  const activeCount = activeCountByDiscipline.get(d.id) ?? 0;
                  const optionLabel =
                    activeCount > 0
                      ? t(
                          `${d.name} (${activeCount} khóa đang mở)`,
                          `${d.name} (${activeCount} ${activeCount === 1 ? 'active course' : 'active courses'})`,
                        )
                      : d.name;
                  return (
                    <option key={d.id} value={String(d.id)}>
                      {optionLabel}
                    </option>
                  );
                })}
              </Select>
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cls-name">
                {t('Tên khóa học', 'Course name')}
              </label>
              <input
                id="cls-name"
                className="portal-input"
                maxLength={CLASS_NAME_MAX_LENGTH}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder={t('Ví dụ: Yoga Phục hồi sáng', 'e.g. Morning Restorative Yoga')}
                required
              />
              {name.length >= 120 && (
                <p className="class-wizard__hint">
                  {t(
                    `${name.length}/${CLASS_NAME_MAX_LENGTH} ký tự`,
                    `${name.length}/${CLASS_NAME_MAX_LENGTH} characters`,
                  )}
                </p>
              )}
            </div>

            <div className="portal-form-grid-2">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-level">
                  {t('Trình độ', 'Level')}
                </label>
                <Select id="cls-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="all">{t('Mọi trình độ', 'All levels')}</option>
                  <option value="beginner">{t('Cơ bản', 'Beginner')}</option>
                  <option value="intermediate">{t('Trung cấp', 'Intermediate')}</option>
                  <option value="advanced">{t('Nâng cao', 'Advanced')}</option>
                </Select>
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-price">
                  {t('Học phí ngoài gói (VND)', 'Extra fee (VND)')}
                </label>
                <input
                  id="cls-price"
                  className="portal-input"
                  type="number"
                  min={0}
                  step={10000}
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setError(null);
                  }}
                />
              </div>
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cls-desc">
                {t('Mô tả (tùy chọn)', 'Description (optional)')}
              </label>
              <textarea
                id="cls-desc"
                className="portal-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  'Mục tiêu buổi tập, đối tượng phù hợp hoặc lưu ý chuẩn bị...',
                  'Training goals, suitable participants, or preparation notes...',
                )}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="portal-form-stack" data-testid="wizard-step-2">
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cls-session-count">
                {t('Số buổi của khóa', 'Sessions in course')}
              </label>
              <input
                id="cls-session-count"
                data-testid="wizard-session-count"
                className="portal-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={COURSE_SESSION_COUNT_MAX}
                step={1}
                value={sessionCountInput}
                onChange={(e) => {
                  setSessionCountInput(e.target.value);
                  setAvailabilityState(null);
                  setAvailabilityError(null);
                  setError(null);
                }}
              />
            </div>
            <div className="portal-form-grid-2">
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-start-date">
                  {t('Ngày khai giảng', 'Start date')}
                </label>
                <DatePicker
                  id="cls-start-date"
                  value={startDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    const nextDays = daysForStartDate(recurringDays, autoAddedDay, next ? weekdayCodeOf(next) : '');
                    setStartDate(next);
                    setRecurringDays(nextDays.days);
                    setAutoAddedDay(nextDays.autoAddedDay);
                    setAvailabilityState(null);
                    setAvailabilityError(null);
                    setError(null);
                  }}
                />
              </div>
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="cls-end-date">
                  {t('Ngày kết thúc', 'End date')}
                </label>
                {/* Khóa: ngày kết thúc luôn bằng ngày học thứ N theo số buổi và các thứ đã chọn. */}
                <DatePicker id="cls-end-date" value={endDate} onChange={() => undefined} disabled />
              </div>
            </div>
            <p className="class-wizard__hint" data-testid="wizard-end-date">
              {endDate
                ? t(
                  `${sessionCountInput} buổi, ${sortedDays.length} buổi/tuần ≈ ${Math.ceil(Number(sessionCountInput) / Math.max(1, sortedDays.length))} tuần · ngày kết thúc tự đổi theo số buổi và thứ học`,
                  `${sessionCountInput} sessions, ${sortedDays.length}/week ≈ ${Math.ceil(Number(sessionCountInput) / Math.max(1, sortedDays.length))} weeks · end date follows the session count and weekdays`,
                )
                : t('Ngày kết thúc sẽ tự tính theo số buổi và các thứ học.', 'End date is calculated from the session count and weekdays.')}
            </p>

            <div className="portal-form-group">
              <span className="portal-label">
                {t('Các thứ học trong tuần', 'Weekly schedule days')}
              </span>
              <div
                className="filter-chips"
                role="group"
                aria-label={t('Chọn các thứ trong tuần', 'Select weekdays')}
              >
                {WIZARD_WEEKDAYS.map((day) => {
                  const locked = day.code === startDayCode;
                  const selected = locked || recurringDays.includes(day.code);
                  return (
                    <button
                      key={day.code}
                      type="button"
                      data-testid={`weekday-chip-${day.code}`}
                      className={`filter-chip${selected ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
                      aria-pressed={selected}
                      aria-disabled={locked || undefined}
                      title={locked ? t('Thứ của ngày khai giảng, luôn được chọn', 'Start date weekday, always included') : undefined}
                      onClick={() => toggleDay(day.code)}
                    >
                      {t(day.vi, day.en)}
                      {locked && <span aria-hidden="true"> · {t('khai giảng', 'start')}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="portal-form-group">
              <span className="portal-label">
                {t('Khung giờ (5 Slot cố định)', 'Time slot (5 fixed slots)')}
              </span>
              <div
                className="slot-picker-grid"
                role="group"
                aria-label={t('Chọn khung giờ trong 5 Slot cố định', 'Select one of 5 fixed time slots')}
              >
                {SCHEDULE_SLOTS.map((slot) => {
                  const active = slot.code === selectedSlotCode;
                  const status = renderSlotStatus(slot);
                  return (
                    <button
                      key={slot.code}
                      type="button"
                      data-testid={`slot-option-${slot.number}`}
                      className={`slot-picker-btn${active ? ' is-active' : ''}${status.unavailable ? ' is-unavailable' : ''}`}
                      aria-pressed={active}
                      disabled={busy}
                      onClick={() => {
                        // Re-clicking the active slot must not wipe results: the check effect won't re-run.
                        if (active) return;
                        setSelectedSlotCode(slot.code);
                        setAvailabilityState(null);
                        setAvailabilityError(null);
                        setError(null);
                      }}
                    >
                      <strong className="slot-picker-btn__name">{slot.label}</strong>
                      <span className="slot-picker-btn__time">{slot.rangeLabel}</span>
                      <span className="slot-picker-btn__status">{status.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              data-testid="wizard-schedule-summary"
              role={
                availabilityError ||
                step2LocalError ||
                (availability && (!availability.validSchedule || !availability.selectedSlotAvailable))
                  ? 'alert'
                  : 'status'
              }
              className={`class-wizard__summary${
                availabilityError ||
                step2LocalError ||
                (availability && (!availability.validSchedule || !availability.selectedSlotAvailable))
                  ? ' is-error'
                  : availability && availability.validSchedule && availability.selectedSlotAvailable
                    ? ' is-ok'
                    : ''
              }`}
            >
              {checkingAvailability ? (
                <span>
                  {t(
                    'Đang kiểm tra lịch trống cho 5 Slot, phòng tập và HLV...',
                    'Checking availability across 5 slots, rooms, and coaches...',
                  )}
                </span>
              ) : availabilityError ? (
                <div className="class-wizard__summary-row">
                  <span>{availabilityError}</span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    data-testid="wizard-retry-availability-btn"
                    onClick={() => setAvailabilityRetryTick((tick) => tick + 1)}
                  >
                    {t('Thử kiểm tra lại', 'Retry check')}
                  </button>
                </div>
              ) : step2LocalError ? (
                <span>{step2LocalError}</span>
              ) : availability ? (
                !availability.validSchedule || availability.sessionCount <= 0 ? (
                  <span>
                    {availability.scheduleErrorMessage ||
                      t(
                        'Khoảng ngày và các thứ đã chọn không tạo ra buổi học hợp lệ.',
                        'The selected date range and weekdays do not generate any valid sessions.',
                      )}
                  </span>
                ) : (
                  <>
                    <strong>
                      {t(
                        `Sẽ tạo ${availability.sessionCount} buổi học · ${formatCenterDate(availability.firstSessionDate)} – ${formatCenterDate(availability.lastSessionDate)}`,
                        `Will create ${availability.sessionCount} ${availability.sessionCount === 1 ? 'session' : 'sessions'} · ${formatCenterDate(availability.firstSessionDate)} – ${formatCenterDate(availability.lastSessionDate)}`,
                      )}
                    </strong>
                    {availability.selectedSlotAvailable ? (
                      <span className="class-wizard__summary-sub">
                        {`${selectedSlot.label} (${selectedSlot.rangeLabel}) · ${t(
                          `${selectedSlotInfo?.availableRoomCount ?? resolvedRooms.filter((r) => r.available).length} phòng trống · ${selectedSlotInfo?.availableCoachCount ?? resolvedCoaches.filter((c) => c.available).length} HLV sẵn sàng`,
                          `${selectedSlotInfo?.availableRoomCount ?? resolvedRooms.filter((r) => r.available).length} rooms free · ${selectedSlotInfo?.availableCoachCount ?? resolvedCoaches.filter((c) => c.available).length} coaches available`,
                        )}`}
                      </span>
                    ) : (
                      <span>
                        {availability.selectedSlotConflictReason ||
                          selectedSlotInfo?.conflictReason ||
                          t(
                            'Slot này đang có xung đột lịch. Vui lòng chọn slot hoặc khung ngày khác.',
                            'This slot has a scheduling conflict. Please choose another slot or date range.',
                          )}
                      </span>
                    )}
                  </>
                )
              ) : (
                <span>
                  {t(
                    'Chọn khoảng ngày, thứ học và một trong 5 Slot để kiểm tra phòng và HLV trống.',
                    'Select dates, weekdays, and one of the 5 slots to check room and coach availability.',
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="portal-form-stack" data-testid="wizard-step-3">
            <div className="class-wizard__banner" data-testid="wizard-step3-banner">
              {selectedDiscipline && (
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span
                    className="class-discipline-dot"
                    style={{ background: disciplineAccentColor(selectedDiscipline.id) }}
                    aria-hidden="true"
                  />
                  {selectedDiscipline.name}
                </span>
              )}
              <span>·</span>
              <span>{formatRecurringDaysShort(sortedDays, t)}</span>
              <span>·</span>
              <span>{`${selectedSlot.label} (${selectedSlot.rangeLabel})`}</span>
              {availability && availability.sessionCount > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {t(
                      `${availability.sessionCount} buổi`,
                      `${availability.sessionCount} ${availability.sessionCount === 1 ? 'session' : 'sessions'}`,
                    )}
                  </span>
                </>
              )}
              <button
                type="button"
                className="btn-secondary btn-sm"
                data-testid="wizard-step3-recheck-btn"
                style={{ marginLeft: 'auto' }}
                disabled={busy || checkingAvailability}
                onClick={() => {
                  setError(null);
                  setNeedsStep3Recheck(true);
                  setAvailabilityRetryTick((tick) => tick + 1);
                }}
              >
                {checkingAvailability ? t('Đang kiểm tra...', 'Checking...') : t('Kiểm tra lại', 'Re-check')}
              </button>
            </div>

            {checkingAvailability && (
              <div className="class-wizard__summary" role="status" data-testid="wizard-step3-checking">
                {t('Đang cập nhật trạng thái phòng tập và HLV...', 'Refreshing room and coach availability...')}
              </div>
            )}

            {!checkingAvailability && availabilityError && (
              <div className="class-wizard__summary is-error" role="alert">
                <div className="class-wizard__summary-row">
                  <span>{availabilityError}</span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setNeedsStep3Recheck(true);
                      setAvailabilityRetryTick((tick) => tick + 1);
                    }}
                  >
                    {t('Thử kiểm tra lại', 'Retry check')}
                  </button>
                </div>
              </div>
            )}

            <div className="portal-form-group">
              <span className="portal-label">{t('Phòng tập', 'Room')}</span>
              {!checkingAvailability && !availabilityError && resolvedRooms.filter((r) => r.available).length === 0 && (
                <div className="portal-alert portal-alert--error" role="alert" data-testid="wizard-no-rooms-alert" style={{ marginBottom: 8 }}>
                  {resolvedRooms.length === 0
                    ? t(
                        'Hiện không có phòng tập khả dụng nào trong trung tâm (tất cả phòng đang bảo trì hoặc đóng). Vui lòng mở lại phòng hoặc đổi lịch.',
                        'No available rooms were returned (all rooms may be under maintenance or closed). Please reopen a room or adjust the schedule.',
                      )
                    : t(
                        'Không có phòng tập nào còn trống cho khung giờ này. Vui lòng quay lại Bước 2 để chọn slot hoặc ngày khác.',
                        'No rooms are free for this time slot. Go back to Step 2 to pick another slot or date range.',
                      )}
                </div>
              )}
              <div
                className="class-wizard__options"
                role="radiogroup"
                aria-label={t('Chọn phòng tập', 'Select room')}
                data-testid="wizard-room-list"
              >
                {resolvedRooms.map((room) => {
                  const selected = String(room.id) === roomId;
                  const isVip = String(room.tier ?? '').toUpperCase() === 'PLATINUM';
                  return (
                    <button
                      key={room.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`wizard-room-${room.id}`}
                      disabled={busy}
                      aria-disabled={!room.available || undefined}
                      title={!room.available ? t('Bấm để xem lý do', 'Click to see why') : undefined}
                      className={`class-wizard__option${selected ? ' is-selected' : ''}${!room.available ? ' is-unavailable' : ''}`}
                      onClick={() => {
                        if (!room.available) {
                          toggleReason(`room-${room.id}`);
                          return;
                        }
                        setRoomId(String(room.id));
                        const capNum = Number(capacity.trim());
                        if (!capacity.trim() || !Number.isInteger(capNum) || capNum < 1 || capNum > room.capacity) {
                          setCapacity(String(room.capacity));
                        }
                        setError(null);
                      }}
                    >
                      <span className="class-wizard__option-head">
                        <span className="class-wizard__option-title">
                          <strong>{room.name}</strong>
                          {isVip && (
                            <span className="badge badge-info">
                              {t('VIP Platinum', 'VIP Platinum')}
                            </span>
                          )}
                        </span>
                        <span className={`badge ${room.available ? 'badge-success' : 'badge-danger'}`}>
                          {room.available ? t('Còn trống', 'Available') : t('Đã bận', 'Busy')}
                        </span>
                      </span>
                      <span className="class-wizard__option-meta">
                        {[
                          t(`Sức chứa: ${room.capacity} chỗ`, `Capacity: ${room.capacity} seats`),
                          room.location,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {!room.available && room.conflictReason && openReason === `room-${room.id}` && (
                        <span className="class-wizard__option-reason">{room.conflictReason}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cls-capacity">
                {t('Sĩ số tối đa', 'Max capacity')}
              </label>
              <input
                id="cls-capacity"
                className="portal-input"
                type="number"
                min={1}
                max={selectedRoom?.capacity ?? 200}
                value={capacity}
                aria-invalid={Boolean(capacityInlineError)}
                onChange={(e) => {
                  setCapacity(e.target.value);
                  setError(null);
                }}
              />
              {selectedRoom && (
                <p className="class-wizard__hint">
                  {t(
                    `Tối đa ${selectedRoom.capacity} học viên theo sức chứa phòng ${selectedRoom.name}.`,
                    `Up to ${selectedRoom.capacity} members based on ${selectedRoom.name} capacity.`,
                  )}
                </p>
              )}
              {capacityInlineError && (
                <p className="portal-field-error" role="alert" data-testid="wizard-capacity-error">
                  {capacityInlineError}
                </p>
              )}
            </div>

            <div className="portal-form-group">
              <span className="portal-label">{t('Huấn luyện viên', 'Coach')}</span>
              {!checkingAvailability && !availabilityError && resolvedCoaches.filter((c) => c.available).length === 0 && (
                <div className="portal-alert portal-alert--error" role="alert" data-testid="wizard-no-coaches-alert" style={{ marginBottom: 8 }}>
                  {resolvedCoaches.length === 0
                    ? t(
                        'Hiện không có huấn luyện viên nào đang hoạt động. Vui lòng kích hoạt tài khoản HLV trước khi mở lớp.',
                        'No active coaches are available. Please activate a coach account before creating this course.',
                      )
                    : t(
                        'Không có huấn luyện viên nào sẵn sàng cho khung giờ này. Vui lòng quay lại Bước 2 để đổi lịch.',
                        'No coaches are available for this time slot. Go back to Step 2 to adjust the schedule.',
                      )}
                </div>
              )}
              <div
                className="class-wizard__options"
                role="radiogroup"
                aria-label={t('Chọn huấn luyện viên', 'Select coach')}
                data-testid="wizard-coach-list"
              >
                {resolvedCoaches.map((coach) => {
                  const selected = String(coach.id) === coachId;
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`wizard-coach-${coach.id}`}
                      disabled={busy}
                      aria-disabled={!coach.available || undefined}
                      title={!coach.available ? t('Bấm để xem lý do', 'Click to see why') : undefined}
                      className={`class-wizard__option${selected ? ' is-selected' : ''}${!coach.available ? ' is-unavailable' : ''}`}
                      onClick={() => {
                        if (!coach.available) {
                          toggleReason(`coach-${coach.id}`);
                          return;
                        }
                        setCoachId(String(coach.id));
                        setError(null);
                      }}
                    >
                      <span className="class-wizard__option-head">
                        <span className="class-wizard__option-title">
                          <strong>{coach.fullName}</strong>
                        </span>
                        <span className={`badge ${coach.available ? 'badge-success' : 'badge-danger'}`}>
                          {coach.available ? t('Sẵn sàng', 'Available') : t('Không khả dụng', 'Unavailable')}
                        </span>
                      </span>
                      {coach.email && (
                        <span className="class-wizard__option-meta">{coach.email}</span>
                      )}
                      {!coach.available && coach.conflictReason && openReason === `coach-${coach.id}` && (
                        <span className="class-wizard__option-reason">{coach.conflictReason}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="portal-form-stack" data-testid="wizard-step-4">
            <div className="kv-list">
              <div className="kv-row">
                <span>{t('Bộ môn', 'Discipline')}</span>
                <strong>
                  {selectedDiscipline && (
                    <span
                      className="class-discipline-dot"
                      style={{ background: disciplineAccentColor(selectedDiscipline.id) }}
                      aria-hidden="true"
                    />
                  )}
                  {selectedDiscipline?.name ?? '—'}
                </strong>
              </div>
              <div className="kv-row">
                <span>{t('Tên khóa học', 'Course name')}</span>
                <strong>{name.trim()}</strong>
              </div>
              <div className="kv-row">
                <span>{t('Trình độ', 'Level')}</span>
                <strong>{levelLabel}</strong>
              </div>
              <div className="kv-row">
                <span>{t('Học phí ngoài gói', 'Extra fee')}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatPrice(parsedPrice)}
                </strong>
              </div>
              {description.trim() && (
                <div className="kv-row">
                  <span>{t('Mô tả', 'Description')}</span>
                  <strong>{description.trim()}</strong>
                </div>
              )}
              <div className="kv-row">
                <span>{t('Thời gian khóa', 'Course dates')}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {`${formatCenterDate(startDate)} – ${formatCenterDate(endDate)}`}
                </strong>
              </div>
              <div className="kv-row">
                <span>{t('Thứ học trong tuần', 'Weekly days')}</span>
                <strong>{formatRecurringDaysFull(sortedDays, t)}</strong>
              </div>
              <div className="kv-row">
                <span>{t('Khung giờ', 'Time slot')}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {`${selectedSlot.label} · ${selectedSlot.rangeLabel}`}
                </strong>
              </div>
              <div className="kv-row">
                <span>{t('Tổng số buổi tạo', 'Total sessions')}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t(
                    `${availability?.sessionCount ?? 0} buổi`,
                    `${availability?.sessionCount ?? 0} ${(availability?.sessionCount ?? 0) === 1 ? 'session' : 'sessions'}`,
                  )}
                </strong>
              </div>
              <div className="kv-row">
                <span>{t('Phòng tập & sĩ số', 'Room & capacity')}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {selectedRoom
                    ? `${selectedRoom.name} · ${t(`${capacity}/${selectedRoom.capacity} chỗ`, `${capacity}/${selectedRoom.capacity} seats`)}`
                    : '—'}
                </strong>
              </div>
              <div className="kv-row">
                <span>{t('Huấn luyện viên', 'Coach')}</span>
                <strong>{selectedCoach?.fullName ?? '—'}</strong>
              </div>
            </div>

            <div className="portal-alert portal-alert--success" role="status" style={{ marginBottom: 0 }}>
              {t(
                'Đã kiểm tra: 5 Slot chuẩn · Không trùng giờ môn, phòng, HLV & PT 1:1 · Sĩ số hợp lệ',
                'Verified: 5 fixed slots · No discipline, room, coach, or 1:1 PT conflicts · Valid capacity',
              )}
            </div>
          </div>
        )}

        <div className="class-wizard__footer">
          {/* Bước 1 chỉ có nút X ở góc để đóng; không lặp thêm nút Hủy. */}
          {step === 1 ? (
            <span aria-hidden="true" />
          ) : (
            <button
              type="button"
              className="btn-secondary"
              data-testid="wizard-back-btn"
              onClick={handleBack}
              disabled={busy}
            >
              {t('Quay lại', 'Back')}
            </button>
          )}

          {step < 4 ? (
            <button
              key="wizard-next"
              type="button"
              className="btn-primary"
              data-testid="wizard-next-btn"
              disabled={busy || (step === 2 && (checkingAvailability || isAvailabilityStale)) || (step === 3 && checkingAvailability)}
              onClick={handleNext}
            >
              {t('Tiếp tục', 'Next')}
            </button>
          ) : (
            <button
              key="wizard-submit"
              type="button"
              className="btn-primary"
              data-testid="wizard-submit-btn"
              disabled={busy}
              onClick={() => void handleCreate()}
            >
              {busy ? t('Đang lưu...', 'Saving...') : t('Tạo khóa học', 'Create course')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

interface EditClassModalProps {
  gymClass: ClassItem;
  disciplines: Discipline[];
  rooms: Room[];
  coaches: CoachUser[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type EditableClassStatus = 'active' | 'inactive' | 'archived';

function normalizeEditableClassStatus(raw: string): EditableClassStatus {
  const normalized = String(raw).toLowerCase();
  if (normalized === 'inactive' || normalized === 'archived') return normalized;
  return 'active';
}

/** Hộp thoại chỉnh sửa khóa học (kiểm tra xung đột phòng/HLV/PT/cùng bộ môn và sức chứa phòng). */
export function EditClassModal({ gymClass, disciplines, rooms, coaches, onClose, onSuccess }: EditClassModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(gymClass.name);
  const [disciplineId, setDisciplineId] = useState(String(gymClass.disciplineId));
  const [roomId, setRoomId] = useState(String(gymClass.roomId));
  const [coachId, setCoachId] = useState(String(gymClass.coachId));
  const [capacity, setCapacity] = useState(String(gymClass.capacity));
  const [level, setLevel] = useState(gymClass.level ?? 'all');
  const [status, setStatus] = useState<EditableClassStatus>(() => normalizeEditableClassStatus(gymClass.status));
  const [description, setDescription] = useState(gymClass.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRoomMissing = useMemo(
    () => !rooms.some((r) => r.id === gymClass.roomId),
    [rooms, gymClass.roomId],
  );
  const currentCoachMissing = useMemo(
    () => !coaches.some((c) => c.id === gymClass.coachId),
    [coaches, gymClass.coachId],
  );

  const roomOptions = useMemo(() => {
    const base = rooms.map((r) => ({ ...r, unavailable: false }));
    if (!currentRoomMissing) return base;
    return [
      {
        id: gymClass.roomId,
        name: gymClass.roomName || t(`Phòng #${gymClass.roomId}`, `Room #${gymClass.roomId}`),
        location: '',
        capacity: Math.max(1, gymClass.capacity),
        status: 'maintenance' as const,
        unavailable: true,
      },
      ...base,
    ];
  }, [rooms, currentRoomMissing, gymClass.roomId, gymClass.roomName, gymClass.capacity, t]);

  const coachOptions = useMemo(() => {
    const base = coaches.map((c) => ({ ...c, unavailable: false }));
    if (!currentCoachMissing) return base;
    return [
      {
        id: gymClass.coachId,
        fullName: gymClass.coachName || t(`HLV #${gymClass.coachId}`, `Coach #${gymClass.coachId}`),
        email: '',
        status: 'inactive',
        unavailable: true,
      },
      ...base,
    ];
  }, [coaches, currentCoachMissing, gymClass.coachId, gymClass.coachName, t]);

  const selectedRoom = useMemo(
    () => roomOptions.find((r) => String(r.id) === roomId),
    [roomOptions, roomId],
  );
  const selectedCoach = useMemo(
    () => coachOptions.find((c) => String(c.id) === coachId),
    [coachOptions, coachId],
  );
  const isUsingUnavailableRoom = Boolean(selectedRoom?.unavailable);
  const isUsingUnavailableCoach = Boolean(selectedCoach?.unavailable);

  const capacityInlineError = useMemo(
    () => validateClassCapacity(capacity, selectedRoom, t),
    [capacity, selectedRoom, t],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t('Tên khóa học không được để trống.', 'Course name is required.'));
      return;
    }
    if (status === 'active' && isUsingUnavailableRoom) {
      setError(
        t(
          'Phòng tập hiện tại đang bảo trì hoặc đã đóng. Vui lòng chọn phòng khả dụng khác hoặc chuyển lớp sang Ngừng mở/Lưu trữ.',
          'The current room is under maintenance or closed. Please select an available room or switch the class to Inactive/Archived.',
        ),
      );
      return;
    }
    if (status === 'active' && isUsingUnavailableCoach) {
      setError(
        t(
          'Huấn luyện viên hiện tại đã ngừng hoạt động. Vui lòng chọn HLV khác hoặc chuyển lớp sang Ngừng mở/Lưu trữ.',
          'The current coach is inactive. Please select an active coach or switch the class to Inactive/Archived.',
        ),
      );
      return;
    }
    const capacityError = validateClassCapacity(capacity, selectedRoom, t);
    if (capacityError) {
      setError(capacityError);
      return;
    }
    setBusy(true);
    try {
      await classesApi.updateClass(gymClass.id, {
        name: name.trim(),
        disciplineId: Number(disciplineId),
        roomId: Number(roomId),
        coachId: Number(coachId),
        capacity: Number(capacity),
        level,
        status,
        description: description.trim() || undefined,
      });
      onSuccess(t('Đã cập nhật khóa học thành công.', 'Course updated successfully.'));
    } catch (err) {
      setError(errorMessage(err, t('Không thể cập nhật khóa học.', 'Could not update course.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('Chỉnh sửa khóa học', 'Edit course')} onClose={onClose} busy={busy}>
      {error && (
        <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {(isUsingUnavailableRoom || isUsingUnavailableCoach) && (
        <div className="portal-alert portal-alert--warning" role="status" data-testid="edit-unavailable-resource-warning" style={{ marginBottom: 12 }}>
          {status === 'active'
            ? t(
                'Phòng tập hoặc HLV hiện tại không còn khả dụng. Vui lòng chọn phòng/HLV đang hoạt động trước khi giữ trạng thái Đang hoạt động, hoặc chuyển trạng thái sang Ngừng mở/Lưu trữ.',
                'The current room or coach is no longer available. Select an active room/coach to keep this class Active, or switch status to Inactive/Archived.',
              )
            : t(
                'Phòng tập hoặc HLV hiện tại không còn khả dụng. Bạn vẫn có thể lưu thay đổi ở trạng thái Ngừng mở hoặc Lưu trữ.',
                'The current room or coach is no longer available. You can still save changes while status is Inactive or Archived.',
              )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="portal-form-stack" noValidate>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="edit-cls-name">{t('Tên khóa học', 'Course name')}</label>
          <input
            id="edit-cls-name"
            className="portal-input"
            maxLength={CLASS_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            required
          />
        </div>
        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-disc">{t('Bộ môn', 'Discipline')}</label>
            <Select id="edit-cls-disc" value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)}>
              {disciplines.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </Select>
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-room">{t('Phòng tập', 'Room')}</label>
            <Select
              id="edit-cls-room"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setError(null);
              }}
            >
              {roomOptions.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.unavailable
                    ? `${r.name} (${t('Đang bảo trì', 'Maintenance')})`
                    : `${r.name} (${r.capacity})`}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-coach">{t('Huấn luyện viên', 'Coach')}</label>
            <Select
              id="edit-cls-coach"
              value={coachId}
              onChange={(e) => {
                setCoachId(e.target.value);
                setError(null);
              }}
            >
              {coachOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.unavailable
                    ? `${c.fullName} (${t('Ngừng hoạt động', 'Inactive')})`
                    : c.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-cap">{t('Sĩ số tối đa', 'Max capacity')}</label>
            <input
              id="edit-cls-cap"
              className="portal-input"
              type="number"
              min={1}
              max={selectedRoom?.capacity ?? 200}
              value={capacity}
              aria-invalid={Boolean(capacityInlineError)}
              onChange={(e) => {
                setCapacity(e.target.value);
                setError(null);
              }}
            />
            {selectedRoom && (
              <p className="class-wizard__hint">
                {t(
                  `Tối đa ${selectedRoom.capacity} học viên theo sức chứa phòng.`,
                  `Up to ${selectedRoom.capacity} members based on room capacity.`,
                )}
              </p>
            )}
            {capacityInlineError && (
              <p className="portal-field-error" role="alert" data-testid="edit-capacity-error">
                {capacityInlineError}
              </p>
            )}
          </div>
        </div>
        <div className="portal-form-grid-2">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-level">{t('Trình độ', 'Level')}</label>
            <Select id="edit-cls-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="all">{t('Mọi trình độ', 'All levels')}</option>
              <option value="beginner">{t('Cơ bản', 'Beginner')}</option>
              <option value="intermediate">{t('Trung cấp', 'Intermediate')}</option>
              <option value="advanced">{t('Nâng cao', 'Advanced')}</option>
            </Select>
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="edit-cls-status">{t('Trạng thái', 'Status')}</label>
            <Select
              id="edit-cls-status"
              value={status}
              onChange={(e) => {
                setStatus(normalizeEditableClassStatus(e.target.value));
                setError(null);
              }}
            >
              <option value="active">{t('Đang hoạt động', 'Active')}</option>
              <option value="inactive">{t('Ngừng mở', 'Inactive')}</option>
              <option value="archived">{t('Lưu trữ', 'Archived')}</option>
            </Select>
          </div>
        </div>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="edit-cls-desc">{t('Mô tả', 'Description')}</label>
          <textarea id="edit-cls-desc" className="portal-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mcal__dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('Hủy', 'Cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Đang lưu...', 'Saving...') : t('Lưu thay đổi', 'Save changes')}</button>
        </div>
      </form>
    </Modal>
  );
}

interface RescheduleSessionModalProps {
  session: ClassSessionDto;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** Hộp thoại dời lịch một buổi học (gửi thông báo schedule_change cho học viên và HLV). */
export function RescheduleSessionModal({ session, onClose, onSuccess }: RescheduleSessionModalProps) {
  const { t } = useI18n();
  const [date, setDate] = useState(session.sessionDate);
  const [selectedSlotCode, setSelectedSlotCode] = useState<ScheduleSlotCode>(() => {
    const matched = findScheduleSlot(session.startTime, session.endTime)
      ?? findScheduleSlot(session.startTime);
    return matched?.code ?? SCHEDULE_SLOTS[0].code;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!date) {
      setError(t('Vui lòng chọn ngày học mới.', 'Please select a new date.'));
      return;
    }
    const selectedSlot = SCHEDULE_SLOTS.find((slot) => slot.code === selectedSlotCode) ?? SCHEDULE_SLOTS[0];
    setBusy(true);
    try {
      await classesApi.rescheduleSession({
        classId: session.classId,
        sessionId: session.id,
        sessionDate: date,
        startTime: selectedSlot.startApi,
        endTime: selectedSlot.endApi,
      });
      onSuccess(t('Đã dời lịch buổi học và gửi thông báo tới học viên, HLV.', 'Session rescheduled and notifications sent.'));
    } catch (err) {
      setError(errorMessage(err, t('Không thể dời lịch buổi học.', 'Could not reschedule session.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('Dời lịch buổi học', 'Reschedule session')} onClose={onClose} busy={busy}>
      {error && <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} className="portal-form-stack" noValidate>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="resch-date">{t('Ngày học mới', 'New date')}</label>
          <DatePicker
            id="resch-date"
            min={todayISO()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="portal-form-group">
          <span className="portal-label">{t('Khung giờ mới (5 Slot cố định)', 'New time slot (5 fixed slots)')}</span>
          <ScheduleSlotPicker
            value={selectedSlotCode}
            onChange={setSelectedSlotCode}
            disabled={busy}
            ariaLabel={t('Chọn khung giờ mới trong 5 Slot cố định', 'Select a new fixed time slot')}
          />
        </div>
        <div className="mcal__dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('Hủy', 'Cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Đang lưu...', 'Saving...') : t('Xác nhận dời lịch', 'Confirm reschedule')}</button>
        </div>
      </form>
    </Modal>
  );
}

interface CancelSessionModalProps {
  session: ClassSessionDto;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** Hộp thoại hủy một buổi học kèm lý do bắt buộc (tự gửi thông báo tới học viên và HLV). */
export function CancelSessionModal({ session, onClose, onSuccess }: CancelSessionModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError(t('Vui lòng nhập lý do hủy buổi học.', 'Please enter a cancellation reason.'));
      return;
    }
    setBusy(true);
    try {
      await classesApi.cancelSession(session.id, reason.trim());
      onSuccess(t('Đã hủy buổi học và gửi thông báo tới học viên, HLV.', 'Session cancelled and notifications sent.'));
    } catch (err) {
      setError(errorMessage(err, t('Không thể hủy buổi học.', 'Could not cancel session.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('Hủy buổi học', 'Cancel session')} onClose={onClose} busy={busy}>
      {error && <div className="portal-alert portal-alert--error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} className="portal-form-stack" noValidate>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="cancel-reason">{t('Lý do hủy buổi', 'Cancellation reason')}</label>
          <textarea
            id="cancel-reason"
            className="portal-textarea"
            rows={3}
            maxLength={255}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('Ví dụ: Bảo trì phòng tập hoặc HLV có việc đột xuất', 'e.g. Room maintenance or coach emergency')}
            required
          />
        </div>
        <div className="mcal__dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('Quay lại', 'Back')}</button>
          <button type="submit" className="btn-danger" disabled={busy}>{busy ? t('Đang hủy...', 'Cancelling...') : t('Xác nhận hủy buổi', 'Confirm cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}
