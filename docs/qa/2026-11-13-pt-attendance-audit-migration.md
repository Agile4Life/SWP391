# Kết quả sửa audit PT Attendance — 13/11/2026

Branch `fix/receptionist-pt-attendance`, nền `07caf27a`. Báo cáo này thay trạng thái “audit/schema bị chặn” trong báo cáo giai đoạn trước. Leader/user đã duyệt bổ sung `coach_bookings`, kiểm thử database biệt lập và commit/push sau kiểm tra an toàn. Chưa áp dụng lên database chung; commit hash được báo cáo cùng kết quả Git, không ghi sẵn vào artifact trước commit.

## 1. Nguyên nhân HTTP 500 và kết quả

Đã tái hiện bằng PostgreSQL 17.6 thật, không chỉ bằng mock:

1. Fixture dùng CHECK cũ `ck_audit_entity_type`, không chấp nhận `coach_bookings`; insert thử bị SQLSTATE **23514**.
2. `POST /api/v1/coach-bookings/{id}/unmark-attended` gọi service transactional, xóa dấu có mặt trong Entity; audit aspect lưu `PT_ATTENDANCE_UNMARK`, `entity_type=coach_bookings` trong cùng transaction.
3. PostgreSQL từ chối audit insert. Audit aspect catch exception nhưng không thể cứu transaction đã rollback-only; kết thúc transaction trả **HTTP 500**. Đọc lại database xác nhận booking và log lịch sử chưa đổi.
4. Chạy migration tường minh, không chạy Hibernate update. Gọi lại cùng endpoint trả **HTTP 200**; đọc lại database thấy `attended_at=null`, `attendance_locked=true`, `status=confirmed`, đúng một audit entry có actor/booking đúng và không đổi log cũ.

Lỗi rollback do CHECK thiếu `coach_bookings` đã được giải quyết trên source và database isolated. Chưa xác minh hoặc sửa schema đang triển khai trên Supabase/database chung.

## 2. Migration đã triển khai

File: `apps/api/src/main/java/com/swp391/scms/config/trigger/AuditEntityTypeSchemaUpgrade.java`.

Repository không có framework migration đang hoạt động; V1–V3 là lịch sử, policy không cho thêm DDL migration tùy ý vào `db/migrations`. Cơ chế hiện có là nâng cấp tường minh qua `PostgreSqlTriggerProvider`, ví dụ `CenterCheckinSchemaUpgrade`. Bản sửa sử dụng cùng lifecycle, không thêm dependency/framework/profile.

- Entity `AuditLog` thêm đúng `coach_bookings`, giữ nguyên toàn bộ giá trị trước đó, để schema mới cũng đúng.
- Provider chỉ gọi migration CHECK khi bật rõ ràng `app.database.audit-entity-type-upgrade-enabled=true`; mặc định `false`, kể cả constructor không tham số dùng trong các test cũ. Migration dùng JDBC metadata lấy đúng bảng/schema hiện tại, đọc predicate của CHECK qua PostgreSQL catalog; từ chối nếu không tìm thấy CHECK đơn cột `entity_type` đúng tên.
- Trong transaction, khóa riêng bảng audit với thời gian chờ tối đa 10 giây. Nếu CHECK đã cho phép giá trị mới thì không thay constraint.
- Nếu chưa cho phép, thay atomically bằng `CHECK ((predicate_cũ) OR entity_type='coach_bookings')`. Giữ nguyên toàn bộ predicate cũ, kể cả loại hợp lệ chưa có trong Entity hiện tại. Không dùng danh sách hard-code để ghi đè allow-list đang triển khai.
- Không INSERT/UPDATE/DELETE lịch sử audit. Không đổi audit aspect, cách ghi log, transaction order, RBAC hoặc QR.
- Tự commit/rollback khi lấy connection autocommit; nếu đã ở trong transaction thì tham gia transaction đó. Validation thất bại không để lại khoảng trống CHECK đã commit.
- Chạy lặp không đổi OID constraint. Migration không phụ thuộc `ddl-auto=update`; test bootstrap Entity bằng `create` một lần, dựng CHECK legacy, rồi chạy provider trực tiếp mà không khởi tạo Hibernate lần nữa.

