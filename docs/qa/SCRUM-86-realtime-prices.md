# SCRUM-86 — Giá catalog, Supabase Realtime và popup khi bấm

Cập nhật 29/10/2026 theo yêu cầu người dùng trên PR #67. Owner giao diện gốc: Lê Hoàng Thịnh. Giữ nguyên commit gốc `b1d0d05`, bố cục, typography, thẻ, theme và CSS của contributor; bổ sung commit sửa, merge bằng merge commit.

## Giá và dữ liệu

| Gói | Giá trọn gói mới | Thời hạn giữ nguyên | Lượt lớp giữ nguyên |
| --- | ---: | ---: | --- |
| The Essential | 299.000đ | 30 ngày | 8 |
| The Sanctuary VIP | 499.000đ | 90 ngày | Không giới hạn |
| The Sovereign Annual | 999.000đ | 365 ngày | Không giới hạn |

- FE chỉ định dạng giá từ API; không thêm mapping giá theo tên/ID gói. Landing và portal dùng cùng catalog backend.
- CatalogSeeder dùng giá mới cho DB rỗng. Với catalog đã triển khai, chỉ sửa ba bản ghi có đúng tên và giá seed cũ; không thay giá tùy chỉnh của manager. Update qua PackageService/JPA trong transaction, không chạy DDL/DML thủ công.
- Đã áp dụng bằng backend trên project `ttqxwpelwurjbpolkzwl` và đọc `GET /public/catalog` xác nhận ba giá trên. Giữ ID 1/2/3, thời hạn và quyền lợi. Preflight có một subscription pending, chưa có payment cho subscription đó. Không chỉnh payment/invoice lịch sử.
- Nếu môi trường khác có payment pending trước hạ giá, POS tiếp tục dùng amount đã lưu; cả luồng chọn subscription và chọn package đều xác thực amount đó. Pending-list DTO trả cùng amount cho form quầy; chỉ dùng giá catalog khi không có pending payment hợp lệ. Không cho người dùng tự đặt giá.

## Realtime và popup

- `POST /memberships/subscriptions/realtime-session`: chỉ MEMBER đã xác thực, không nhận memberId đầu vào, response no-store. Service khóa member để tạo/tái sử dụng UUID channel, cấu hình URL/publishable key từ môi trường.
- Trigger payment/subscription được PostgreSqlTriggerProvider nạp sau Hibernate, gọi Supabase `realtime.send` trong transaction. Broadcast public vào topic UUID không thể đoán; payload ứng dụng rỗng, Supabase có thể thêm UUID giao nhận. Không broadcast thông tin hội viên, amount hoặc payment status. Không mở RLS/Data API trên bảng nghiệp vụ.
- Đây là kênh capability, không phải kênh Supabase Auth private. Topic chỉ cấp cho owner qua API; không lưu vào localStorage. Tín hiệu giả chỉ có thể yêu cầu đọc lại API, không tạo xác nhận thanh toán. API JWT vẫn là ranh giới phân quyền và nguồn dữ liệu.
- FE dùng SDK Supabase cố định phiên bản, nhận Broadcast rồi tải lại dữ liệu qua API đã xác thực. Không polling định kỳ. Khi subscribe/reconnect/focus/online/quay lại tab thì đồng bộ bổ sung; dọn channel/listener khi unmount.
- Requeue tín hiệu nếu foreground read/mutation ngắt request; response cũ không ghi đè thao tác mới. Popup thành công chỉ dựa vào payment success từ API và phân biệt chờ kích hoạt/kỳ tương lai.
- Nút mua/gia hạn/nâng cấp vẫn bấm được khi vướng nghiệp vụ; bấm mới mở native Modal giải thích. Chỉ disable khi loading/submitting. Dùng nguyên phong cách popup của contributor, hỗ trợ focus/Tab/Escape.

## Kiểm chứng

- Frontend: 52 files / 316 tests PASS; full lint PASS; TypeScript + Vite build PASS (cảnh báo chunk >500 kB hiện hữu).
- Backend: Maven + JDK 21, 632 tests / 0 failures / 0 errors / 18 skipped; gồm DatabasePolicyTest và DatabaseProfilesTest. Các bài DB mặc định yêu cầu cấu hình riêng nên skip.
- Supabase thật: test `supabaseBroadcastIsDataFreeAndOnlyDeliveredAfterCommit` PASS riêng, tạo schema UUID bằng Hibernate và dọn sau test. Nhận WebSocket sau commit, không phát trước commit hoặc sau rollback, không nhận payment của member khác; payload chỉ có delivery UUID của Supabase.
- Browser fixtures: light/dark × 390/1440px PASS; nút tương tác, popup, Tab/focus, Escape, không tràn document. Không ghi account/payment thật. Screenshot và script nằm trong `.local-qa.tmp/`.
- Regression: pending amount trước đổi giá cho hai luồng POS, pending quote tại quầy, API-driven prices, Realtime thay polling, tín hiệu bị ngắt bởi manual read, cleanup và popup nghiệp vụ.
- Deployment script: 7 tests PASS; cấu hình Supabase runner: 10 cases PASS; OpenAPI/workflow YAML parser không có duplicate key; git diff --check PASS.
- Sửa baseline lint bằng `void _classId` để giữ chữ ký coaching API; không thay UI coach. Gỡ response 409 trùng có sẵn trong OpenAPI để contract chỉnh sửa parse đúng.
- Review độc lập đã giải quyết các blocker về khoản chờ và mất invalidation; không còn blocker.
- `graphify update .` hoàn tất (10.422 nodes), có cảnh báo parser của CoachClassesPage hiện hữu. Kết quả/cache sinh mới giữ tại QA cục bộ; không đưa thay đổi toàn graph vào PR.

## Cấu hình triển khai

`SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` đã đặt trong môi trường cục bộ và GitHub repository variables. CD chuyển hai biến công khai lên Render bằng PUT từng key trước triển khai commit đã qua CI; không thay toàn bộ environment. Không dùng secret/service_role key trong response hoặc browser. Không đổi secret JWT/database.
