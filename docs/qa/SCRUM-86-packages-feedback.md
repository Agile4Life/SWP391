# SCRUM-86 — Member Packages feedback, 29/10/2026

> Hồ sơ bản PR ban đầu. Quyết định mới nhất và thay đổi giá/Realtime/popup được ghi tại [SCRUM-86-realtime-prices.md](SCRUM-86-realtime-prices.md). Bảng giá đề xuất dưới đây không còn là giá rollout.

Branch: `feat/SCRUM-86-member-packages-feedback`. Working tree sạch trước khi sửa. Owner màn hình: Thịnh, theo backlog. Không fetch/đổi branch/tích hợp PR #55–#59/commit/push/merge. Không sửa secret hoặc kết nối shared DB.

## Phạm vi và phát hiện

- SCRUM-86: UI danh mục, mua/gia hạn, đồng bộ trạng thái. Yêu cầu hiện tại dùng thanh toán tại quầy, thay mock bank trong AC cũ. Không đổi endpoint/API contract.
- Source đang chạy: `MemberPackagesPage.tsx`, `membershipApi.ts`, `membershipPresentation.ts`, native `Modal`. Đã có skeleton/modal. Không bám screenshot lịch sử.
- Authoritative: `GET /packages`, `/memberships/subscriptions/my`, `/memberships/subscriptions/history`, `/payments/my`, `/memberships/cancellations/my`. POST register/renew/upgrade không nhận giá card; giữ auth/ownership API hiện có.
- “Cần kiểm tra gia hạn” đến từ guard kiểm tra kỳ chồng ngày, nhánh trùng, vòng lặp hoặc đổi package trong chuỗi, tương ứng `MembershipSubscriptionService.renewForOwner`. Không gỡ guard backend. Chưa có screenshot/dữ liệu thật để xác định bản ghi cụ thể gây conflict.
- Pending payment giữ nguyên gói active. Upgrade bị chặn khi có successor. PENDING/APPROVED/REJECTED của hold/cancellation không phải trạng thái subscription; không tạo domain status mới.
- `CatalogSeeder` chứa giá 2.800.000/7.500.000/26.000.000 và 30/90/365 ngày; chỉ seed khi catalog rỗng. Không cập nhật được catalog đã triển khai bằng cách sửa seed.
- Subscription lưu start/end, tham chiếu package, không snapshot giá/quyền lợi/tên. Activation đọc lại duration từ package; `PaymentService` đối chiếu amount với giá package hiện tại. Payment lưu amount riêng. PUT package cũ có thể làm đổi điều kiện pending/renewal và nội dung lịch sử.
- `classCreditLimit` có trong Entity/DTO/catalog, chưa thấy logic thực thi quota chu kỳ 30 ngày hoặc quan hệ phân quyền package–discipline. Có Thermal Aquatics trong seed không chứng minh quyền bơi của Standard; không chứng minh hỗ trợ cầu lông/tennis/bóng rổ.
- Trang chưa tự refetch khi lễ tân xử lý; skeleton dùng animation vô hạn; lý do khóa nút chưa đầy đủ; popup cũ dài và có thể bị hiểu là số tiền chốt theo card.

## Catalog mới — chỉ chuẩn bị review

| Tier | Tên | Giá trọn gói | Ngày | Lượt lớp / 30 ngày |
| --- | --- | ---: | ---: | ---: |
| Basic | The Essential | 900.000đ | 30 | 2 |
| Standard | The Sanctuary | 2.400.000đ | 90 | 4 |
| Premium | The Sovereign | 3.900.000đ | 180 | 6 |

Gym không giới hạn khi hợp lệ; chu kỳ từ kích hoạt, không cộng dồn. Quota, booking/hủy hợp lệ và bộ môn do backend bảo đảm. Không cung cấp thuê sân/PT/gateway.