### Gate triển khai và đường startup

`DatabaseTriggerInitializer` là ApplicationRunner hiện có, chọn `PostgreSqlTriggerProvider` sau khi EntityManagerFactory sẵn sàng. Spring inject cờ qua constructor `@Value("${app.database.audit-entity-type-upgrade-enabled:false}")`. Khi không có cờ hoặc đặt `false`, provider bỏ qua hoàn toàn migration CHECK audit, không lấy lock/ALTER CHECK qua migration này. Test Spring binding kiểm tra cả mặc định, false và true; test PostgreSQL giữ CHECK legacy/snapshot history nguyên vẹn khi chạy provider mặc định.

Operator chỉ bật trong cửa sổ rollout được duyệt, không nhận request ghi, bằng startup argument:

```text
--app.database.audit-entity-type-upgrade-enabled=true
```

Sau khi xác minh CHECK/history và smoke test ở môi trường được duyệt, bỏ argument này hoặc đặt `false` rồi đưa instance trở lại phục vụ. Không để cờ bật trong cấu hình startup thường xuyên. Với database legacy chưa migration, cờ mặc định tắt đồng nghĩa lỗi audit vẫn còn; không mở tính năng ghi trước khi rollout hoàn tất.

Phạm vi gate là **migration CHECK audit mới**, không phải chế độ startup read-only toàn hệ thống: Hibernate `ddl-auto` và cơ chế cài mandatory triggers/legacy check-in upgrade đã tồn tại trong repository vẫn giữ nguyên. Không chạy backend tùy tiện với database chung; operator phải kiểm soát toàn bộ lifecycle schema hiện có khi deploy. Phiên này không khởi động Spring Boot với database chung. Workflow repository chỉ nhận push main/develop; nhánh fix không kích hoạt workflow deploy production hiện tại.

## 3. Kiểm thử PostgreSQL thật

File: `apps/api/src/test/java/com/swp391/scms/config/PtAttendanceIsolatedPostgreSqlTest.java`.

PostgreSQL portable 17.6 tải từ Maven Central (`io.zonky.test.postgres:embedded-postgres-binaries-windows-amd64:17.6.0`), giải nén trong `apps/api/target/pt-postgres` bị Git ignore; không thêm dependency vào ứng dụng và không cài service hệ thống. Cluster mới chỉ nghe `127.0.0.1:55439`, nhãn `scms_pt_isolated`; đã tắt sau kiểm thử. Test từ chối ghi nếu địa chỉ server hoặc nhãn không khớp; dùng schema UUID riêng. Không đọc `.env`, credentials môi trường hoặc `SCMS_POSTGRES_TEST_*`. Không khởi động Spring Boot application/seeders/schedulers. Kết nối không TLS chỉ dành cho cluster loopback tạm theo yêu cầu PostgreSQL isolated; cấu hình/profile/TLS của API không thay đổi.

Dùng Entity thật, Hibernate/JPA thật, repository thật, `AuditAspect`, Spring transaction advice và endpoint MockMvc thật; Receptionist là actor fixture, không phải tài khoản thật. Mọi bảng được bootstrap từ Entity. Cuối suite schema fixture được xóa; dữ liệu production/shared không liên quan.

| Ca kiểm thử thật | Kết quả |
|---|---|
| CHECK legacy từ chối insert 23514; endpoint unmark 500 và rollback; sau migration endpoint 200 và commit | PASS |
| Migration giữ snapshot toàn bộ trường log lịch sử; giữ tất cả type của Entity và type legacy bổ sung; chạy lần hai giữ OID; type không hỗ trợ vẫn bị chặn | PASS |
| Provider startup mặc định giữ nguyên CHECK legacy và history, vẫn từ chối coach_bookings; không tự kích hoạt migration | PASS |
| Receptionist mark rồi unmark; timestamp/lock/status đúng; mỗi request ghi một log; GET mới trả đúng Attended/Missed/Upcoming | PASS |
| Sau migration, actor audit không tồn tại gây FK **23503**, endpoint 500, booking/log không được commit một phần | PASS |
| Validation migration gặp dữ liệu cũ vi phạm CHECK NOT VALID: rollback nguyên migration, giữ nguyên định nghĩa constraint và history | PASS |
| Trigger hiện tại vẫn chặn confirmed booking khi gói hết hạn; completed booking lịch sử được sửa theo guard hiện hành | PASS |

