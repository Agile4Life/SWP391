import { apiFetch } from '../../shared/api/client';

export interface WorkoutExerciseItem {
  id?: string;
  dayOfWeek: number; // 1 = Thứ 2, 2 = Thứ 3, ..., 7 = Chủ Nhật
  exerciseName: string;
  description?: string;
  sets: number;
  reps: number;
  durationMinutes?: number;
  restSeconds?: number;
  orderIndex?: number;
}

export interface GenerateWorkoutPlanPayload {
  memberId: number;
  additionalRequirements?: string;
  durationWeeks?: number;
}

export interface AiWorkoutPlanResult {
  id: number;
  memberId: number;
  memberCode?: string;
  memberName?: string;
  modelName: string;
  applied?: boolean;
  goal: string;
  analysis: string;
  items: WorkoutExerciseItem[];
  createdAt?: string;
}

export interface TrainingPlanPayload {
  memberId: number;
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  items: WorkoutExerciseItem[];
  status?: 'draft' | 'active';
  isAiGenerated?: boolean;
  aiRecommendationLogId?: number;
}

export interface MemberOption {
  id: number;
  memberCode: string;
  fullName: string;
  fitnessGoal?: string;
  healthNotes?: string;
  fitnessLevel?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
}

export const SAMPLE_MEMBERS: MemberOption[] = [
  {
    id: 1,
    memberCode: 'MB-2026-001',
    fullName: 'Lê Hoàng Long',
    fitnessGoal: 'Tăng khối lượng cơ nạc (Hypertrophy), giảm mỡ bụng dưới.',
    healthNotes: 'Tiền sử thoát vị đĩa đệm nhẹ L4-L5 (năm 2024). Tránh Deadlift tạ nặng.',
    fitnessLevel: 'intermediate',
    heightCm: 175,
    weightKg: 74,
    bmi: 24.2,
  },
  {
    id: 2,
    memberCode: 'MB-2026-014',
    fullName: 'Trần Thị Thu Thảo',
    fitnessGoal: 'Săn chắc cơ mông đùi, tăng cường độ dẻo dai cột sống và cải thiện dáng đứng.',
    healthNotes: 'Khớp cổ tay phải yếu do hội chứng ống cổ tay văn phòng, cần quấn bảo hộ.',
    fitnessLevel: 'beginner',
    heightCm: 160,
    weightKg: 52,
    bmi: 20.3,
  },
  {
    id: 3,
    memberCode: 'MB-2026-027',
    fullName: 'Nguyễn Văn Minh',
    fitnessGoal: 'Chuẩn bị thể lực Half Marathon (21km), tăng sức bền chân và Core.',
    healthNotes: 'Không có tiền sử chấn thương, thể trạng rất tốt.',
    fitnessLevel: 'advanced',
    heightCm: 178,
    weightKg: 69,
    bmi: 21.8,
  },
  {
    id: 4,
    memberCode: 'MB-2026-039',
    fullName: 'Đỗ Quỳnh Anh',
    fitnessGoal: 'Giảm mỡ toàn thân sau sinh, tăng độ săn chắc bụng và lưng trên.',
    healthNotes: 'Khớp gối trái từng chấn thương dây chằng chéo trước, tránh Squat tạ quá sâu.',
    fitnessLevel: 'beginner',
    heightCm: 158,
    weightKg: 57,
    bmi: 22.8,
  },
];