Payload: [SCRUM-86-catalog-review.json](SCRUM-86-catalog-review.json). REVIEW ONLY, không phải seed/script production. `inactive` để không chào bán quyền chưa thực thi. UI tiếp tục đọc API thật; **chưa áp dụng giá/thời hạn/quota mới vào DB/seed/API/UI production**.

Dependency: An (catalog/core operations, subscription SCRUM-71, quota booking); Phong (Finance SCRUM-76, bảo toàn điều khoản thanh toán). Không tự tạo Jira key hoặc sửa các ticket đó.

Phương án cần review trước rollout:

1. Snapshot điều khoản khi tạo yêu cầu/mua; backfill từ bằng chứng đáng tin, không suy giá lịch sử từ catalog hiện tại. Nếu cần cột mới, dùng Entity/Hibernate Code-First và test schema biệt lập; không DDL migration thủ công.
2. Tạo package phiên bản mới qua API manager hiện có, không PUT giá/thời hạn package ID cũ. Cần tách khả năng hiển thị catalog với khả năng xử lý pending/gia hạn cũ: `findActivePackage`/PaymentService hiện chặn package inactive, nên không tắt hàng loạt package cũ.
3. Backend thực thi chu kỳ 30 ngày, quota/cancel/không cộng dồn và chống booking đồng thời; map quyền bộ môn thực tế.
4. Kiểm kê active/pending/future periods, payment/invoice read-only; dry-run trong Supabase dev/test schema biệt lập, đối chiếu trước/sau rồi mới rollout có kiểm soát.

Không DDL/DML hoặc API ghi catalog đã chạy; không sửa lịch sử giao dịch/membership/invoice.

## Thay đổi trong SCRUM-86

- Polling REST mỗi 15 giây khi visible, refetch khi focus/online/quay lại tab. Đây là fallback, **không phải Supabase Realtime**. Chưa có member Supabase auth, publication/RLS được xác minh an toàn; không sửa RLS hoặc thêm key.
- Refetch cả 5 tài nguyên; tránh request chồng trong vòng đời, bỏ snapshot cũ sau foreground read/mutation/unmount; cleanup interval/listener. Không flash skeleton khi background refresh. Lỗi đồng bộ báo dữ liệu chưa xác minh và khóa mua/gia hạn/nâng cấp, tự phục hồi khi đọc API thành công.
- Request popup báo gửi thành công/chờ xử lý. Giá catalog là tham khảo; quầy/backend xác nhận tiền. Payment popup chỉ khi `/payments/my` trả `success` gắn subscription từng thấy pending; không phát lại giao dịch lịch sử lúc mở trang. Dedupe theo subscription trong vòng đời trang; phân biệt pending activation và future period.
- Dùng native dialog/focus trap/Escape/return focus, tránh chồng popup. Thêm lý do khóa/nhãn gói hiện tại. Skeleton tĩnh; CSS cục bộ dùng portal tokens cả light/dark; không đổi header/sidebar/theme mặc định toàn cục.

## Kiểm chứng sau review chuẩn bị PR

Đã chạy lại Packages tests, toàn frontend suite, scoped/full lint và build sau khi review. Chỉ chỉnh tài liệu và chuyển QA cục bộ trong lượt chuẩn bị PR, không đổi code chức năng.

