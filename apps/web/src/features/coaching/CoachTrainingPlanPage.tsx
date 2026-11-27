import { useStaffI18n, type StaffMessage, staffMessage, staffNotify as notify } from '../operations/staffI18n';
import { TrainingExerciseFields } from './TrainingExerciseFields';
import { validateExercise, type ExerciseValues } from './trainingExercise';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Modal } from '../../shared/ui/Modal';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { Select } from '../../shared/ui/Select';
import { DatePicker } from '../../shared/ui/DatePicker';
import { StatusMark } from '../../shared/ui/StatusMark';
import { centerNowParts, formatCenterDate, formatCenterTime } from '../../shared/lib/centerTime';
import { getProfile } from '../member/profileApi';
import { addIsoDays } from './coachTimetable';
import { coachingError } from './coachingApi';
import {
  aiApi,
  type CoachOption,
  type MemberOption,
  type WorkoutExerciseItem,
  type AiWorkoutPlanResult,
  type SavedTrainingPlan,
} from './aiApi';
import { Link } from 'react-router-dom';
import './coach-training-plan.css';

// Tạm ẩn các điểm vào AI cho đến khi có provider thực tế.
const AI_UI_ENABLED = true;

const DAYS_OF_WEEK = [
  { id: 1, name: 'Thứ 2' },
  { id: 2, name: 'Thứ 3' },
  { id: 3, name: 'Thứ 4' },
  { id: 4, name: 'Thứ 5' },
  { id: 5, name: 'Thứ 6' },
  { id: 6, name: 'Thứ 7' },
  { id: 7, name: 'Chủ Nhật' },
];

/** Soạn giáo án đi theo từng bước để mỗi màn hình chỉ giữ một nhóm thông tin. */
const PLAN_STEPS = [
  { id: 1, vi: 'Học viên & kế hoạch', en: 'Member & plan' },
  { id: 2, vi: 'Bài tập theo ngày', en: 'Daily exercises' },
  { id: 3, vi: 'Xem lại & kích hoạt', en: 'Review & activate' },
] as const;
/** Mã bước của trình soạn giáo án (lấy từ PLAN_STEPS). */
type PlanStep = (typeof PLAN_STEPS)[number]['id'];

/** Đọc số nguyên/thực hữu hạn từ ô input số; rỗng hoặc NaN trả null. */
function parseOptionalNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Trình soạn giáo án nhiều bước cho HLV/quản lý: chọn học viên và thông tin chung, soạn bài tập (thủ công hoặc
 * gợi ý AI), xem lại rồi lưu và kích hoạt; quản lý phải chọn HLV phụ trách.
 */
/** Bỏ dấu tiếng Việt để tìm kiếm không dấu / có dấu đều khớp. */
const removeAccents = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const RECENT_MEMBERS_KEY = 'scms_coach_recent_member_ids';

