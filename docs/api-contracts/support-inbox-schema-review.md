# Task 3 — Đề xuất schema cho Backend/leader review

Trạng thái: **đề xuất, chưa được nghiệm thu PostgreSQL, chưa được áp dụng lên database chung hoặc production**. Đây là dependency của Draft PR Task 3, không phải hướng dẫn tự triển khai.

Audit ngày 25/11/2026, đối chiếu main `35f922c9` và commit Task 3 `653753b9`. Entity JPA là nguồn schema. Không thêm SQL migration thủ công hoặc thay cấu hình production trong bản audit này.

## Entity, khóa và index

Entity `com.swp391.scms.support.entity.SupportRequestRead` khai báo bảng `support_request_reads`; không ghim schema, dùng schema ứng dụng do Hibernate/JDBC cấu hình. Test PostgreSQL dùng schema UUID riêng, không phải `public`.

| Cột / ràng buộc | Định nghĩa / đánh giá |
|---|---|
| `id` | Java Long, PK BIGINT identity; PK có unique B-tree index PostgreSQL |
| `support_request_id` | NOT NULL, FK → `support_requests.id`, lazy ManyToOne; cascade khi xóa phiếu, giống quan hệ tin nhắn hiện có |
| `user_id` | NOT NULL, FK → `users.id`, lazy ManyToOne; không cascade xóa user; hệ thống dùng soft-delete |
| `last_message_id` | BIGINT NOT NULL, CHECK >= 0; 0 xác nhận yêu cầu ban đầu. Không FK tới message vì 0 là sentinel; cursor dương được service kiểm tra phải là message thuộc cùng phiếu |
| `uq_support_request_read_user` | UNIQUE `(support_request_id, user_id)`, tạo unique index; đủ cho truy vấn receipt theo đúng phiếu/người và subquery inbox |

Không cần thêm index đơn `user_id` cho các truy vấn đang có: không có truy vấn đọc receipt chỉ theo user. Nếu sau này có hard-delete user hoặc truy vấn ledger theo user thì review index đó riêng. Không tự thêm index dự đoán tải hoặc thay bảng tin nhắn trong task này.

## Quyền đọc/ghi và tính nhất quán

- HTTP POST `/api/v1/support/requests/{id}/read` chỉ RECEPTIONIST. Actor phải active, chưa soft-delete, role trong DB khớp token. User ID lấy từ principal, không nhận từ body.
- Tái sử dụng kiểm tra quyền xem phiếu của SupportRequestService. Không thay quyền Manager, chuyển cấp, tạo/trả lời hoặc xử lý status.
- Receipt riêng từng user; A đọc không thay receipt của B. GET inbox không ghi receipt. Member/Coach/Manager không được dùng endpoint read.
- Backend lấy cùng khóa ghi phiếu như luồng gửi tin, kiểm tra cursor thuộc phiếu rồi ghi `max(old, requested)`. Unique key tránh hai receipt cho cùng cặp. Request cũ không kéo cursor lùi.
- Unread = yêu cầu ban đầu chưa có receipt + tin do hội viên chủ phiếu gửi có ID lớn hơn cursor. Tin nhân viên không được tính. Frontend chỉ gửi cursor của snapshot đã tải thành công, không suy ra tin tới sau là đã đọc, không ép count về 0.
- RLS initializer hiện có quét mọi `@Table` của JPA, gồm bảng mới, rồi bật RLS không mở policy Data API. JDBC role phải sở hữu bảng hoặc có quyền bypass RLS như quy tắc hiện tại. Chưa kiểm chứng RLS trên DB thật trong task.

## Dữ liệu cũ

Không sửa/xóa phiếu hoặc tin nhắn cũ; không backfill receipt giả. Khi bảng mới rỗng, mỗi lễ tân ban đầu thấy các phiếu cũ chưa đọc, kể cả phiếu đã đóng, vì trạng thái xử lý không chứng minh đã đọc tin. Bộ lọc status vẫn độc lập.

Leader cần chấp nhận chính sách ban đầu này trước triển khai. Nếu muốn một mốc legacy khác, cần yêu cầu nghiệp vụ riêng; không tự lấy ngày triển khai, người phụ trách hoặc status phiếu làm mốc đã đọc.

