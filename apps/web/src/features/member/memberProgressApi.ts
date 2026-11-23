import { apiFetch } from '../../shared/api/client';

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
