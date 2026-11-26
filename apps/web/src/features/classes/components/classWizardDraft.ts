/** Bản nháp của wizard tạo khóa học, lưu ở localStorage để đóng wizard giữa chừng không mất dữ liệu. */
export interface ClassWizardDraft {
  step: number;
  disciplineId: string;
  name: string;
  level: string;
  price: string;
  description: string;
  startDate: string;
  sessionCount: string;
  recurringDays: string[];
  autoAddedDay: string | null;
  slotCode: string;
  roomId: string;
  coachId: string;
  capacity: string;
  /** ISO timestamp lúc lưu. */
  savedAt: string;
}

export const CLASS_WIZARD_DRAFT_KEY = 'scms_class_wizard_draft';

const isString = (v: unknown): v is string => typeof v === 'string';

/** Đọc bản nháp; dữ liệu hỏng hoặc sai cấu trúc trả null (và bị xóa). */
export function readClassWizardDraft(): ClassWizardDraft | null {
  try {
    const raw = localStorage.getItem(CLASS_WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ClassWizardDraft>;
    const ok = d && typeof d.step === 'number'
      && [d.disciplineId, d.name, d.level, d.price, d.description, d.startDate, d.sessionCount, d.slotCode,
        d.roomId, d.coachId, d.capacity, d.savedAt].every(isString)
      && Array.isArray(d.recurringDays) && d.recurringDays.every(isString)
      && (d.autoAddedDay === null || isString(d.autoAddedDay));
    if (!ok) {
      localStorage.removeItem(CLASS_WIZARD_DRAFT_KEY);
      return null;
    }
    return d as ClassWizardDraft;
  } catch {
    return null;
  }
}

export function writeClassWizardDraft(draft: Omit<ClassWizardDraft, 'savedAt'>): void {
  try {
    localStorage.setItem(CLASS_WIZARD_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch { /* Hết dung lượng hoặc bị chặn storage: wizard vẫn chạy, chỉ không lưu nháp. */ }
}

export function clearClassWizardDraft(): void {
  try {
    localStorage.removeItem(CLASS_WIZARD_DRAFT_KEY);
  } catch { /* bỏ qua */ }
}