## Hibernate/JPA và bảng chưa tồn tại

| Cấu hình | Hành vi dự kiến nếu thiếu bảng |
|---|---|
| `update` | Hibernate có thể tạo bảng/ràng buộc nếu JDBC role đủ quyền; chưa chạy thử DB thật, không coi đây là cách triển khai production |
| `validate` | Không khởi động được vì schema thiếu bảng; đây là fail-fast mong muốn trước khi provision đúng schema |
| `none` | Không tự tạo bảng; RLS initializer vẫn quét entity mới và kiểm tra bảng tồn tại/quyền sở hữu, nên startup không hoàn tất |

`application.yml` dùng `${SPRING_JPA_HIBERNATE_DDL_AUTO:update}`. Tuy nhiên **`compose.yml` đang ghim `SPRING_JPA_HIBERNATE_DDL_AUTO: update`**, ưu tiên hơn `env_file`; vì vậy thêm `validate` vào `.env` đơn thuần không giải quyết được. Backend/ops phải duyệt một cấu hình triển khai/override riêng trước release. Bản audit không sửa compose, pipeline, profile hoặc production.

## Có cần SQL migration không?

**Cần thay đổi schema có kiểm soát; không cần tự viết SQL migration trong PR này.** Quy tắc repository là Code-First: schema phải sinh từ entity, không thêm DDL migration thủ công. Không dựa vào application startup tự cập nhật production.

Đề xuất để leader phê duyệt:

1. Dùng artifact/entity đã review để sinh schema diff ngoài production và kiểm tra chỉ thêm `support_request_reads`, PK/FK/check/unique/index tương ứng. Không thay/xóa bảng nghiệp vụ cũ.
2. Trong Supabase dev/test được phép, dùng schema biệt lập và bước đồng bộ Hibernate **riêng, có kiểm soát**, sau đó khởi động ứng dụng ở `validate`. Kiểm tra cả schema cũ chưa có bảng và lần chạy lại không làm mất receipt/dữ liệu.
3. Chạy test PostgreSQL thật và kiểm tra đồng thời hai phiên gửi/đọc, cursor cũ tới muộn, nhiều lễ tân, các bộ lọc/sắp xếp/phân trang và RLS. Test opt-in hiện có là điểm bắt đầu, chưa thay thế kiểm thử đồng thời thực tế.
4. Backend/ops phê duyệt riêng phương án provision production: artifact schema, backup, owner/grants/RLS, thời gian thực hiện và cấu hình ứng dụng thường ở `validate`. Bước provision phải bảo đảm bảng mới không có khoảng thời gian mở quyền đọc/ghi qua Supabase Data API trước khi RLS được bật và kiểm chứng; không chờ lần khởi động ứng dụng sau đó mới bảo vệ bảng. Chỉ người được phép mới thực hiện thay đổi schema; **không chạy trong task audit này**.
5. Sau khi bảng/ràng buộc/quyền đã được xác nhận, mới duyệt PR khỏi Draft và lên kế hoạch triển khai ứng dụng. Rollback ứng dụng trước nếu cần; giữ bảng và receipt đã ghi, không tự drop dữ liệu mới.

Nếu nhóm muốn dùng SQL migration do công cụ quản lý thay vì bước Hibernate riêng, cần leader duyệt ngoại lệ quy tắc và artifact sinh từ entity trước. Không tự tạo/chạy SQL dựa trên đề xuất này.

## Điều kiện nghiệm thu còn thiếu

- `SupportInboxPostgreSqlTest` chưa chạy vì không có cấu hình `SCMS_POSTGRES_TEST_*`; chỉ chạy sau khi được cấp project dev/test riêng, schema UUID biệt lập. Không dùng credentials production.
- Suite backend offline, repository query parsing và CI xanh **không** chứng minh schema update/validate, SQL thực thi, lock hoặc RLS đã PASS trên PostgreSQL.
- Cần ghi bằng chứng test DB và xác nhận chính sách legacy/read theo từng người trước khi bỏ Draft hoặc cho phép merge/deploy Task 3.
