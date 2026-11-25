# Spec — Khôi phục 6 bộ môn thể thao đa môn, mỗi môn 1 lớp duy nhất & dọn `/manager/classes` còn 3 tab độc lập

- **Ngày:** 25/11/2026
- **Tham chiếu lịch sử:** commit `1384c4d3` (`update manager page abt create class`, trước các đợt cắt về Gym-only PR `#144`–`#158`).
- **Mục tiêu:**
  1. Khôi phục đầy đủ **6 bộ môn thể thao đa môn** (`Gym`, `Bơi lội`, `Boxing`, `Tennis`, `Cầu lông`, `Yoga`) cùng phòng/khu vực, HLV đa môn, catalog công khai (`sessions`), Sol AI và **Landing page + trang giới thiệu từng bộ môn**.
  2. Giữ tắt hoàn toàn các tính năng ngoài phạm vi: xếp hạng/rank HLV, streak, đánh giá HLV/buổi tập/tháng, cửa hàng (Shop), quản lý thiết bị, chỉ số cơ thể, tiến độ tập, đặt sân tự do theo giờ (`app.legacy.courts-enabled=false`).
  3. Áp quy tắc nghiệp vụ cứng ở cả Backend, Seeder và UI: **mỗi bộ môn chỉ được có tối đa 1 lớp đang hoạt động (`active`) tại cùng một thời điểm**.
  4. Thiết kế lại `/manager/classes` còn đúng **3 tab độc lập, không lặp control, không lọc chéo** trên nền lịch mới chống đè (`WeeklyTimetable` + `+N lớp` + `ClassSessionDetailModal`).

## 1. Danh mục 6 bộ môn & phòng tập (`CatalogSeeder`, `DemoDataSeeder`, `DemoClassSeeder`)

| Bộ môn | Vai trò | Phòng / khu vực mặc định |
|---|---|---|
| `Gym` | Bộ môn chính | `Phòng Gym Tiêu chuẩn` (STANDARD) & `Phòng Gym VIP` (PLATINUM) |
| `Bơi lội` | Bộ môn phụ | `Oasis Lap Pool` |
| `Boxing` | Bộ môn phụ | `Ring Arena 01` (`available`) |
| `Tennis` | Bộ môn phụ | `Sân Tennis 01` (`available`, dùng cho lớp nhóm Tennis) |
| `Cầu lông` | Bộ môn phụ | `Sân Cầu lông 01` (`available`, dùng cho lớp nhóm Cầu lông) |
| `Yoga` | Bộ môn phụ | `Zen Garden Studio` |

- `CatalogSeeder`: `upsertDiscipline(...)` đủ 6 bộ môn + `upsertRoom(...)` idempotent đủ các phòng trên kể cả khi DB đã có sẵn `Phòng Gym Tiêu chuẩn` (không đè thay đổi của Quản lý nếu phòng đã tồn tại).
- `DemoDataSeeder`: khôi phục HLV đa môn (`Gym`, `Yoga`, `Boxing`, `Bơi lội`, bổ sung chuyên môn cho `Tennis` và `Cầu lông` để phân bổ đều).
- `DemoClassSeeder`: chỉ định nghĩa **đúng 1 khóa học đang hoạt động (`active`) cho mỗi bộ môn** (tổng 6 khóa cho 6 bộ môn), và luôn kiểm tra `existsByDiscipline_IdAndStatus(disciplineId, "active")` trước khi seed để không bao giờ tạo lớp thứ 2 cho cùng một bộ môn.

## 2. Quy tắc "mỗi bộ môn tối đa 1 lớp `active`" (`ClassService`)

- `GymClassRepository`:
  - `boolean existsByDiscipline_IdAndStatus(Long disciplineId, String status)`
  - `boolean existsByDiscipline_IdAndStatusAndIdNot(Long disciplineId, String status, Long id)`
- `ClassService`:
  - `createClass()` / `createRecurringClass()`: chặn nếu bộ môn đã có lớp `active` → `409 ConflictException("SCHEDULING_DISCIPLINE_CLASS_EXISTS", "error.scheduling.discipline_class_exists", new Object[]{discipline.getName()}, ...)`.
  - `updateClass()`: nếu trạng thái đích là `active` và tồn tại lớp `active` khác cùng bộ môn (`id != currentId`) → trả `409 SCHEDULING_DISCIPLINE_CLASS_EXISTS`.
  - Muốn mở lớp mới cho bộ môn đã có lớp `active`, Quản lý phải lưu trữ (`archived`) hoặc hủy (`cancelled`) lớp hiện tại trước.