Suite không phải full E2E browser qua HTTP server đang triển khai. Refresh/chuyển tab/date filter được kiểm thử frontend với API mock; dữ liệu persisted/GET lại được kiểm thử thật tại backend/database.

## 4. Trigger: xác minh và đề xuất, chưa sửa

`scms_guard_pt_schedule` trong `postgresql-triggers.sql` chạy trước mọi INSERT/UPDATE booking. Với `NEW.status='confirmed'`, nó kiểm tra gói active tại ngày thao tác và bao phủ ngày booking, ngay cả khi UPDATE chỉ sửa `attended_at`/`attendance_locked`. Test thật đã tái hiện **23514 / trg_enrollments_check_membership** khi sửa booking lịch sử mà subscription nay đã expired. Booking vẫn nguyên vẹn sau lỗi.

Đối với `completed`, trigger hiện trả về sớm và thao tác sửa lịch sử commit được. Không được tự đổi booking confirmed thành completed để lách kiểm tra.

Theo yêu cầu “xác định và đề xuất tối thiểu, không tự ý bỏ qua xác thực gói”, bản sửa **giữ nguyên trigger**. Nếu Leader xác nhận sửa dấu có mặt lịch sử không phải đặt lịch/check-in mới, đề xuất chỉ bỏ tái kiểm tra lịch/gói cho UPDATE thực sự chỉ thay `attended_at` và/hoặc `attendance_locked`: so sánh toàn bộ các cột còn lại bằng null-safe equality (ví dụ `to_jsonb(NEW)` trừ đúng hai cột này so với `OLD`), và yêu cầu hai cột điểm danh có thay đổi. Không skip theo việc “cùng booking”, không chỉ xét mỗi status. INSERT, đổi member/coach/date/time/status, thanh toán hay bất kỳ cột khác vẫn chạy guard hiện tại. Trigger check-in gói active không đổi. Trước khi áp dụng cần bổ sung test current/expired membership, đổi lịch/status và concurrent writes. Chưa thực hiện thay đổi này.

Hệ quả: sau migration, thao tác hợp lệ với gói đủ điều kiện không còn lỗi CHECK audit. Trường hợp confirmed lịch sử/gói đã expired vẫn bị business trigger từ chối cho đến khi có quyết định nghiệp vụ riêng; bản sửa không che lỗi hoặc giả lập thành công.

## 5. Verification lần cuối

- Backend liên quan trước commit: **151 PASS**, 0 FAIL, 0 ERROR, 0 SKIP; gồm **7 test PostgreSQL thật**, 3 test gate/Spring binding và các test service/controller/security/audit/trigger/database policy/profile.
- Frontend liên quan: **34 PASS / 4 file** (`PtAttendancePage`, `ptAttendanceApi`, `CoachAttendancePage`, `attendanceApi`). Giai đoạn trước full frontend đã PASS 1.253 test; không tính số đó là lần full-suite mới trong follow-up này.
- ESLint: PASS, zero warnings.
- TypeScript `tsc -b` và Vite build: PASS.
- `scripts/test-database-config.ps1`: PASS 10 ca; chỉ process-local ExecutionPolicy Bypass.
- Review độc lập: không thấy blocker trong migration/Entity/provider/test coverage; reviewer không chạy lại suite.
- Log bằng chứng nằm trong target (không commit): `pt-isolated-red.log`, `pt-isolated-green.log`, `pt-final-verification.log`, `pt-isolated-final.log`, `pt-gate-red.log`, `pt-precommit-verification.log`, `pt-precommit-web-build.log`. Test gate đã FAIL trước sửa vì CHECK bị thay đổi khi startup, rồi PASS sau khi mặc định tắt.

Lệnh test opt-in (Maven đã cấu hình trên máy):

```text
mvn -Dscms.pt.isolated.port=55439 -Dtest=PtAttendanceIsolatedPostgreSqlTest test
```

