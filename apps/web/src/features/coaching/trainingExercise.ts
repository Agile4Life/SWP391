import { staffMessage, type StaffMessage } from '../operations/staffI18n';

/** Giá trị một bài tập khi nhập: tên, mô tả, thứ, số hiệp/lần lặp, thời lượng và nghỉ. */
export interface ExerciseValues {
  exerciseName: string;
  description?: string | null;
  dayOfWeek?: number | null;
  sets?: number | null;
  reps?: number | null;
  durationMinutes?: number | null;
  restSeconds?: number | null;
}

/**
 * Kiểm tra bài tập: tên 1–150 ký tự, các số là số nguyên ≥ tối thiểu, thứ từ 1–7, và khi required thì cần thứ
 * cùng (hiệp & lần lặp hoặc thời lượng); trả thông báo lỗi song ngữ hoặc null.
 */
export function validateExercise(values: ExerciseValues, required = false): StaffMessage | null {
  if (!values.exerciseName.trim() || values.exerciseName.trim().length > 150) {
    return staffMessage('Tên bài tập phải có từ 1 đến 150 ký tự.', 'Exercise name must be between 1 and 150 characters.');
  }
  if (required && values.dayOfWeek == null) {
    return staffMessage('Ngày tập phải là số nguyên từ 1 trở lên.', 'Training day must be a whole number of at least 1.');
  }
  const fields = [
    [values.dayOfWeek, 1, 'Ngày tập', 'Training day'],
    [values.sets, 1, 'Số hiệp', 'Sets'],
    [values.reps, 1, 'Số lần lặp', 'Reps'],
    [values.durationMinutes, 1, 'Thời lượng', 'Duration'],
    [values.restSeconds, 0, 'Thời gian nghỉ', 'Rest time'],
  ] as const;
  for (const [value, min, labelVi, labelEn] of fields) {
    if (value == null) continue;
    if (!Number.isInteger(value) || value < min) {
      return staffMessage(
        `${labelVi} phải là số nguyên từ ${min} trở lên.`,
        `${labelEn} must be a whole number of at least ${min}.`,
      );
    }
  }
  if (values.dayOfWeek != null && values.dayOfWeek > 7) {
    return staffMessage('Ngày tập phải từ thứ 2 đến Chủ nhật.', 'Training day must be between Monday and Sunday.');
  }
  if (required && (values.sets == null || values.reps == null) && values.durationMinutes == null) {
    return staffMessage(
      'Bài tập cần có số hiệp & số lần lặp hoặc thời lượng (phút).',
      'An exercise requires sets & reps or duration (minutes).',
    );
  }
  return null;
}