- Bổ sung key `error.scheduling.discipline_class_exists` đồng bộ trên cả 3 bundle (`messages.properties`, `messages_vi.properties`, `messages_en.properties`).
- `PublicCatalogService`: trả `sessions` lớp nhóm sắp tới (7 ngày tới) khi `app.legacy.classes-enabled=true` (tự nhận qua `@Autowired(required = false)` nên vẫn tương thích unit test hiện có).

## 3. Landing đa môn & trang từng bộ môn (`apps/web/src/features/landing/`)

- Khôi phục từ `1384c4d3` (dùng `shared/i18n/sourceText`, không mang lại Shop/rank/streak/đánh giá/đặt sân lẻ):
  - `PublicLayout.tsx`: nav link `Bộ môn` / `Disciplines` (`/#multisport`), title & active state cho trang bộ môn.
  - `FitnessLanding.tsx`: ticker 6 bộ môn, 5 phân khu, daily rhythm đa môn, mục `#multisport` tiêu đề `Các bộ môn`, thẻ chat & FAQ đa môn (vẫn bỏ mục Shop).
  - `SportStack.tsx`: đủ 6 bộ môn (`Gym`, `Bơi lội`, `Boxing`, `Tennis`, `Cầu lông`, `Yoga`); Gym trỏ tới `/member/classes?tab=classes&discipline=Gym` (hoặc `/login`), 5 bộ môn phụ trỏ tới trang chi tiết `/swimming`, `/boxing`, `/tennis`, `/badminton`, `/yoga`.
  - `sportPages.ts` + `SportPage.tsx` + routes `/swimming`, `/boxing`, `/tennis`, `/badminton`, `/yoga`, `/sports/:sportId`: hiển thị 3 chương trình tập + `CatalogSchedule` trực tiếp cho bộ môn đó; mọi nút đặt lịch dẫn về `/member/classes?tab=classes&discipline=<Tên bộ môn>` (không dẫn tới `/member/courts`).
  - `CatalogSections.tsx` (`CatalogSchedule`) & `LiveTrainerProfile.tsx`: hiển thị lịch lớp công khai của 6 bộ môn và lịch lớp của HLV; giữ nút đặt PT 1:1 song song nút xem lịch lớp.

## 4. Trang Quản lý `/manager/classes` — 3 tab độc lập, 0 mục lặp

Gỡ bỏ toàn bộ filter card trùng chức năng ở đỉnh trang (`Tất cả bộ môn`, `Khóa học thuộc ...`, `Phòng tập`, `Huấn luyện viên`) và tab `Tổng quan theo phòng`. Chỉ giữ **1 thanh tab 3 mục hoàn toàn độc lập**:

1. **`Lịch theo bộ môn`**:
   - Chỉ có thanh chip chọn **1 trong 6 bộ môn** (`Gym`, `Bơi lội`, `Boxing`, `Tennis`, `Cầu lông`, `Yoga`) — **không có chip `Tất cả`**, **không có dropdown khóa học/phòng/HLV**.
   - 1 dải thông tin gọn của lớp đang hoạt động thuộc bộ môn đang chọn (tên lớp · phòng · HLV · sĩ số + nút `Sửa lớp`, hoặc nút `+ Tạo lớp cho <môn>` nếu môn đó chưa có lớp).
   - `WeeklyTimetable` full tuần của riêng bộ môn đó; bấm ô trống để thêm buổi cho lớp đó, bấm ô buổi nhỏ mở `ClassSessionDetailModal`.
2. **`Lịch tổng cả tuần`**:
   - Hiển thị lịch gộp của **cả 6 bộ môn** trên `WeeklyTimetable` (màu riêng theo bộ môn, `maxVisibleLanes={2}`, gom từ lớp thứ 3 trở đi trong cùng khung giờ vào nút `+N lớp` mở danh sách chọn).
   - Hoàn toàn độc lập, không bị bộ môn đang chọn ở Tab 1 làm lọc mất dữ liệu.
3. **`Danh sách lớp`**:
   - Bảng danh sách lớp (mặc định hiển thị các lớp đang hoạt động theo từng bộ môn, kèm bộ lọc trạng thái độc lập ngay trong Tab 3 để xem lớp `archived`/`cancelled` nếu cần).
   - Modal tạo lớp mới (`CreateClassModal`): hiển thị rõ bộ môn nào đã có lớp đang hoạt động (khóa chọn / báo rõ quy tắc 1 lớp/môn) và tự chọn sẵn bộ môn chưa có lớp.