Phải tự khởi tạo một cluster PostgreSQL mới chỉ nghe loopback, role fixture `pt_test`, `cluster_name=scms_pt_isolated`; test không dùng database chung hoặc tự khởi động server. Không đặt property này để nhắm vào một database đang dùng. `hibernate.hbm2ddl.auto=create` chỉ bootstrap các bảng fixture trong schema UUID của cluster đã qua guard, không dùng để migration.

## 6. Còn cần làm trước database chung

1. Review/duyệt PR và cửa sổ triển khai; commit/push branch fix không đồng nghĩa cho phép deploy hoặc chạy migration trên database chung.
2. Operator kiểm tra read-only định nghĩa CHECK thực tế, schema/search_path, quyền ALTER TABLE và snapshot/backup audit theo quy trình của hệ thống. Dữ liệu log cũ không được chỉnh để làm migration pass.
3. Deploy code đã duyệt trong maintenance/no-write window, bật rõ ràng cờ audit migration nêu trên để lifecycle PostgreSQL provider chạy migration; không chỉ thay Entity rồi trông chờ Hibernate update. Sau xác minh, tắt cờ cho startup thường xuyên.
4. Nếu migration validation/lock timeout hoặc drift CHECK khác dự kiến, dừng rollout và điều tra, không tắt constraint/audit. Migration rollback giữ CHECK và log cũ.
5. Xác nhận CHECK chứa nhánh mới, count/snapshot log cũ giữ nguyên và smoke test bằng dữ liệu test được duyệt. Full browser E2E ở môi trường staging còn cần chạy.
6. Quyết định riêng về attendance-only UPDATE cho booking confirmed lịch sử/gói đã hết hạn trước khi tuyên bố hỗ trợ trường hợp này.

Không có bước nào ở trên được tự chạy trên database chung trong phiên này. Hai file local và sáu stash giữ nguyên.

## 7. File trong commit

- `DESIGN.md`
- `apps/api/src/main/java/com/swp391/scms/audit/AuditLog.java`
- `apps/api/src/main/java/com/swp391/scms/coaching/dto/CoachBookingDto.java`
- `apps/api/src/main/java/com/swp391/scms/coaching/service/CoachBookingService.java`
- `apps/api/src/main/java/com/swp391/scms/config/trigger/AuditEntityTypeSchemaUpgrade.java`
- `apps/api/src/main/java/com/swp391/scms/config/trigger/PostgreSqlTriggerProvider.java`
- `apps/api/src/test/java/com/swp391/scms/coaching/CoachBookingServiceTest.java`
- `apps/api/src/test/java/com/swp391/scms/coaching/PtAttendanceSecurityTest.java`
- `apps/api/src/test/java/com/swp391/scms/coaching/PtAttendanceTransactionDiagnosticTest.java`
- `apps/api/src/test/java/com/swp391/scms/config/PtAttendanceIsolatedPostgreSqlTest.java`
- `apps/api/src/test/java/com/swp391/scms/config/trigger/AuditMigrationDeploymentGateTest.java`
- `apps/api/src/test/java/com/swp391/scms/config/trigger/TriggerProvidersTest.java`
- `apps/web/src/features/coaching/PtAttendancePage.tsx`
- `apps/web/src/features/coaching/PtAttendancePage.test.tsx`
- `apps/web/src/features/coaching/ptAttendanceApi.test.ts`
- `apps/web/src/features/member/coachBookingApi.ts`
- `apps/web/src/shared/i18n/translations.ts`
- `docs/api-contracts/openapi-membership-benefits.yaml`
- `docs/rules/backend-architecture.md`
- `docs/specs/2026-11-10-membership-and-attendance-business-rules.md`
- `docs/qa/2026-11-13-pt-attendance.md` (lịch sử giai đoạn đầu, có link tới báo cáo hiện tại)
- `docs/qa/2026-11-13-pt-attendance-audit-migration.md`
- `docs/superpowers/plans/2026-11-13-pt-attendance-fix.md`

Không stage hai file `SCMS_Business_Rules_Latest_Change_Report.md`, `SCMS_Business_Rules_Latest_Updated.docx`, target/binaries/log test hoặc `.env`/secrets.
