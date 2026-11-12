# Báo cáo tester 12/11/2026 — kết luận, phần đã sửa, việc còn lại

## Kết luận từng mục

| # | Kết luận | Xử lý |
|---|---|---|
| 1 | Bug thật: khóa đã bắt đầu bị từ chối với thông báo sai ("gói không bao phủ ngày …"); seeder đặt `end_date` +42 ngày trong khi buổi chỉ đến +14 | Đã sửa (backend, UI, seeder) |
| 2–3 | Do dữ liệu: lớp cũ không có `recurring_days`, giao diện tự hiện mặc định "Thứ 2, 4, 6" | Đã sửa: backend suy ra lịch từ buổi học thật, UI bỏ mặc định |
| 4 | Không tái hiện: nâng cấp chuyển gói cũ sang `expired` | e2e mục 4 xanh |
| 5 | Nghiệp vụ đã có: hội viên tự rút yêu cầu chờ duyệt hoặc đã duyệt nhưng chưa bắt đầu | Không đổi |
| 6 | Không phải bug: khung 14h trống vì tester có lịch sân, chuỗi dài nhất là 3 slot | Không đổi |
| 7 | Không tái hiện: hủy PT đã trả online hoàn tiền về ví | e2e mục 7 xanh |
| 8 | Góp ý UX: hàng thứ chỉ hiện ở chế độ hàng tuần/hàng tháng | Không đổi |
| 9–10 | Không tái hiện: đặt sân (lượt miễn phí, định kỳ, lượt tính phí) và trả bằng ví đều đúng | e2e mục 9–10 xanh |
| 11 | Tính năng: giao dịch ghi rõ loại và tên dịch vụ | Đã làm |
| 12 | Tính năng: Lễ tân xem lịch sử yêu cầu gói đã xử lý | Đã làm |
| 13 | Đang rà | Xem "Việc còn lại" |

## Thay đổi

- **Mục 1:**
  - `EnrollmentService.enrollCourse` chặn khóa đã bắt đầu trước khi kiểm tra gói, trả `SCHEDULING_COURSE_ALREADY_STARTED`.
  - Trang lớp học của Hội viên hiện nút vô hiệu "Khóa đã bắt đầu".
  - `DemoDataSeeder` đặt `start_date`/`end_date` theo buổi đầu và buổi cuối, và thêm khóa sắp mở "Yoga Cơ Bản (khóa mới)".
- **Mục 2–3:**
  - `SchedulingMapper.toDto(GymClass, sessions)` cùng `ClassService.listClasses` điền thứ, ngày và giờ từ buổi học cho lớp thiếu lịch.
  - `MemberClassesPage` hiện "Theo lịch từng buổi" thay vì đoán.
- **Mục 11:**
  - `PaymentDto` có thêm `serviceType`, `serviceName` và id dịch vụ, được điền ở `GET /payments/my`.
  - Trang "Giao dịch & hóa đơn" hiện dịch vụ và trạng thái.
- **Mục 12:**
  - `GET /memberships/subscriptions/requests/history?days=` dành cho RECEPTIONIST và CENTER_MANAGER, đã thêm vào whitelist trong `SecurityConfig`.
  - Component `MembershipRequestHistory` trên `/staff/reception`.
- **API contract:** `docs/api-contracts/openapi-tester-report-2026-11-12.yaml`.
- **Unit test mới:** `LegacyClassScheduleTest`, `PaymentDescriptionTest`, `MembershipRequestHistoryTypeTest`. Toàn bộ test backend (1392) đã xanh trước khi sửa `SecurityConfig`.

## Việc còn lại cho agent chạy e2e

1. **Chạy `e2e/specs/17-reported-bugs-2.spec.ts`** trên stack mới (DB mới, image API build từ commit này).
   - Lần chạy gần nhất: 8/9 xanh. Mục 12 đỏ 403 vì thiếu whitelist trong `SecurityConfig`; đã sửa nhưng **chưa chạy lại**.
2. **Chạy lại toàn bộ suite e2e.**
   - `06-classes.spec.ts` có test "khóa học đã bắt đầu…" bấm "Đặt chỗ ngay" đầu tiên và chờ thông báo về gói. Khóa đã bắt đầu giờ không còn nút này (chỉ có nút vô hiệu "Khóa đã bắt đầu"), nên test có thể cần cập nhật theo hành vi mới.
   - Các spec dùng lớp demo (05b, 06, 11, 16) có thể bị ảnh hưởng vì demo có thêm khóa "Yoga Cơ Bản (khóa mới)" và ngày kết thúc lớp ngắn hơn.
3. **Mục 13 (i18n):** chạy `I18N_AUDIT=1 npx playwright test 18-i18n-crawl`.
   - Báo cáo nằm ở `e2e/.results/i18n-crawl.json`. Tên gói, lớp, phòng và người là dữ liệu, được phép còn tiếng Việt.
   - Phần còn lại là lỗ hổng cần thêm vào `memberLabels.ts` hoặc `staffSourceCatalog.ts`, hoặc message key backend.
   - Kiểm tra tĩnh `src/shared/i18n/website.coverage.test.ts` hiện xanh cả 64 route, nên lỗ hổng nằm ở chuỗi runtime: thông báo từ server, chuỗi động hoặc template.

### Môi trường trên VPS này

- **Node:** máy dùng Node 18, Vite 8 không chạy được. Hãy dùng container `mcr.microsoft.com/playwright:v1.55.0-noble` (Node 22) với `--network host`.
- **Cổng:** cổng 8080 đang bị container web của VPS dùng, 18080 cũng bận. Hãy chạy stack e2e với file override map API sang `28080:8080` (`ports: !override`) và đặt `E2E_API_URL=http://localhost:28080`. `vite.config.ts` đọc `E2E_API_URL` cho proxy; thay đổi này đang nằm ở working tree, chưa commit.

```bash
docker compose -f e2e/stack/compose.e2e.yml -f <override.yml> up -d --build --wait
docker run --rm --network host -u $(id -u):$(id -g) -e HOME=/tmp -e E2E_API_URL=http://localhost:28080 \
  -v /opt/scms:/opt/scms -w /opt/scms/apps/web mcr.microsoft.com/playwright:v1.55.0-noble \
  npx playwright test e2e/specs/17-reported-bugs-2.spec.ts --reporter=list
```

### Ngoài phạm vi, chưa sửa

- `MemberClassesPage` truyền học phí cứng `price: 500000` khi mở thanh toán khóa học (khoảng dòng 1210) thay vì giá lớp.