function getRecentMemberIds(): number[] {
  try {
    const raw = localStorage.getItem(RECENT_MEMBERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

function saveRecentMemberId(id: number) {
  try {
    const existing = getRecentMemberIds().filter((item) => item !== id);
    const updated = [id, ...existing].slice(0, 10);
    localStorage.setItem(RECENT_MEMBERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function CoachTrainingPlanPage() {
  const { t } = useStaffI18n();
  const [confirm, confirmDialog] = useConfirm();
  const currentUser = getCurrentUser();

  // Phân quyền theo vai trò: chỉ HLV và quản lý được dùng màn này.
  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'COACH' || currentUser.role === 'MANAGER';
  }, [currentUser]);

  const isManager = currentUser?.role === 'MANAGER';

  // Danh sách học viên thật (không có dữ liệu mẫu) và thông tin tổng quan giáo án
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<StaffMessage>('');
  const [membersAttempt, setMembersAttempt] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [recentMemberIds, setRecentMemberIds] = useState<number[]>(() => getRecentMemberIds());

  // Học viên đang chọn trong form
  const selectedMember: MemberOption | undefined = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId);
  }, [members, selectedMemberId]);

  // ID số thực của HLV từ `/profile` (tránh `Number(currentUser.id)` ra NaN khi `currentUser.id` là username).
  const [coachProfileId, setCoachProfileId] = useState<number | null>(() => {
    const parsed = Number(currentUser?.id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  // Chỉ học viên đăng ký 1:1 / đủ điều kiện tạo giáo án mới xuất hiện trong thanh tìm kiếm để soạn giáo án
  const eligibleMembers = useMemo(() => {
    return isManager ? members : members.filter((m) => m.canViewWorkoutPlan !== false);
  }, [members, isManager]);

  // Kiểm tra xem người dùng có đang gõ từ khóa tìm kiếm hay chỉ mới bấm vào thanh search
  const isSearchQueryActive = useMemo(() => {
    const raw = memberSearch.trim();
    if (!raw) return false;
    // Nếu text trùng với học viên đang được chọn thì coi như chưa gõ từ khóa mới
    if (selectedMember && raw === `${selectedMember.fullName} (${selectedMember.memberCode})`) {
      return false;
    }
    return true;
  }, [memberSearch, selectedMember]);

  // Danh sách đề xuất 3 lịch sử tìm kiếm gần nhất khi bấm vào thanh search
  const recommendedRecentMembers = useMemo(() => {
    const recentList: MemberOption[] = [];
    for (const id of recentMemberIds) {
      const found = eligibleMembers.find((m) => m.id === id);
      if (found && !recentList.some((m) => m.id === found.id)) {
        recentList.push(found);
      }
      if (recentList.length >= 3) break;
    }
    // Nếu chưa đủ 3 trong lịch sử, bổ sung từ danh sách hợp lệ
    if (recentList.length < 3) {
      for (const m of eligibleMembers) {
        if (!recentList.some((item) => item.id === m.id)) {
          recentList.push(m);
        }
        if (recentList.length >= 3) break;
      }
    }
    return recentList;
  }, [eligibleMembers, recentMemberIds]);

  // Tìm kiếm học viên thụ hưởng theo tên, số điện thoại hoặc mã học viên.
  const filteredMembers = useMemo(() => {
    const raw = memberSearch.trim();
    if (!raw) return eligibleMembers;
    // Khi đang chọn một học viên và thanh search hiển thị đầy đủ tên học viên đó, danh sách sổ xuống vẫn hiện đầy đủ
    if (selectedMember && raw === `${selectedMember.fullName} (${selectedMember.memberCode})`) {
      return eligibleMembers;
    }
    const q = removeAccents(raw);
    const qDigits = raw.replace(/\D/g, '');
    return eligibleMembers.filter((m) => {
      const name = removeAccents(m.fullName ?? '');
      const code = (m.memberCode ?? '').toLowerCase();
      const phone = (m.phone ?? '').replace(/\D/g, '');
      const matchName = name.includes(q);
      const matchCode = code.includes(raw.toLowerCase());
      const matchPhone = Boolean(qDigits && phone && phone.includes(qDigits));
      return matchName || matchCode || matchPhone;
    });
  }, [eligibleMembers, memberSearch, selectedMember]);

  // Danh sách hiển thị: Nếu chưa gõ tìm kiếm thì chỉ hiển thị tối đa 3 học viên lịch sử gần nhất
  const displayedDropdownMembers = isSearchQueryActive ? filteredMembers : recommendedRecentMembers;

  const handleSelectMember = (m: MemberOption) => {
    setSelectedMemberId(m.id);
    setMemberSearch(`${m.fullName} (${m.memberCode})`);
    setAppliedRecommendationId(undefined);
    if (m.fitnessGoal) setPlanGoal(m.fitnessGoal);
    setShowMemberSuggestions(false);
    if (planError) setPlanError(null);
    saveRecentMemberId(m.id);
    setRecentMemberIds((prev) => [m.id, ...prev.filter((id) => id !== m.id)].slice(0, 10));
  };
  // Manager phải chỉ định Coach phụ trách vì Manager không có hồ sơ Coach của riêng mình
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [planGoal, setPlanGoal] = useState('');

  // Ngày hôm nay theo giờ trung tâm.
  const todayStr = useMemo(() => centerNowParts().date, []);

  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [startDate, setStartDate] = useState(() => centerNowParts().date);
  const [endDate, setEndDate] = useState(() => addIsoDays(centerNowParts().date, 28));

  // Đổi ngày bắt đầu; tự động tính ngày kết thúc theo chu kỳ (tuần).
  const handleStartDateChange = (e: { target: { value: string } }) => {
    const val = e.target.value;
    setStartDate(val);
    setDateError(null);
    if (val) {
      setEndDate(addIsoDays(val, durationWeeks * 7));
    }
  };

  // Đổi chu kỳ (tuần); tự động tính ngày kết thúc theo ngày bắt đầu.
  const handleDurationWeeksChange = (e: { target: { value: string } }) => {
    const parsed = parseOptionalNumber(e.target.value);
    const val = parsed == null ? 1 : Math.min(52, Math.max(1, Math.trunc(parsed)));
    setDurationWeeks(val);
    setDateError(null);
    if (startDate) {
      setEndDate(addIsoDays(startDate, val * 7));
    }
  };

  // Quản lý ngày đang chọn và danh sách bài tập (khởi tạo rỗng để không giao nhầm bài mẫu cho học viên).
  const [activeDay, setActiveDay] = useState<number>(1); // 1 = Thứ 2
  const [exercises, setExercises] = useState<WorkoutExerciseItem[]>([]);
  const exerciseSeqRef = useRef(0);

  // Form thêm động tác mới
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newSets, setNewSets] = useState<number | null>(4);
  const [newReps, setNewReps] = useState<number | null>(12);
  const [newRestSeconds, setNewRestSeconds] = useState<number | null>(60);
  const [newDuration, setNewDuration] = useState<number | null>(15);
  const [newDescription, setNewDescription] = useState('');
  // Lỗi nhập liệu hiển thị ngay dưới trường tương ứng
  const [exerciseError, setExerciseError] = useState<StaffMessage | null>(null);
  const [dateError, setDateError] = useState<StaffMessage | null>(null);
  const [planError, setPlanError] = useState<StaffMessage | null>(null);
  const [step, setStep] = useState<PlanStep>(1);
  const [savedPlanLink, setSavedPlanLink] = useState(false);
  const [aiError, setAiError] = useState<StaffMessage | null>(null);

  // AI Modal States (giữ riêng kết quả AI theo từng học viên để không nhầm khi đổi học viên hoặc đóng/mở lại modal)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSelectedMemberId, setAiSelectedMemberId] = useState<number | null>(null);
  const [aiCoachPrompt, setAiCoachPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isRestoringAi, setIsRestoringAi] = useState(false);
  const [aiResultsByMember, setAiResultsByMember] = useState<Record<number, { result: AiWorkoutPlanResult; durationWeeks: number }>>({});
  const currentAiEntry = aiSelectedMemberId != null ? aiResultsByMember[aiSelectedMemberId] : undefined;
  const aiResult = currentAiEntry?.result ?? null;
  const [appliedRecommendationId, setAppliedRecommendationId] = useState<number | undefined>();

  const mountedRef = useRef(true);
  const aiBusyRef = useRef(false);
  const aiReqIdRef = useRef(0);
  const savingPlanRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);


  useEffect(() => {
    if (!hasAccess) return;
    let active = true;
    setMembersLoading(true);
    setMembersError('');
    const loadCoaches = isManager ? aiApi.getActiveCoaches() : Promise.resolve<CoachOption[]>([]);
    if (!isManager) {
      void getProfile()
        .then((profile) => {
          if (active && Number.isInteger(profile?.userId) && profile.userId > 0) {
            setCoachProfileId(profile.userId);
          }
        })
        .catch(() => {
          // Giữ fallback nếu không lấy được hồ sơ số.
        });
    }
    void Promise.all([aiApi.getCoachMembers(), loadCoaches]).then(([loaded, loadedCoaches]) => {
      if (!active) return;
      setMembers(loaded);
      setCoaches(loadedCoaches);
      setSelectedCoachId((prev) => (loadedCoaches.some((c) => c.id === prev) ? prev : null));
      setSelectedMemberId((prev) => (loaded.some((m) => m.id === prev) ? prev : null));
      setAiSelectedMemberId((prev) => (loaded.some((m) => m.id === prev) ? prev : loaded[0]?.id ?? null));
    }).catch(() => {
      if (active) {
        setMembersError(
          staffMessage('Không thể tải danh sách học viên. Vui lòng thử lại.', 'Unable to load the member list. Please try again.'),
        );
      }
    }).finally(() => {
      if (active) setMembersLoading(false);
    });
    return () => {
      active = false;
    };
  }, [hasAccess, isManager, membersAttempt]);

  // Định dạng nhãn trình độ tập luyện song ngữ, không hiển thị enum thô.
  const formatFitnessLevel = (level?: string | null): string => {
    const normalized = (level ?? '').trim().toLowerCase();
    if (normalized === 'beginner') return t('Cơ bản', 'Beginner');
    if (normalized === 'intermediate') return t('Trung cấp', 'Intermediate');
    if (normalized === 'advanced') return t('Nâng cao', 'Advanced');
    return '—';
  };

  // Định dạng rút gọn mục tiêu hội viên trong danh sách chọn AI (chỉ thêm dấu "…" khi dài hơn 40 ký tự).
  const formatGoalPreview = (goal?: string | null): string => {
    const trimmed = goal?.trim();
    if (!trimmed) return t('Chưa cập nhật', 'Not set');
    return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
  };

  // Lấy ID số của HLV phụ trách (Quản lý lấy HLV đã chọn; HLV lấy userId từ /profile).
  const resolveCoachId = async (): Promise<number | null> => {
    if (isManager) return selectedCoachId;
    if (coachProfileId != null) return coachProfileId;
    try {
      const profile = await getProfile();
      if (Number.isInteger(profile?.userId) && profile.userId > 0) {
        if (mountedRef.current) setCoachProfileId(profile.userId);
        return profile.userId;
      }
    } catch {
      // Fallback sang currentUser.id nếu là số.
    }
    const parsed = Number(currentUser?.id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  // Tìm giáo án đang áp dụng của đúng HLV phụ trách cho một hội viên.
  const findCoachActivePlan = async (memberId: number): Promise<SavedTrainingPlan | undefined> => {
    try {
      const [plans, planCoachId] = await Promise.all([
        aiApi.listTrainingPlans(memberId),
        resolveCoachId(),
      ]);
      if (!Array.isArray(plans)) return undefined;
      return plans.find((plan) =>
        plan.status === 'active'
        && (planCoachId != null ? plan.coachId === planCoachId : plan.coachId == null));
    } catch {
      return undefined;
    }
  };

  // Học viên đang chọn trong AI Modal
  const aiSelectedMember: MemberOption | undefined = useMemo(() => {
    return members.find((m) => m.id === aiSelectedMemberId) ?? selectedMember ?? members[0];
  }, [members, aiSelectedMemberId, selectedMember]);

  // Thêm bài tập thủ công vào ngày đang chọn (qua validateExercise đầy đủ).
  const handleAddExercise = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate: ExerciseValues = {
      dayOfWeek: activeDay,
      exerciseName: newExerciseName,
      description: newDescription.trim() || null,
      sets: newSets,
      reps: newReps,
      durationMinutes: newDuration,
      restSeconds: newRestSeconds,
    };
    const validationError = validateExercise(candidate, true);
    if (validationError) {
      setExerciseError(validationError);
      document.getElementById('exercise-name-input')?.focus();
      return;
    }
    setExerciseError(null);

    const item: WorkoutExerciseItem = {
      id: `ex-${++exerciseSeqRef.current}`,
      dayOfWeek: activeDay,
      exerciseName: newExerciseName.trim(),
      description: newDescription.trim() || undefined,
      sets: newSets ?? undefined,
      reps: newReps ?? undefined,
      durationMinutes: newDuration ?? undefined,
      restSeconds: newRestSeconds ?? undefined,
    };

    setExercises((prev) => [...prev, item]);
    setNewExerciseName('');
    setNewDescription('');
  };

  const [editingExercise, setEditingExercise] = useState<{ id: string; values: ExerciseValues } | null>(null);
  const [editExerciseError, setEditExerciseError] = useState<StaffMessage>('');

  // Xóa bài tập
  const handleRemoveExercise = (id?: string) => {
    if (!id) return;
    setExercises((prev) => prev.filter((item) => item.id !== id));
  };

  // Bài tập thuộc ngày đang chọn
  const dayExercises = useMemo(() => {
    return exercises.filter((item) => item.dayOfWeek === activeDay);
  }, [exercises, activeDay]);

  // Đếm bài tập theo từng ngày
  const countByDay = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const d of DAYS_OF_WEEK) {
      counts[d.id] = exercises.filter((e) => e.dayOfWeek === d.id).length;
    }
    return counts;
  }, [exercises]);

  // Xử lý gọi AI gợi ý (khóa chống double-click & kiểm tra unmount/request-id).
  const handleGenerateAiPlan = async () => {
    if (aiSelectedMemberId == null || aiBusyRef.current) return;
    aiBusyRef.current = true;
    const reqId = ++aiReqIdRef.current;
    const targetMemberId = aiSelectedMemberId;
    const weeks = Math.min(52, Math.max(1, Math.trunc(Number(durationWeeks) || 4)));
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const res = await aiApi.generateWorkoutPlan({
        memberId: targetMemberId,
        coachId: isManager && selectedCoachId != null ? selectedCoachId : undefined,
        additionalRequirements: aiCoachPrompt,
        durationWeeks: weeks,
      });
      if (!mountedRef.current || reqId !== aiReqIdRef.current) return;
      setAiResultsByMember((prev) => ({
        ...prev,
        [targetMemberId]: { result: res, durationWeeks: weeks },
      }));
    } catch (err) {
      if (mountedRef.current && reqId === aiReqIdRef.current) {
        setAiError(
          coachingError(
            err,
            'Không thể tạo gợi ý giáo án bằng AI lúc này. Vui lòng thử lại.',
            'Unable to generate an AI workout plan right now. Please try again.',
          ),
        );
      }
    } finally {
      aiBusyRef.current = false;
      if (mountedRef.current && reqId === aiReqIdRef.current) {
        setIsGeneratingAi(false);
      }
    }
  };

  // Khôi phục gợi ý AI gần nhất đã lưu trên server cho học viên đang chọn
  const handleRestoreLatestAiPlan = async () => {
    if (aiSelectedMemberId == null || aiBusyRef.current) return;
    aiBusyRef.current = true;
    const reqId = ++aiReqIdRef.current;
    const targetMemberId = aiSelectedMemberId;
    setIsRestoringAi(true);
    setAiError(null);
    try {
      const recs = await aiApi.getMemberRecommendations(targetMemberId);
      if (!mountedRef.current || reqId !== aiReqIdRef.current) return;
      let latest: AiWorkoutPlanResult | undefined;

      // Ưu tiên 1: Nếu trong trình soạn của học viên này đang có giáo án bài tập đã áp dụng trước đó
      if (selectedMemberId === targetMemberId && exercises.length > 0) {
        const targetMember = members.find((m) => m.id === targetMemberId);
        latest = {
          id: appliedRecommendationId ?? 0,
          memberId: targetMemberId,
          memberName: targetMember?.fullName,
          goal: planGoal || targetMember?.fitnessGoal || '',
          analysis: t(
            'Giáo án AI đã áp dụng trước đó trong trình soạn của học viên này.',
            'Previously applied AI plan from the draft editor for this member.'
          ) as string,
          items: exercises.map((ex) => ({
            dayOfWeek: ex.dayOfWeek,
            exerciseName: ex.exerciseName,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.restSeconds,
            durationMinutes: ex.durationMinutes,
            description: ex.description,
          })),
        };
      }

      // Ưu tiên 2: Nếu chưa có trong trình soạn, lấy từ lịch sử server
      if (!latest) {
        latest = Array.isArray(recs)
          ? recs.find((r) => !r.applied && Array.isArray(r.items) && r.items.length > 0)
          ?? recs.find((r) => Array.isArray(r.items) && r.items.length > 0)
          : undefined;
      }

      if (!latest) {
        setAiError(
          staffMessage(
            'Học viên này chưa có lịch sử gợi ý AI nào được lưu. Bạn hãy bấm "Phân tích & Sinh giáo án bằng AI" ở bên cạnh để tạo gợi ý trước nhé.',
            'No saved AI workout suggestion found for this member yet. Please click "Analyze & Generate AI Plan" on the right to create one first.',
          ),
        );
        return;
      }
      const weeks = Math.min(52, Math.max(1, Math.trunc(Number(durationWeeks) || 4)));
      setAiResultsByMember((prev) => ({
        ...prev,
        [targetMemberId]: { result: latest, durationWeeks: weeks },
      }));
    } catch (err) {
      // Nếu gọi server lỗi nhưng trong trình soạn đã có giáo án đang áp dụng cho học viên này:
      if (selectedMemberId === targetMemberId && exercises.length > 0) {
        const targetMember = members.find((m) => m.id === targetMemberId);
        const fallbackPlan: AiWorkoutPlanResult = {
          id: appliedRecommendationId ?? 0,
          memberId: targetMemberId,
          memberName: targetMember?.fullName,
          goal: planGoal || targetMember?.fitnessGoal || '',
          analysis: t(
            'Giáo án AI đang được áp dụng trong trình soạn cho học viên này.',
            'Current AI plan applied in the draft editor for this member.'
          ) as string,
          items: exercises.map((ex) => ({
            dayOfWeek: ex.dayOfWeek,
            exerciseName: ex.exerciseName,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.restSeconds,
            durationMinutes: ex.durationMinutes,
            description: ex.description,
          })),
        };
        const weeks = Math.min(52, Math.max(1, Math.trunc(Number(durationWeeks) || 4)));
        setAiResultsByMember((prev) => ({
          ...prev,
          [targetMemberId]: { result: fallbackPlan, durationWeeks: weeks },
        }));
        setAiError(null);
      } else if (mountedRef.current && reqId === aiReqIdRef.current) {
        setAiError(
          coachingError(
            err,
            'Không thể tải gợi ý gần nhất của học viên. Vui lòng thử lại.',
            'Unable to load the latest suggestion for this member. Please try again.',
          ),
        );
      }
    } finally {
      aiBusyRef.current = false;
      if (mountedRef.current && reqId === aiReqIdRef.current) {
        setIsRestoringAi(false);
      }
    }
  };

  // AC: Nút "Áp dụng vào giáo án"
  const [isApplyingAi, setIsApplyingAi] = useState(false);
  const applyingAiRef = useRef(false);

  const handleApplyAiPlan = async () => {
    if (!aiResult || !aiResult.items || aiResult.items.length === 0) return;
    if (applyingAiRef.current) return;
    applyingAiRef.current = true;
    setIsApplyingAi(true);

    try {
      // Đã soạn tay (bài tập chưa lưu trong trình soạn) hoặc HLV phụ trách đã có giáo án đang áp dụng cho học viên: hỏi trước khi ghi đè.
      // Mỗi cặp hội viên–HLV có một giáo án đang áp dụng; giáo án của HLV khác không bị ảnh hưởng nên không cần cảnh báo.
      const handComposed = exercises.filter((item) => !item.id?.startsWith('ai-item-')).length;
      const activePlan = await findCoachActivePlan(aiResult.memberId);
      if (!mountedRef.current) return;
      const resolvedMemberName = aiResult.memberName || members.find((m) => m.id === aiResult.memberId)?.fullName;

      const appliedWeeks = currentAiEntry?.durationWeeks ?? Math.min(52, Math.max(1, Math.trunc(Number(durationWeeks) || 4)));
      const nextEndDate = startDate ? addIsoDays(startDate, appliedWeeks * 7) : endDate;
      const newPlanRange = startDate && nextEndDate ? `${formatCenterDate(startDate)} – ${formatCenterDate(nextEndDate)}` : '';

      if (handComposed > 0 || activePlan) {
        const memberLabelVi = resolvedMemberName || 'học viên';
        const memberLabelEn = resolvedMemberName || 'this member';
        const lines: string[] = [];
        const linesEn: string[] = [];
        if (handComposed > 0) {
          lines.push(`Bạn đã soạn tay ${handComposed} bài tập trong trình soạn. Áp dụng gợi ý AI sẽ thay thế các bài tập đó.`);
          linesEn.push(`You have hand-composed ${handComposed} exercise(s) in the editor. Applying the AI suggestion will replace them.`);
        }
        if (activePlan) {
          const oldRange = `${formatCenterDate(activePlan.startDate)} – ${formatCenterDate(activePlan.endDate)}`;
          lines.push(`${memberLabelVi} đang có giáo án cũ "${activePlan.goal || 'chưa đặt mục tiêu'}" (thời gian cũ: ${oldRange}) đang áp dụng. Bạn đang chuẩn bị áp dụng giáo án AI mới với chu kỳ ${appliedWeeks} tuần (${newPlanRange}). Khi bạn lưu giáo án mới, giáo án cũ sẽ được chuyển vào lịch sử.`);
          linesEn.push(`${memberLabelEn} currently has the old plan "${activePlan.goal || 'no goal set'}" (old dates: ${oldRange}) in use. You are applying a new AI plan with a ${appliedWeeks}-week cycle (${newPlanRange}). When saved, the old plan moves to history.`);
        }
        const confirmed = await confirm({
          title: staffMessage('Ghi đè giáo án đã soạn trước đó?', 'Overwrite the plan you composed earlier?'),
          message: staffMessage(lines.join(' '), linesEn.join(' ')),
          confirmLabel: staffMessage('Ghi đè bằng giáo án AI', 'Overwrite with AI plan'),
          cancelLabel: staffMessage('Giữ giáo án hiện tại', 'Keep current plan'),
        });
        if (!confirmed || !mountedRef.current) return;
      }

      // Cập nhật thông tin hội viên, mục tiêu & chu kỳ ngày theo kết quả AI
      setSelectedMemberId(aiResult.memberId);
      setAppliedRecommendationId(aiResult.id);
      setPlanGoal(aiResult.goal);
      setDurationWeeks(appliedWeeks);
      if (nextEndDate) {
        setDateError(null);
        setEndDate(nextEndDate);
      }

      // Điền toàn bộ bài tập do AI gợi ý vào danh sách bài tập của HLV (dùng bộ đếm tăng dần tránh trùng ID)
      const batchId = ++exerciseSeqRef.current;
      setExercises(
        aiResult.items.map((item, idx) => ({
          ...item,
          id: `ai-item-${batchId}-${idx}`,
        }))
      );

      // Chuyển sang ngày đầu tiên có bài tập và mở thẳng Bước 2 để HLV tinh chỉnh (trừ khi Quản lý chưa chọn HLV)
      if (aiResult.items[0]?.dayOfWeek) {
        setActiveDay(aiResult.items[0].dayOfWeek);
      }

      setIsAiModalOpen(false);
      if (!(isManager && selectedCoachId == null) && !(startDate && nextEndDate && nextEndDate < startDate)) {
        setPlanError(null);
        setStep(2);
      }
      notify(staffMessage('Đã áp dụng giáo án từ AI. Bạn có thể tinh chỉnh trước khi lưu.', 'AI plan applied. You can refine it before saving.'), 'success');
    } finally {
      applyingAiRef.current = false;
      if (mountedRef.current) setIsApplyingAi(false);
    }
  };

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Mở khóa lại nút Lưu khi HLV chỉnh sửa nội dung giáo án hoặc chuyển sang học viên/HLV khác.
  useEffect(() => {
    setLastSavedTime(null);
    setSavedPlanLink(false);
  }, [selectedMemberId, selectedCoachId, planGoal, startDate, endDate, exercises]);

  const coachBlockedByTier = Boolean(!isManager && selectedMember?.canViewWorkoutPlan === false);

  // Bước 1 phải hợp lệ trước khi đi tiếp: có học viên, có mục tiêu, đủ ngày bắt đầu/kết thúc hợp lệ và (Quản lý) đã chọn HLV phụ trách.
  const planInfoError = (): StaffMessage | null =>
    !selectedMember ? staffMessage('Vui lòng chọn học viên thụ hưởng.', 'Please select a beneficiary member.')
      : !planGoal.trim() ? staffMessage('Vui lòng nhập mục tiêu giáo án.', 'Please enter a training plan goal.')
        : !startDate || !endDate ? staffMessage('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.', 'Please select both start and end dates.')
          : endDate < startDate ? staffMessage('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.', 'End date must be on or after the start date.')
            : isManager && selectedCoachId == null ? staffMessage('Quản lý cần chọn huấn luyện viên phụ trách trước khi lưu giáo án.', 'Managers must select an assigned coach before saving a plan.')
              : null;
  // Chuyển bước; sang bước sau phải qua kiểm tra thông tin chung, lỗi thì quay về bước 1.
  const goToStep = (next: PlanStep) => {
    if (next > 1) {
      const invalid = planInfoError();
      setPlanError(invalid);
      if (invalid) { setStep(1); return; }
    }
    setPlanError(null);
    setStep(next);
  };

  // Lưu & Kích hoạt giáo án
  const [isSaving, setIsSaving] = useState(false);
  // Lưu và kích hoạt giáo án sau khi kiểm tra hợp lệ toàn bộ bài tập, ngày, phân quyền hạng gói và xác nhận ghi đè.
  const handleSavePlan = async () => {
    if (savingPlanRef.current) return;
    const trimmedGoal = planGoal.trim();
    const invalidExercise = exercises.map((item) => validateExercise(item, true)).find(Boolean) ?? null;
    const invalid: StaffMessage | null =
      exercises.length === 0 ? staffMessage('Giáo án chưa có bài tập nào. Vui lòng thêm bài tập trước khi lưu.', 'This plan has no exercises yet. Please add at least one exercise before saving.')
        : invalidExercise ? invalidExercise
          : !trimmedGoal ? staffMessage('Vui lòng nhập mục tiêu giáo án.', 'Please enter a training plan goal.')
            : !startDate || !endDate ? staffMessage('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.', 'Please select both start and end dates.')
              : endDate < startDate ? staffMessage('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.', 'End date must be on or after the start date.')
                : !selectedMember ? staffMessage('Chưa xác minh được học viên. Tải lại danh sách.', 'Could not verify the member. Please reload the list.')
                  : isManager && selectedCoachId == null ? staffMessage('Quản lý cần chọn huấn luyện viên phụ trách trước khi lưu giáo án.', 'Managers must select an assigned coach before saving a plan.')
                    : coachBlockedByTier ? staffMessage(
                      'Học viên đang dùng gói Silver nên huấn luyện viên không thể tạo giáo án cá nhân (yêu cầu gói Gold hoặc Platinum).',
                      'This member is on the Silver plan, so coaches cannot create a personal plan (requires Gold or Platinum).',
                    )
                      : null;
    setPlanError(invalid);
    if (invalid || !selectedMember) return;

    savingPlanRef.current = true;
    setIsSaving(true);
    try {
      const existingActive = await findCoachActivePlan(selectedMember.id);
      if (!mountedRef.current) return;
      if (existingActive) {
        const range = `${formatCenterDate(existingActive.startDate)} – ${formatCenterDate(existingActive.endDate)}`;
        const confirmed = await confirm({
          title: staffMessage('Thay thế giáo án đang áp dụng?', 'Replace the active training plan?'),
          message: staffMessage(
            `${selectedMember.fullName} đang có giáo án "${existingActive.goal || 'chưa đặt mục tiêu'}" (${range}) đang áp dụng của huấn luyện viên này. Khi kích hoạt giáo án mới, giáo án cũ sẽ chuyển vào lịch sử và có thể áp dụng lại bất cứ lúc nào.`,
            `${selectedMember.fullName} already has the active plan "${existingActive.goal || 'no goal set'}" (${range}) from this coach. Activating the new plan will move the previous one to history, where it can be re-applied at any time.`,
          ),
          confirmLabel: staffMessage('Kích hoạt giáo án mới', 'Activate new plan'),
          cancelLabel: staffMessage('Hủy', 'Cancel'),
        });
        if (!confirmed || !mountedRef.current) return;
      }

      await aiApi.saveTrainingPlan(
        {
          memberId: selectedMember.id,
          coachId: isManager ? selectedCoachId ?? undefined : undefined,
          title: trimmedGoal,
          goal: trimmedGoal,
          startDate,
          endDate,
          items: exercises,
          status: 'active',
          isAiGenerated: appliedRecommendationId !== undefined,
          aiRecommendationLogId: appliedRecommendationId,
        },
        true
      );
      if (!mountedRef.current) return;

      const nowTime = formatCenterTime(new Date().toISOString());
      setLastSavedTime(nowTime);
      setSavedPlanLink(true);
      notify(staffMessage(`Đã lưu và kích hoạt giáo án "${trimmedGoal}" cho học viên ${selectedMember.fullName}.`, `Saved and activated training plan "${trimmedGoal}" for member ${selectedMember.fullName}.`), 'success');
    } catch (err) {
      if (mountedRef.current) {
        const errMsg = coachingError(
          err,
          'Đã xảy ra lỗi khi lưu giáo án. Vui lòng thử lại.',
          'An error occurred while saving the training plan. Please try again.',
        );
        setPlanError(errMsg);
        notify(errMsg, 'error');
      }
    } finally {
      savingPlanRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  };

  if (!hasAccess) {
    return (
      <div data-i18n-managed className="portal-container">
        <PageHeader title={t("Soạn giáo án bài tập")} />
        <div className="portal-card" style={{ padding: '36px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <StatusMark type="error" size={56} />
          </div>
          <h2 style={{ color: 'var(--portal-danger)', marginBottom: '8px' }}>{t("Truy cập bị từ chối", "Access denied")}</h2>
          <p style={{ color: 'var(--portal-muted)', maxWidth: '500px', margin: '0 auto' }}>
            {t("Bàn làm việc thiết kế giáo án chỉ dành cho tài khoản ", "The training plan workspace is only available to ")}<strong>{t("Huấn luyện viên", "Coaches")}</strong> {t("hoặc", "or")}{' '}
            <strong>{t("Quản lý", "Managers")}</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (membersLoading || membersError) {
    return <div data-i18n-managed className="portal-container plan-editor-page">
      <PageHeader title={t("Soạn giáo án")} />
      {membersLoading ? <LoadingSkeleton label={t("Đang tải học viên và thông tin giáo án…")} variant="profile" />
        : <div className="portal-card" role="alert"><p>{t(membersError)}</p><button type="button" className="btn-secondary" onClick={() => setMembersAttempt(value => value + 1)}>{t("Thử lại")}</button></div>}
    </div>;
  }

  if (members.length === 0) {
    return <div data-i18n-managed className="portal-container plan-editor-page">
      <PageHeader title={t("Soạn giáo án")} />
      <div className="portal-card" role="status">
        <p><strong>{t("Chưa có học viên để soạn giáo án.")}</strong></p>
        <p>{t("Học viên lấy từ các lớp đã có hội viên ghi danh.")}</p>
        <button type="button" className="btn-secondary" onClick={() => setMembersAttempt(value => value + 1)}>{t("Tải lại danh sách")}</button>
      </div>
    </div>;
  }

  // Mô tả liều tập của bài AI gợi ý: ưu tiên hiệp × lần, rồi hiệp · phút, phút, hiệp, lần; thiếu hết thì "—".
  const formatAiExerciseDose = (item: WorkoutExerciseItem): string => {
    if (item.sets != null && item.reps != null) return `${item.sets} ${t('hiệp', 'sets')} × ${item.reps} ${t('lần', 'reps')}`;
    if (item.sets != null && item.durationMinutes != null) return `${item.sets} ${t('hiệp', 'sets')} · ${item.durationMinutes} ${t('phút', 'min')}`;
    if (item.durationMinutes != null) return `${item.durationMinutes} ${t('phút', 'min')}`;
    if (item.sets != null) return `${item.sets} ${t('hiệp', 'sets')}`;
    if (item.reps != null) return `${item.reps} ${t('lần', 'reps')}`;
    return '—';
  };

  const handleOpenAiModal = () => {
    const targetId = selectedMemberId ?? eligibleMembers[0]?.id ?? null;
    setAiSelectedMemberId(targetId);
    setAiError(null);
    setIsAiModalOpen(true);
  };

  return (
    <div data-i18n-managed className="portal-container plan-editor-page">
      <PageHeader title={t("Soạn giáo án")} />

      <ol className="plan-steps" aria-label={t("Các bước soạn giáo án", "Plan building steps")}>
        {PLAN_STEPS.map((item) => (
          <li key={item.id} className="plan-step">
            <button
              type="button"
              className={`plan-step__button ${step === item.id ? 'is-active' : ''} ${step > item.id ? 'is-done' : ''}`}
              aria-current={step === item.id ? 'step' : undefined}
              onClick={() => goToStep(item.id)}
            >
              <span className="plan-step__index" aria-hidden="true">{step > item.id ? '✓' : item.id}</span>
              <span className="plan-step__label">{t(item.vi, item.en)}</span>
            </button>
          </li>
        ))}
      </ol>

      {planError && <p className="form-error" role="alert">{t(planError)}</p>}

      {/* Bước 1: thông tin kế hoạch */}
      {step === 1 && <div className="plan-meta-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="portal-card-title" style={{ margin: 0, fontSize: '1.2rem' }}>
              {t("Thông tin kế hoạch huấn luyện")}</h2>
            {lastSavedTime && (
              <span data-i18n-managed className="plan-saved-badge">
                {t("Đã kích hoạt (")}{lastSavedTime})
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {t("Tổng số: ")}<strong>{exercises.length} {t(" động tác")}</strong> {t(" được thiết lập trong tuần")}</span>
        </div>

        <div className={`plan-meta-grid ${isManager ? 'plan-meta-grid--manager' : ''}`}>
          <div>
            <label className="portal-label" htmlFor="plan-goal-input">
              {t("Mục tiêu giáo án", "Training plan goal")}</label>
            <input
              id="plan-goal-input"
              type="text"
              maxLength={255}
              className="portal-input"
              value={planGoal}
              onChange={(e) => { setPlanGoal(e.target.value); if (planError) setPlanError(null); }}
              placeholder={t("Ví dụ: Tăng cơ nạc và cải thiện sức bền 4 tuần...", "Example: Build lean muscle and endurance in 4 weeks...")}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <label className="portal-label" htmlFor="plan-member-search">
              {t("Học viên thụ hưởng", "Beneficiary member")}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="plan-member-search"
                type="text"
                autoComplete="off"
                className="portal-input"
                style={{ width: '100%', paddingRight: memberSearch ? '32px' : undefined }}
                placeholder={t("Chưa có học viên thụ hưởng", "No beneficiary member yet")}
                aria-label={t("Tìm kiếm học viên thụ hưởng", "Search assigned member")}
                value={memberSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setMemberSearch(val);
                  setShowMemberSuggestions(true);
                  if (selectedMember && val !== `${selectedMember.fullName} (${selectedMember.memberCode})`) {
                    setSelectedMemberId(null);
                  }
                }}
                onFocus={() => setShowMemberSuggestions(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowMemberSuggestions(false), 200);
                }}
              />
              {memberSearch && (
                <button
                  type="button"
                  aria-label={t("Xóa tìm kiếm học viên", "Clear member search")}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    fontSize: '1rem',
                    lineHeight: 1,
                    padding: 4,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMemberSearch('');
                    setSelectedMemberId(null);
                    setShowMemberSuggestions(true);
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Ẩn select cũ để đảm bảo khả năng tiếp cận và kiểm thử tự động */}
            <select
              id="plan-member-select"
              className="portal-select"
              aria-label={t("Chọn học viên thụ hưởng", "Select assigned member")}
              style={{ display: 'none' }}
              aria-hidden="true"
              value={selectedMemberId == null ? '' : String(selectedMemberId)}
              onChange={(e) => {
                const id = Number(e.target.value);
                const m = members.find((item) => item.id === id);
                if (m) handleSelectMember(m);
              }}
            >
              <option value="" disabled>
                {t("Chưa chọn học viên", "No member selected")}
              </option>
              {eligibleMembers.map((m) => (
                <option data-i18n-managed key={m.id} value={String(m.id)}>
                  {m.fullName} ({m.memberCode})
                </option>
              ))}
            </select>

            {/* Sổ danh sách gợi ý khi click vào thanh search hoặc khi gõ */}
            {showMemberSuggestions && (
              <div
                className="portal-card"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  maxHeight: 230,
                  overflowY: 'auto',
                  marginTop: 4,
                  padding: 4,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                }}
              >
                {!isSearchQueryActive && displayedDropdownMembers.length > 0 && (
                  <div
                    style={{
                      padding: '6px 12px 4px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span aria-hidden="true">🕒</span>
                    <span>{t("Gợi ý lịch sử gần nhất", "Recent search history")}</span>
                  </div>
                )}
                {displayedDropdownMembers.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {t("Không tìm thấy học viên phù hợp", "No matching member found")}
                  </div>
                ) : (
                  displayedDropdownMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 12px',
                        border: 'none',
                        background: m.id === selectedMemberId ? 'var(--sol-accent-soft, rgba(235,94,85,0.12))' : 'transparent',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: 'inherit',
                        fontSize: '0.88rem',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectMember(m);
                      }}
                    >
                      <div>
                        <strong>{m.fullName}</strong> <span className="muted">({m.memberCode})</span>
                      </div>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {m.phone ? `SĐT: ${m.phone}` : '—'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {isManager && <div>
            <label className="portal-label" htmlFor="plan-coach-select">
              {t("Huấn luyện viên phụ trách")}</label>
            <Select
              id="plan-coach-select"
              className="portal-select"
              value={selectedCoachId == null ? '' : String(selectedCoachId)}
              onChange={(e) => setSelectedCoachId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{coaches.length === 0 ? t('Chưa có huấn luyện viên hoạt động') : t('— Chọn huấn luyện viên —')}</option>
              {coaches.map((c) => (
                <option data-i18n-managed key={c.id} value={String(c.id)}>{c.fullName}</option>
              ))}
            </Select>
          </div>}

          <div>
            <label className="portal-label" htmlFor="plan-start-date">
              {t("Ngày bắt đầu")}</label>
            <DatePicker
              id="plan-start-date"
              min={todayStr}
              value={startDate}
              onChange={handleStartDateChange}
            />
          </div>

          <div>
            <label className="portal-label" htmlFor="plan-end-date">
              {t("Ngày kết thúc")}</label>
            <DatePicker
              id="plan-end-date"
              disabled={true}
              min={startDate || todayStr}
              value={endDate}
              onChange={() => { }}
            />
            {dateError && <p className="form-error" role="alert">{t(dateError)}</p>}
          </div>

          <div>
            <label className="portal-label" htmlFor="plan-duration-weeks">
              {t("Chu kỳ (tuần)", "Cycle (weeks)")}</label>
            <input
              id="plan-duration-weeks"
              type="number"
              min={1}
              max={52}
              step={1}
              className="portal-input"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              value={durationWeeks}
              onChange={handleDurationWeeksChange}
            />
          </div>
        </div>

        {/* Xem trước tóm tắt hồ sơ của hội viên */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'var(--portal-raised)',
            borderRadius: '8px',
            border: '1px solid var(--portal-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.84rem',
          }}
        >
          <div>
            <span>{t("Mục tiêu hồ sơ hội viên: ", "Member profile goal: ")}</span>
            <strong style={{ color: 'var(--sol-accent-text)' }}>
              {selectedMember ? (selectedMember.fitnessGoal || t('Chưa cập nhật', 'Not set')) : t('Chưa chọn học viên', 'No member selected')}
            </strong>
          </div>
          <div style={{ color: selectedMember?.healthNotes?.trim() ? 'var(--portal-danger, #fca5a5)' : 'var(--portal-muted)' }}>
            {t("Lưu ý sức khỏe: ")}<strong>{selectedMember?.healthNotes?.trim() || t('Bình thường')}</strong>
          </div>
        </div>

        {isManager && selectedMember?.canViewWorkoutPlan === false && (
          <div
            role="note"
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--portal-border-strong)',
              background: 'var(--portal-raised)',
              color: 'var(--portal-muted)',
              fontSize: '0.82rem',
            }}
          >
            {t(
              'Lưu ý gói tập (quyền Quản lý): Học viên đang dùng gói Silver nên chưa xem được giáo án bài tập trên cổng Hội viên. Quản lý vẫn có thể lưu giáo án nội bộ để huấn luyện viên theo dõi.',
              'Membership note (Manager override): This member is on the Silver plan and cannot view workout plans in the Member portal yet. Managers can still save the plan internally for coach tracking.',
            )}
          </div>
        )}
      </div>}

      {/* Bước 2: bài tập theo ngày */}
      {step === 2 && <div className="portal-card">
        {/* AC: Tab chọn ngày trong tuần */}
        <div className="portal-tabs plan-day-tabs" role="tablist" aria-label={t("Các ngày trong tuần")}>
          {DAYS_OF_WEEK.map((d) => {
            const isActive = activeDay === d.id;
            const count = countByDay[d.id] || 0;
            return (
              <button data-i18n-managed
                key={d.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`portal-tab plan-day-tab ${isActive ? 'active is-active' : ''}`}
                onClick={() => setActiveDay(d.id)}
              >
                <span>{t(d.name)}</span>
                <span className="portal-tab-count plan-day-badge" style={{ fontVariantNumeric: 'tabular-nums' }}>{count} {t(" bài")}</span>
              </button>
            );
          })}
          {AI_UI_ENABLED && (
            <div role="presentation" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingBottom: '6px', flexShrink: 0 }}>
              <button
                type="button"
                className="plan-ai-trigger-btn btn-ai-sparkle"
                onClick={handleOpenAiModal}
              >
                <span>{t("Gợi ý giáo án bằng AI")}</span>
              </button>
            </div>
          )}
        </div>

        {/* AC: Form soạn giáo án theo ngày trong tuần */}
        <form onSubmit={handleAddExercise} className="exercise-form-card" noValidate>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--sol-accent-text)', marginBottom: '12px' }}>
            {t("Thêm bài tập mới vào ")}{t(DAYS_OF_WEEK.find((d) => d.id === activeDay)?.name)}
          </div>

          <div className="exercise-form-grid">
            <div>
              <label className="portal-label" htmlFor="exercise-name-input">
                {t("Tên động tác / bài tập *")}</label>
              <input
                id="exercise-name-input"
                type="text"
                maxLength={150}
                className="portal-input"
                placeholder={t("Ví dụ: Barbell Back Squat, Dumbbell Row...")}
                value={newExerciseName}
                aria-invalid={exerciseError ? true : undefined}
                aria-describedby={exerciseError ? 'exercise-name-error' : undefined}
                onChange={(e) => { setNewExerciseName(e.target.value); if (exerciseError) setExerciseError(null); }}
              />
              {exerciseError && <p id="exercise-name-error" className="form-error" role="alert">{t(exerciseError)}</p>}
            </div>

            <div>
              <label className="portal-label" htmlFor="exercise-sets-input">
                {t("Số hiệp", "Sets")}</label>
              <input
                id="exercise-sets-input"
                type="number"
                min={1}
                max={20}
                step={1}
                className="portal-input"
                value={newSets ?? ''}
                onChange={(e) => { setNewSets(parseOptionalNumber(e.target.value)); if (exerciseError) setExerciseError(null); }}
              />
            </div>

            <div>
              <label className="portal-label" htmlFor="exercise-reps-input">
                {t("Số lần lặp", "Reps")}</label>
              <input
                id="exercise-reps-input"
                type="number"
                min={1}
                max={100}
                step={1}
                className="portal-input"
                value={newReps ?? ''}
                onChange={(e) => { setNewReps(parseOptionalNumber(e.target.value)); if (exerciseError) setExerciseError(null); }}
              />
            </div>

            <div>
              <label className="portal-label" htmlFor="exercise-rest-input">
                {t("Nghỉ (Giây)")}</label>
              <input
                id="exercise-rest-input"
                type="number"
                step={1}
                min={0}
                className="portal-input"
                value={newRestSeconds ?? ''}
                onChange={(e) => { setNewRestSeconds(parseOptionalNumber(e.target.value)); if (exerciseError) setExerciseError(null); }}
              />
            </div>

            <div>
              <label className="portal-label" htmlFor="exercise-duration-input">
                {t("Thời lượng (Phút)")}</label>
              <input
                id="exercise-duration-input"
                type="number"
                min={1}
                step={1}
                className="portal-input"
                value={newDuration ?? ''}
                onChange={(e) => { setNewDuration(parseOptionalNumber(e.target.value)); if (exerciseError) setExerciseError(null); }}
              />
            </div>

            <button type="submit" className="btn-secondary" style={{ height: '42px', alignSelf: 'flex-end' }}>
              {t("Thêm")}</button>
          </div>

          <div style={{ marginTop: '10px' }}>
            <label className="portal-label" htmlFor="exercise-desc-input">
              {t("Ghi chú kỹ thuật / Vùng cơ tác động")}</label>
            <input
              id="exercise-desc-input"
              type="text"
              className="portal-input"
              placeholder={t("Hướng dẫn học viên siết cơ, tư thế lưng, kiểm soát pha hạ tạ...")}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
        </form>

        {/* Danh sách động tác của ngày đang chọn */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--portal-paper)' }}>
              {t("Danh sách bài tập ")}{t(DAYS_OF_WEEK.find((d) => d.id === activeDay)?.name)}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--portal-muted)' }}>
              {dayExercises.length} {t(" động tác đã lập")}</span>
          </div>

          {dayExercises.length === 0 ? (
            <div data-i18n-managed
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                border: '2px dashed var(--portal-border-strong)',
                borderRadius: '8px',
                color: 'var(--portal-muted)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sol-accent-text)', marginBottom: '8px' }}>{t("GIÁO ÁN NGÀY")}</div>
              <div style={{ fontWeight: 600 }}>{t("Chưa có bài tập nào cho ngày này")}</div>
              <p style={{ margin: '4px 0 14px 0', fontSize: '0.84rem' }}>
                {t("Thêm bài tập bằng form ở trên để xây dựng giáo án cho học viên.")}</p>
            </div>
          ) : (
            <div data-i18n-managed className="exercise-items-list">
              {dayExercises.map((item, index) => (
                <div data-i18n-managed key={item.id || index} className="exercise-item-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--portal-raised)',
                        border: '1px solid var(--portal-border)',
                        color: 'var(--sol-accent-text)',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        fontVariantNumeric: 'tabular-nums',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {index + 1}
                    </span>

                    <div className="exercise-item-main">
                      <div className="exercise-item-name">{item.exerciseName}</div>
                      {item.description && <div className="exercise-item-desc">{item.description}</div>}
                    </div>
                  </div>

                  <div className="exercise-item-specs">
                    {item.sets != null && (
                      <div className="exercise-spec-pill">
                        {t("Hiệp: ", "Sets: ")}<strong>{item.sets}</strong>
                      </div>
                    )}
                    {item.reps != null && (
                      <div className="exercise-spec-pill">
                        {t("Lần: ", "Reps: ")}<strong>{item.reps}</strong>
                      </div>
                    )}
                    {item.restSeconds != null && (
                      <div data-i18n-managed className="exercise-spec-pill">
                        {t("Nghỉ: ")}<strong>{item.restSeconds}s</strong>
                      </div>
                    )}
                    {item.durationMinutes != null && (
                      <div data-i18n-managed className="exercise-spec-pill">
                        {t("Thời gian: ")}<strong>{item.durationMinutes}{t("p", " min")}</strong>
                      </div>
                    )}

                    <button type="button" className="btn-secondary btn-sm" aria-label={t(`Sửa bài tập ${item.exerciseName}`, `Edit exercise ${item.exerciseName}`)} onClick={() => { if (item.id) { setEditExerciseError(''); setEditingExercise({ id: item.id, values: { ...item } }); } }}>{t("Sửa")}</button>
                    <button
                      type="button"
                      className="btn-remove-exercise"
                      aria-label={t(`Xóa bài tập ${item.exerciseName}`, `Delete exercise ${item.exerciseName}`)}
                      onClick={() => handleRemoveExercise(item.id)}
                      title={t("Xóa bài tập này")}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}

      {/* Bước 3: xem lại & kích hoạt */}
      {step === 3 && <div className="plan-meta-card plan-review">
        <h2 className="portal-card-title" style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>{t("Xem lại giáo án")}</h2>
        <div className="kv-list">
          <div className="kv-row"><span>{t("Mục tiêu giáo án", "Training plan goal")}</span><strong>{planGoal}</strong></div>
          <div className="kv-row"><span>{t("Học viên thụ hưởng")}</span><strong>{selectedMember?.fullName ?? '—'} ({selectedMember?.memberCode ?? '—'})</strong></div>
          {isManager && <div className="kv-row"><span>{t("Huấn luyện viên phụ trách")}</span><strong>{coaches.find((c) => c.id === selectedCoachId)?.fullName ?? '—'}</strong></div>}
          <div className="kv-row"><span>{t("Thời gian áp dụng")}</span><strong>{formatCenterDate(startDate)} → {formatCenterDate(endDate)}</strong></div>
          <div className="kv-row"><span>{t("Lưu ý sức khỏe")}</span><strong>{selectedMember?.healthNotes || t('Bình thường')}</strong></div>
        </div>
        <div className="plan-review__days">
          {DAYS_OF_WEEK.filter((d) => countByDay[d.id] > 0).map((d) => (
            <div key={d.id} className="plan-review__day">
              <strong>{t(d.name)}</strong>
              <span>{exercises.filter((item) => item.dayOfWeek === d.id).map((item) => item.exerciseName).join(' · ')}</span>
            </div>
          ))}
          {exercises.length === 0 && <p className="muted">{t("Giáo án chưa có bài tập nào. Vui lòng thêm bài tập trước khi lưu.")}</p>}
        </div>
        <p className="plan-review__total">{t("Tổng số: ")}<strong>{exercises.length} {t(" động tác")}</strong>{t(" được thiết lập trong tuần")}</p>
        {lastSavedTime && (
          <p className="plan-saved-badge" role="status">
            {t("Đã kích hoạt (")}{lastSavedTime}){' '}
            {savedPlanLink && <Link to="/coach/saved-plans">{t("Xem giáo án đã lưu")}</Link>}
          </p>
        )}
        <div className="form-actions" style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSavePlan()}
            disabled={isSaving || Boolean(lastSavedTime) || (isManager && selectedCoachId == null) || coachBlockedByTier}
            title={
              isManager && selectedCoachId == null
                ? t('Chọn huấn luyện viên phụ trách để lưu')
                : coachBlockedByTier
                  ? t('Học viên gói Silver chưa đủ điều kiện tạo giáo án cá nhân từ huấn luyện viên.', 'Silver-tier members are not eligible for coach-created personal plans.')
                  : undefined
            }
          >
            {isSaving ? t('Đang lưu...') : lastSavedTime ? t('Đã lưu & Kích hoạt thành công', 'Saved & activated successfully') : t('Lưu & Kích hoạt giáo án')}
          </button>
          {lastSavedTime && (
            <Link to="/coach/saved-plans" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {t("Đi đến danh sách giáo án đã lưu", "Go to saved plans list")}
            </Link>
          )}
        </div>
      </div>}

      <div className="plan-step-nav">
        <button type="button" className="btn-secondary" onClick={() => goToStep((step - 1) as PlanStep)} disabled={step === 1}>
          {t("Quay lại")}</button>
        {step < PLAN_STEPS.length && (
          <button type="button" className="btn-primary" onClick={() => goToStep((step + 1) as PlanStep)}>
            {t("Tiếp tục")}</button>
        )}
      </div>

      {/* AC: Modal Tương Tác AI Gợi Ý Giáo Án */}
      {AI_UI_ENABLED && isAiModalOpen && (
        <Modal
          title={t("Trợ lý AI: gợi ý giáo án huấn luyện cá nhân hóa")}
          busy={isGeneratingAi || isRestoringAi || isApplyingAi}
          onClose={() => { if (!isGeneratingAi && !isRestoringAi && !isApplyingAi) setIsAiModalOpen(false); }}
        >
          <div className="ai-modal-container">
            <div style={{ marginBottom: '14px' }}>
              <label className="portal-label" htmlFor="ai-member-select">
                {t("Chọn học viên cần thiết kế giáo án")}</label>
              <Select
                id="ai-member-select"
                className="portal-select"
                value={String(aiSelectedMemberId ?? eligibleMembers[0]?.id ?? '')}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setAiSelectedMemberId(nextId);
                  setAiError(null);
                }}
                disabled={isGeneratingAi || isRestoringAi || isApplyingAi}
              >
                {eligibleMembers.map((m) => (
                  <option data-i18n-managed key={m.id} value={String(m.id)}>
                    {`${m.fullName} (${m.memberCode}) — ${t('Mục tiêu', 'Goal')}: ${formatGoalPreview(m.fitnessGoal)}`}
                  </option>
                ))}
              </Select>
            </div>

            {/* Xem nhanh mục tiêu & trình độ tập luyện của học viên (không hiển thị chỉ số cơ thể đã tắt) */}
            <div className="ai-member-preview">
              <div>
                <div className="ai-member-stat-label">{t("Mục tiêu tập luyện", "Fitness goal")}</div>
                <div className="ai-member-stat-val">
                  {aiSelectedMember.fitnessGoal?.trim() || t('Chưa cập nhật', 'Not set')}
                </div>
              </div>
              <div>
                <div className="ai-member-stat-label">{t("Trình độ luyện tập", "Fitness level")}</div>
                <div className="ai-member-stat-val">
                  {formatFitnessLevel(aiSelectedMember.fitnessLevel)}
                </div>
              </div>
              <div>
                <div className="ai-member-stat-label">{t("Chu kỳ kế hoạch", "Plan cycle")}</div>
                <div className="ai-member-stat-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {durationWeeks} {t("tuần", "weeks")}
                </div>
              </div>
            </div>

            {isManager && aiSelectedMember.canViewWorkoutPlan === false && (
              <div
                role="note"
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--portal-border-strong)',
                  background: 'var(--portal-raised)',
                  color: 'var(--portal-muted)',
                  fontSize: '0.82rem',
                }}
              >
                {t(
                  'Lưu ý gói tập (quyền Quản lý): Học viên đang dùng gói Silver nên chưa xem được giáo án bài tập trên cổng Hội viên. Quản lý vẫn có thể lưu giáo án nội bộ để huấn luyện viên theo dõi.',
                  'Membership note (Manager override): This member is on the Silver plan and cannot view workout plans in the Member portal yet. Managers can still save the plan internally for coach tracking.',
                )}
              </div>
            )}

            {/* Lưu ý y tế & Tiền sử chấn thương */}
            {aiSelectedMember.healthNotes?.trim() && (
              <div data-i18n-managed className="ai-caution-box">
                <strong>{t("Tiền sử sức khỏe & chấn thương: ")}</strong>
                {aiSelectedMember.healthNotes}
              </div>
            )}

            <div>
              <label className="portal-label" htmlFor="ai-prompt-input">
                {t("Yêu cầu bổ sung (số buổi, trọng tâm, lưu ý)")}</label>
              <textarea
                id="ai-prompt-input"
                className="ai-prompt-textarea"
                value={aiCoachPrompt}
                onChange={(e) => setAiCoachPrompt(e.target.value)}
                placeholder={t("Ví dụ: tối đa 3–4 buổi/tuần, chú ý tiền sử xương khớp", "Example: max 3–4 sessions/week, note joint history")}
                disabled={isGeneratingAi || isRestoringAi || isApplyingAi}
              />
            </div>

            {/* Nút bấm kích hoạt AI & khôi phục gợi ý gần nhất */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              <button
                type="button"
                className="btn-primary btn-ai-sparkle"
                style={{
                  height: '42px',
                  minHeight: '42px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onClick={() => void handleRestoreLatestAiPlan()}
                disabled={isGeneratingAi || isRestoringAi || isApplyingAi}
              >
                <span aria-hidden="true">↺</span>
                <span>{isRestoringAi ? t('Đang tải...', 'Loading...') : t('Khôi phục gợi ý gần nhất', 'Restore latest suggestion')}</span>
              </button>
              <button
                type="button"
                className="btn-primary btn-ai-sparkle"
                style={{
                  height: '42px',
                  minHeight: '42px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onClick={() => void handleGenerateAiPlan()}
                disabled={isGeneratingAi || isRestoringAi || isApplyingAi}
              >
                <span aria-hidden="true">↗</span>
                <span>{isGeneratingAi ? t('Đang phân tích...') : t('Phân tích & Sinh giáo án bằng AI')}</span>
              </button>
            </div>

            {aiError && (
              <div
                role="alert"
                style={{
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  marginBottom: '14px',
                  background:
                    typeof aiError === 'object' && 'vi' in aiError && aiError.vi.includes('chưa có lịch sử gợi ý AI nào')
                      ? 'var(--portal-raised)'
                      : 'rgba(239, 68, 68, 0.1)',
                  border:
                    typeof aiError === 'object' && 'vi' in aiError && aiError.vi.includes('chưa có lịch sử gợi ý AI nào')
                      ? '1px solid var(--portal-border-strong)'
                      : '1px solid rgba(239, 68, 68, 0.35)',
                  color:
                    typeof aiError === 'object' && 'vi' in aiError && aiError.vi.includes('chưa có lịch sử gợi ý AI nào')
                      ? 'var(--portal-paper)'
                      : 'var(--portal-danger, #ef4444)',
                }}
              >
                {t(aiError)}
              </div>
            )}

            {/* Trạng thái Loading AI */}
            {isGeneratingAi && (
              <LoadingSkeleton label={t("Đang phân tích và tạo gợi ý giáo án…")} count={4} />
            )}

            {/* Kết quả AI trả về */}
            {aiResult && !isGeneratingAi && (
              <div data-i18n-managed className="ai-result-box">
                <div className="ai-result-header">
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--sol-accent-text)' }}>
                    {t("Phân tích chuyên sâu từ AI")}</span>
                  <span className="badge badge-success">{t("Đã hoàn thành đề xuất")}</span>
                </div>

                {aiResult.goal && (
                  <div style={{ fontSize: '0.86rem', marginBottom: '10px', color: 'var(--portal-paper)' }}>
                    <span>{t("Mục tiêu đề xuất: ", "Suggested goal: ")}</span>
                    <strong>{aiResult.goal}</strong>
                  </div>
                )}

                <div className="ai-analysis-text">{aiResult.analysis}</div>

                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '10px', color: 'var(--portal-paper)' }}>
                  {t("Đề xuất ")}{aiResult.items.length} {t(" bài tập theo chu kỳ tuần:")}</div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {aiResult.items.map((item, idx) => (
                    <div data-i18n-managed key={idx} className="ai-suggested-item">
                      <div>
                        <strong>{t(DAYS_OF_WEEK.find((d) => d.id === item.dayOfWeek)?.name)}:</strong> {item.exerciseName}
                        <div style={{ fontSize: '0.78rem', color: 'var(--portal-muted)' }}>{item.description}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--sol-accent-text)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {formatAiExerciseDose(item)}</div>
                    </div>
                  ))}
                </div>

                {/* AC: Nút "Áp dụng vào giáo án" */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsAiModalOpen(false)} disabled={isGeneratingAi || isRestoringAi || isApplyingAi}>
                    {t("Hủy bỏ")}</button>
                  <button type="button" className="btn-primary btn-ai-sparkle" onClick={() => void handleApplyAiPlan()} disabled={isGeneratingAi || isRestoringAi || isApplyingAi}>
                    <span>{isApplyingAi ? t("Đang áp dụng…", "Applying…") : t("Áp dụng vào giáo án")}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {editingExercise && <Modal title={t("Sửa bài tập")} onClose={() => setEditingExercise(null)}>
        <form className="stack" onSubmit={event => {
          event.preventDefault();
          const error = validateExercise(editingExercise.values, true);
          if (error) { setEditExerciseError(error); return; }
          const value = editingExercise.values;
          setExercises(current => current.map(item => item.id === editingExercise.id ? {
            ...item,
            exerciseName: value.exerciseName.trim(),
            description: value.description ?? undefined,
            dayOfWeek: value.dayOfWeek!,
            sets: value.sets ?? undefined,
            reps: value.reps ?? undefined,
            restSeconds: value.restSeconds ?? undefined,
            durationMinutes: value.durationMinutes ?? undefined,
          } : item));
          setActiveDay(value.dayOfWeek!); setEditingExercise(null);
        }}>
          <TrainingExerciseFields prefix="draft-exercise" value={editingExercise.values} onChange={values => { setEditExerciseError(''); setEditingExercise({ ...editingExercise, values }); }} />
          {editExerciseError && <p className="form-error" role="alert">{t(editExerciseError)}</p>}
          <div className="form-actions"><button type="button" className="btn-secondary" onClick={() => setEditingExercise(null)}>{t("Hủy")}</button><button type="submit" className="btn-primary">{t("Lưu bài tập")}</button></div>
        </form>
      </Modal>}
      {confirmDialog}
    </div>
  );
}