| Hạng mục | Kết quả |
| --- | --- |
| `npm.cmd test -- MemberPackagesPage.test.tsx` | PASS: 53 tests, gồm giá/thời hạn từ API, pending hold/future paid, request/payment popup, polling/cleanup/hidden tab/reconnect, response cũ background/manual, phục hồi lỗi |
| `npm.cmd test` toàn frontend | PASS: 52 files, 316 tests. Có log ECONNREFUSED/ETIMEDOUT localhost:3000 trong suite; không coi đây là kiểm thử tích hợp API thật |
| ESLint hai file TSX thay đổi | PASS, `--max-warnings=0` |
| `npm.cmd run lint` toàn frontend | FAIL: baseline `apps/web/src/features/coaching/coachingApi.ts:70:49`, `_classId` không dùng. Đã lint trực tiếp nội dung `origin/main` qua stdin và tái hiện cùng lỗi; không sửa ngoài SCRUM-86 |
| `npm.cmd run build` | PASS: TypeScript + Vite; có cảnh báo chunk >500 kB |
| Browser QA fixture ở đợt triển khai trước | PASS: light/dark × 390/1440px, skeleton tĩnh, giá fixture từ API, không tràn, card/price/button alignment kể cả paid-future blocker, modal giữa viewport, focus/Tab/Escape, refetch/payment dedup, error/retry. Không chạy lại trong lượt dọn PR; script/ảnh chỉ lưu local |
| `scripts/test-database-config.ps1` | PASS: 10 cases, không kết nối DB |
| Backend `mvnw.cmd test` | BLOCKED trước test: wrapper `Cannot index into a null array`; thử Maven 3.9.16 đã cache với `-o` và local repo đúng thì compile FAIL, `Fatal error compiling` tham chiếu `spring-boot-starter-web-3.4.4.jar`. Không kết luận test backend PASS/FAIL nghiệp vụ |
| DB thật, catalog rollout, Supabase Realtime/RLS | NOT RUN: chưa có môi trường được xác nhận an toàn; không khởi động API |
| `git diff --check` | PASS |
| Catalog review JSON | PASS: parse và đối chiếu bộ giá/ngày/quota/inactive |
| `graphify update .` | BLOCKED: CLI không có sẵn; Python cũng không có sẵn, không cài thêm |
| Review độc lập read-only | Không có phát hiện chặn, không sửa file |

Baseline được đối chiếu là ref `origin/main` đang có cục bộ tại `7910349eb15446b5789370758010fe4fd43fd5cf`; không fetch nên không khẳng định đây là trạng thái remote mới nhất. `coachingApi.ts` và cấu hình ESLint không khác baseline; lỗi lint không do diff SCRUM-86.

Browser QA dùng API fixtures hoàn toàn, bao gồm POST intercepted; không chứng minh catalog thực đã đổi giá hoặc backend quyền lợi hoạt động. Tám ảnh fixture và script tạm đã chuyển vào thư mục local `.local-qa.tmp/SCRUM-86-review/`, được bỏ qua bởi quy tắc `*.tmp` có sẵn. Đối chiếu SHA-256 cả chín file trước/sau trùng khớp; manifest lưu cùng bản local. Không đưa chúng vào PR; không thêm ignore rule hay sửa `.git`.

## File đề xuất đưa vào PR UI-only

| Nhóm | File | Lý do giữ |
| --- | --- | --- |
| Code | `apps/web/src/features/member/MemberPackagesPage.tsx` | Đồng bộ trạng thái, popup, guard UI, skeleton |
| Test | `apps/web/src/features/member/MemberPackagesPage.test.tsx` | Hồi quy hành vi và race condition |
| Style | `apps/web/src/features/member/member-packages.css` | CSS cục bộ, Light/Dark, dialog, card và skeleton |
| Quy chuẩn | `DESIGN.md` | Ghi lại quyết định UI hiện hành, dẫn đến hồ sơ dependency |
| Review | `docs/qa/SCRUM-86-packages-feedback.md` | Phạm vi, bằng chứng test, baseline và giới hạn PR |
| Review | `docs/qa/SCRUM-86-catalog-review.json` | Đề xuất catalog `REVIEW_ONLY_DO_NOT_APPLY`, không import từ app/seed/config hoặc tự chạy |

Không thay backend/API contract/seed/schema, không sửa PR #55–#59, coaching hoặc màn hình khác. Diff UI và kiểm thử phạm vi sửa sẵn sàng để người dùng commit và mở PR UI-only, công khai full lint FAIL do baseline. Điều này không đồng nghĩa CI xanh hoặc đủ điều kiện merge nếu full lint là gate bắt buộc. Backend verification chưa PASS; catalog/quota/snapshot nằm ngoài PR và không được triển khai kèm. Không stage/commit/push/merge đã thực hiện.
