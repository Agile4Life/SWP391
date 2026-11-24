import { apiFetch } from '../../shared/api/client';

/** Một bài tập trong giáo án: thứ, tên, mô tả, số hiệp/lần, thời lượng, nghỉ và thứ tự. */
export interface TrainingItem {
  id: number;
  dayOfWeek: number | null;
  exerciseName: string;
  description: string | null;
  sets: number | null;
  reps: number | null;
  durationMinutes: number | null;
  restSeconds?: number | null;
  orderIndex: number;
}

/** Giáo án của hội viên: trạng thái, khoảng ngày, mục tiêu, HLV và danh sách bài tập. */
export interface TrainingPlan {
  id: number;
  status: string;
  startDate: string;
  endDate: string;
  goal: string | null;
  coachName: string | null;
  items: TrainingItem[];
}

// Giữ API Giáo án thật cho Member; các API số đo/completion không còn consumer.
export const getMyTrainingPlans = () => apiFetch<TrainingPlan[]>('/coaching/training-plans/my');
