# Chuyển Nhật ký & Lấp đầy sang Admin

Yêu cầu Leader, cập nhật phạm vi SCRUM-124 (UI), SCRUM-109 (Audit API) và SCRUM-120 (lấp đầy). Người dùng đã xác nhận chính sách quyền trước khi triển khai.

Branch: `fix/leader-admin-audit-occupancy`, tạo từ `origin/main` sau fetch, base `a79c5559a5b42ffd3dc8d9cc4996258caf1e24a9`. Không commit/push. Giữ nguyên 6 file local chưa được theo dõi và 5 stash; không stash/pop/reset chúng. Không sửa database, entity, dữ liệu thật, VNPay hoặc đọc/chỉnh sửa `.env`.

## Hành vi và quyền

| Phạm vi | Trước | Sau |
| --- | --- | --- |
| Trang Audit và lấp đầy | `/manager/audit-logs`, Manager | `/admin/audit-logs`, chỉ Admin |
| URL cũ | Render Audit | Không còn route; đi qua fallback `*` về `/` hiện hành |
| Điều hướng Manager | Báo cáo & Nhật ký: Doanh thu, Nhật ký & Lấp đầy | Doanh thu, giữ `/manager/reports` |
| Điều hướng Admin | Tài khoản & Phân quyền | Thêm Nhật ký & Lấp đầy / Audit & occupancy |
| GET `/api/v1/admin/audit-logs` | CENTER_MANAGER, MANAGER | Chỉ ADMIN; Manager nhận 403 |
| GET `/api/v1/reports/class-utilization` | CENTER_MANAGER, MANAGER | Thêm ADMIN, giữ hai role Manager |
| Các API doanh thu/báo cáo còn lại | CENTER_MANAGER, MANAGER | Giữ nguyên; Admin vẫn bị từ chối |

Frontend dùng lại `RoleGuard` và `PortalShell`. Người chưa đăng nhập truy cập route Admin được chuyển tới đăng nhập; role khác chuyển về trang chủ của role. Backend đồng bộ HTTP matcher và `@PreAuthorize`. Matcher GET lấp đầy đặt trước `/reports/**`; annotation riêng của phương thức lấp đầy ghi đè annotation cấp controller, các phương thức còn lại tiếp tục chỉ dành cho Manager.

Không viết lại màn hình: giữ bảng, tìm kiếm tên/email trên trang hiện tại, lọc action/entity, phân trang, Diff, biểu đồ và trạng thái loading/empty/error. Dùng lại catalog VI/EN và CSS portal. Sửa duy nhất nhãn trợ năng nút Trang sau còn viết cứng để đổi ngôn ngữ được.

## File thay đổi

Chuyển từ `apps/web/src/features/manager/` sang `apps/web/src/features/admin/`:

- `ManagerAuditLogsPage.tsx` → `AdminAuditLogsPage.tsx` (đổi tên export/import và nhãn trợ năng).
- `ManagerAuditLogsPage.test.tsx` → `AdminAuditLogsPage.test.tsx` (bổ sung tìm kiếm, phân trang/reset bộ lọc, đổi VI/EN).
- `manager-audit-logs.css` → `admin-audit-logs.css` (nội dung CSS giữ nguyên).
- `auditApi.ts` (giữ nguyên endpoint/logic, sửa chú thích endpoint).
- `auditApi.test.ts` (bổ sung kiểm tra tham số lọc ngày/bộ môn).

Các file còn lại:

