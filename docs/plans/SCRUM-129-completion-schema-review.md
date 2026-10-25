# SCRUM-129 — Completion schema review (chưa áp dụng)

Repository dùng Hibernate Code-First; `db/migrations/V1–V3` chỉ là tài liệu lịch sử. Vì vậy thay đổi này **không tạo migration DDL chạy trực tiếp**. Entity đề xuất `TrainingItemCompletion` là nguồn schema, nhưng chưa được khởi động với profile Supabase dùng chung.

Schema dự kiến từ Entity: bảng `training_item_completions` gồm `id` identity, `member_id` FK tới `members.user_id`, `training_plan_item_id` FK tới `training_plan_items.id`, `exercise_date` (DATE), `completed_at` (TIMESTAMP), unique `(member_id, training_plan_item_id, exercise_date)`. Khi xóa item, FK completion cascade; xóa member không tự động cascade. Không backfill vì đây là bảng mới và không suy đoán lịch sử hoàn thành.

Trước khi merge/deploy: backend owner review tên bảng/cột, FK, unique và cascade; kiểm thử Hibernate schema update trên Supabase **dev/test schema biệt lập**, đối chiếu DDL thực tế và quyền/RLS của bảng mới. Startup production/shared DB có thể chạy schema update, trigger installer và seed; không dùng để thử thay đổi này. Khi được duyệt, xác minh PUT trùng, PUT/DELETE đồng thời, ownership và refresh bằng MEMBER test thật.