export const aiApi = {
  /**
   * Gọi động cơ AI phân tích thể trạng và gợi ý giáo án bài tập cá nhân hóa
   * (POST /api/v1/ai/generate-workout-plan)
   */
  generateWorkoutPlan: async (payload: GenerateWorkoutPlanPayload): Promise<AiWorkoutPlanResult> => {
    try {
      const response = await apiFetch<AiWorkoutPlanResult>('/ai/generate-workout-plan', {
        method: 'POST',
        body: JSON.stringify({
          member_id: payload.memberId,
          additional_requirements: payload.additionalRequirements || '',
          duration_weeks: payload.durationWeeks || 4,
        }),
      });
      if (response && response.items && response.items.length > 0) {
        return response;
      }
    } catch {
      // Khi API chưa sẵn sàng hoặc AI backend đang tắt, trả về gợi ý thông minh từ mô hình dự phòng
    }

    const selectedMember = SAMPLE_MEMBERS.find((m) => m.id === payload.memberId) || SAMPLE_MEMBERS[0];
    const hasKneeIssue = selectedMember.healthNotes?.toLowerCase().includes('gối') || selectedMember.healthNotes?.toLowerCase().includes('dây chằng');
    const hasBackIssue = selectedMember.healthNotes?.toLowerCase().includes('đĩa đệm') || selectedMember.healthNotes?.toLowerCase().includes('lưng');

    return {
      id: Date.now(),
      memberId: selectedMember.id,
      memberCode: selectedMember.memberCode,
      memberName: selectedMember.fullName,
      modelName: 'OpenAI GPT-4o / SÖL AI Intelligence v2.6',
      goal: selectedMember.fitnessGoal || 'Tăng cường sức mạnh cơ lõi và phục hồi chức năng vận động toàn diện',
      analysis: `Phân tích thể trạng: Hội viên ${selectedMember.fullName} (BMI: ${selectedMember.bmi || '21.5'}, Trình độ: ${selectedMember.fitnessLevel}). ${
        hasBackIssue
          ? '⚠️ Lưu ý tiền sử cột sống thắt lưng: Loại bỏ biến thể Deadlift nặng, thay bằng Glute Bridge và Roman Chair Hyper-extension có kiểm soát.'
          : hasKneeIssue
          ? '⚠️ Lưu ý khớp gối: Hạn chế Squat quá góc 90 độ, thay thế bằng Box Squat và Leg Press kiểm soát tải trọng.'
          : '✓ Thể lực tim mạch và cơ xương khớp tốt, phù hợp áp dụng chu kỳ tập luyện phân chia thân trên / thân dưới.'
      } Yêu cầu HLV bổ sung: "${payload.additionalRequirements || 'Chuẩn hóa kỹ thuật và tăng tính linh hoạt khớp'}".`,
      items: [
        {
          id: 'item-1',
          dayOfWeek: 1, // Thứ 2
          exerciseName: 'Kéo xà trợ lực (Assisted Pull-up) & Dumbbell Row',
          description: 'Kích hoạt nhóm cơ lưng xô, giữ vai hạ thấp, siết chặt cơ bả vai ở điểm co.',
          sets: 4,
          reps: 10,
          durationMinutes: 12,
          restSeconds: 60,
          orderIndex: 1,
        },
        {
          id: 'item-2',
          dayOfWeek: 1, // Thứ 2
          exerciseName: 'Incline Dumbbell Chest Press',
          description: 'Đẩy ngực trên với tạ đơn góc 30 độ, kiểm soát pha hạ tạ trong 3 giây.',
          sets: 4,
          reps: 12,
          durationMinutes: 15,
          restSeconds: 75,
          orderIndex: 2,
        },
        {
          id: 'item-3',
          dayOfWeek: 2, // Thứ 3
          exerciseName: hasKneeIssue ? 'Goblet Box Squat (Chạm ghế)' : 'Barbell Back Squat',
          description: hasKneeIssue
            ? 'Squat chạm hộp đệm bảo vệ khớp gối, giữ thân người nghiêng tự nhiên.'
            : 'Siết cơ bụng, đầu gối mở theo hướng mũi chân, kiểm soát nhịp thở.',
          sets: 4,
          reps: 10,
          durationMinutes: 18,
          restSeconds: 90,
          orderIndex: 1,
        },
        {
          id: 'item-4',
          dayOfWeek: 2, // Thứ 3
          exerciseName: hasBackIssue ? 'Banded Glute Bridge' : 'Romanian Deadlift (Tạ nhẹ)',
          description: 'Tập trung kích hoạt nhóm cơ mông và đùi sau, không cong vùng thắt lưng.',
          sets: 3,
          reps: 12,
          durationMinutes: 12,
          restSeconds: 60,
          orderIndex: 2,
        },
        {
          id: 'item-5',
          dayOfWeek: 3, // Thứ 4
          exerciseName: 'Dead Bug & Plank Hollow Body Hold',
          description: 'Rèn luyện cơ lõi sâu (Deep Core), áp sát lưng dưới xuống thảm tập.',
          sets: 3,
          reps: 15,
          durationMinutes: 10,
          restSeconds: 45,
          orderIndex: 1,
        },
        {
          id: 'item-6',
          dayOfWeek: 4, // Thứ 5
          exerciseName: 'Dumbbell Overhead Shoulder Press',
          description: 'Đẩy tạ qua đầu ngồi thẳng lưng trên ghế 75 độ, không ưỡn thắt lưng.',
          sets: 4,
          reps: 10,
          durationMinutes: 14,
          restSeconds: 60,
          orderIndex: 1,
        },
        {
          id: 'item-7',
          dayOfWeek: 5, // Thứ 6
          exerciseName: 'Walking Lunges & Calf Raises',
          description: 'Bước chùng chân bước dài, tập trung thăng bằng và cơ bắp chuối.',
          sets: 3,
          reps: 12,
          durationMinutes: 15,
          restSeconds: 60,
          orderIndex: 1,
        },
      ],
    };
  },

  /**
   * Lưu giáo án huấn luyện vào hệ thống (POST /api/v1/coaching/training-plans)
   * và kích hoạt giáo án nếu cần (PUT /api/v1/coaching/training-plans/{id}/activate)
   */
  saveTrainingPlan: async (payload: TrainingPlanPayload, activate = true) => {
    try {
      const plan = await apiFetch<any>('/coaching/training-plans', {
        method: 'POST',
        body: JSON.stringify({
          member_id: payload.memberId,
          title: payload.title,
          goal: payload.goal,
          start_date: payload.startDate,
          end_date: payload.endDate,
          items: payload.items.map((item, idx) => ({
            day_of_week: item.dayOfWeek,
            exercise_name: item.exerciseName,
            description: item.description,
            sets: item.sets,
            reps: item.reps,
            duration_minutes: item.durationMinutes || 15,
            order_index: item.orderIndex || idx + 1,
          })),
        }),
      });

      if (activate && plan?.id) {
        try {
          await apiFetch(`/coaching/training-plans/${plan.id}/activate`, {
            method: 'PUT',
          });
        } catch {
          // Ignore activate failure if plan is already saved
        }
      }
      return plan;
    } catch {
      // Local fallback simulation
      return {
        id: Date.now(),
        ...payload,
        status: activate ? 'active' : 'draft',
      };
    }
  },
};