- `apps/web/src/app/router.tsx`: route Admin mới, gỡ route Manager cũ.
- `apps/web/src/features/portal/portalNavigation.ts`: menu và nhãn VI/EN.
- `apps/web/src/app/router.auditLogs.test.tsx`: route, fallback, menu và role.
- `apps/web/src/app/auditLogs.access.test.tsx`: chạy guard thật với truy cập trực tiếp URL theo role.
- `apps/web/src/shared/i18n/website.coverage.test.ts`: nhận diện feature admin dùng catalog nhân sự hiện có.
- `apps/web/e2e/specs/12-manager.spec.ts`: chuyển kịch bản Audit sang tài khoản Admin, bổ sung chặn Manager.
- `apps/web/e2e/specs/18-i18n-crawl.spec.ts`: chuyển URL trong danh sách crawl sang Admin.
- `apps/api/src/main/java/com/swp391/scms/security/SecurityConfig.java`: HTTP RBAC.
- `apps/api/src/main/java/com/swp391/scms/audit/AuditController.java`: chỉ ADMIN, cập nhật mô tả.
- `apps/api/src/main/java/com/swp391/scms/reports/ReportController.java`: thêm ADMIN riêng phương thức lấp đầy.
- `apps/api/src/test/java/com/swp391/scms/security/AuditOccupancySecurityTest.java`: 10 test HTTP/method security, role, anonymous và hồi quy báo cáo.
- `docs/api-contracts/openapi-sprint2.yaml`: quyền Audit.
- `docs/api-contracts/openapi-sprint3-coaching-analytics.yaml`: quyền lấp đầy.
- `DESIGN.md`: ghi nhận chủ sở hữu màn hình và route mới.
- Báo cáo này.

## Kiểm chứng và giới hạn

- Đã quan sát test route frontend thất bại trước sửa (3/3) và test RBAC backend thất bại đúng chính sách cũ (4/10), sau sửa bộ kiểm thử liên quan đã pass.
- Maven toàn bộ: 1.412 test, 0 failure, 0 error, 38 skipped. Chạy bằng Maven 3.9.16 đã cache vì wrapper không khởi động được trong môi trường shell. Đặt `SCMS_POSTGRES_TEST_URL` rỗng riêng tiến trình kiểm thử để không chạy test DB thật.
- `scripts/test-database-config.ps1`: 10 trường hợp PASS, không kết nối DB.
- Frontend toàn bộ với timeout mặc định 5 giây: 1.248 PASS, 2 timeout trong `items.geometries.test.ts` (`jacuzzi-tub`, `stair-core`), không có lỗi assertion của tính năng này. Mã Explore3D không thay đổi. Chạy riêng file hình học với `--maxWorkers=1 --testTimeout=30000`: 42/42 PASS. Không chỉnh cấu hình timeout hoặc mã 3D trong repo.
- Lượt xác minh cuối các file liên quan: 7 file, 42/42 PASS (Audit page/API, menu, route/guard và báo cáo Manager). Lượt toàn suite thử lại với 2 worker vẫn gặp timeout hình học và sau đó bị dừng vì kéo dài; không dùng lượt bị dừng để tuyên bố toàn suite PASS.
- `npm.cmd run lint`: PASS (`--max-warnings=0`).
- `npm.cmd run build`: PASS (`tsc -b && vite build`). Vite có cảnh báo chunk lớn cho phần 3D hiện hữu.
- Playwright `test 12-manager 18-i18n-crawl --list`: nạp thành công 13 kịch bản thuộc 2 file; đây chỉ là kiểm tra danh sách, không phải thực thi E2E.
- `git diff --check`: PASS.
- Chưa chạy E2E đăng nhập với backend/dữ liệu thật; không tuyên bố E2E PASS. Test component và HTTP security dùng mock service/API.
- UI lấp đầy hiện có không cung cấp bộ lọc tương tác; giữ nguyên như trước. Bộ lọc ngày/bộ môn sẵn có ở API được giữ và kiểm tra tham số bằng test. Tìm kiếm Audit vẫn giới hạn các dòng trên trang hiện tại như trước.
- Không chạy được `graphify update .`: máy không có lệnh `graphify`, repo không có `graphify-out/graph.json`. Không cài thêm công cụ hoặc quét tài liệu/file local ngoài phạm vi.
