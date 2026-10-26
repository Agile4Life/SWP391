# Kiểm thử hành trình mua gói tập — 26/10/2026

> Đây là bằng chứng **trước sửa**. Các bản sửa và kết quả regression mới nhất nằm tại [báo cáo sau sửa](after/README.md).

**Kết luận:** người mua mới hoàn tất được yêu cầu mua gói trên desktop và mobile dọc. Luồng còn vòng vèo sau xác thực; việc phục hồi OTP và xử lý hộp thoại chưa đủ tốt. Nên sửa đường phục hồi OTP trước khi đưa luồng này cho người dùng mới.

## Phạm vi và bằng chứng

- Commit: `016cb2c`; web `http://localhost:5173`, API `http://localhost:8080`.
- Chạy Playwright với Chrome, desktop 1440×900; mobile 390×844, 375×667, 320×568 và ngang 844×390. Có kiểm tra cả hai theme, bàn phím và animation thật trên menu mobile.
- API thật: chỉ GET health và public catalog; landing thật được kiểm tra cùng API thật, khớp tên/giá của cả ba gói.
- Theo yêu cầu người dùng, mọi bước đăng ký, gửi/xác thực OTP, đăng nhập, mua/hủy gói và xác nhận thanh toán đều được giả lập tại ranh giới HTTP. Không tạo tài khoản, gửi email hay sửa subscription/payment thật.
- **34 tình huống: 22 đạt, 12 phát hiện vấn đề; không còn lỗi chạy script.** Các case có vấn đề được gom thành 8 nhóm dưới đây, không phải 12 lỗi độc lập. Không có lỗi JavaScript runtime trong các case giả lập.
- [Kết quả máy đọc được](results.json), [script chạy lại](../../../scripts/audit-membership-purchase.cjs).

Catalog thật tại thời điểm kiểm tra:

| Gói | Thời hạn | Giá trọn gói |
| --- | --- | --- |
| The Essential | 30 ngày | 2.800.000 ₫ |
| The Sanctuary VIP | 90 ngày | 7.500.000 ₫ |
| The Sovereign Annual | 365 ngày | 26.000.000 ₫ |

[Ảnh landing với catalog thật](pricing-live-1440.png) · [Danh mục portal desktop](portal-catalog-1440.png) · [Danh mục portal mobile](portal-catalog-390.png).

## Những điểm cần sửa

### 1. P1 — Người dùng có thể mắc kẹt sau khi tài khoản đã tạo nhưng OTP chưa xong

**Tái hiện:** đăng ký thành công → giả lập `/auth/send-otp` trả 503 → bấm tiếp tục lại. UI gọi `/auth/register` lần nữa và nhận 409 vì username/email đã tồn tại. Chưa có màn hình để gửi lại OTP cho tài khoản vừa tạo.

Hai đường khác cũng đưa người dùng về đăng ký tài khoản đã tồn tại: refresh tại bước OTP làm mất email/bước đang làm; hoặc bấm “Đổi thông tin”, sửa số điện thoại rồi tiếp tục. `RegisterPage.tsx:16,69–71,155`; backend `AuthService.java:102–122` xác nhận register tạo user riêng và chặn trùng.

**Đề xuất:** lưu trạng thái tài khoản đang chờ xác thực ngay sau khi register thành công; gửi lại OTP phải độc lập với tạo tài khoản. Refresh cần khôi phục email/bước xác thực, không lưu password/OTP. “Đổi thông tin” cần xử lý tài khoản pending hoặc hướng dẫn rõ, không chạy lại register mù.

Cases: `otp-send-recovery`, `otp-refresh`, `otp-back-edit`. [Ảnh khi thử lại sau lỗi OTP](otp-send-recovery.png).

### 2. P2 — Chọn gói xong vẫn phải tìm và chọn lại sau đăng nhập

**Tái hiện:** chọn The Sanctuary VIP trên landing → `/register` không có package ID → OTP thành công đưa sang `/login` → đăng nhập đưa tới `/member/dashboard`. Người mua phải tìm “Khám phá các gói tập” hoặc menu gói, rồi chọn VIP lần nữa.

Đã tái hiện trên desktop và mobile. Các nút “Chọn gói tập” cùng dùng `joinPath`, không mang lựa chọn theo; login luôn dùng `homePath`. Vị trí: `CatalogSections.tsx:33`, `RegisterPage.tsx:107`, `LuxuryLoginForm.tsx:276`, `RoleGuard.tsx:7`.

**Đề xuất:** giữ package ID và đường quay lại trong toàn bộ quá trình xác thực. Sau đăng nhập, mở thẳng trang gói với gói đã chọn; không tự tạo yêu cầu khi người dùng chưa xác nhận. Đường quay lại phải là route nội bộ hợp lệ.

Case: `selection-continuity`. Luồng chính vẫn đạt vì script chủ động tìm và chọn lại gói, không có nghĩa ứng dụng giữ ý định mua.

### 3. P2 — Lỗi hủy yêu cầu bị che phía sau hai hộp thoại

**Tái hiện:** tạo yêu cầu → trong hộp thoại thành công chọn hủy → xác nhận hủy → giả lập 409 “Yêu cầu đã được thanh toán, không thể hủy.”

Hộp thoại xác nhận vẫn mở mà không có lời giải thích. `actionError` nằm trên trang bên dưới, bị overlay che; đồng thời có hai phần tử `aria-modal="true"`. Người dùng dễ tưởng nút không hoạt động và bấm tiếp. Vị trí: `MemberPackagesPage.tsx:357,715,938,1050`.

**Đề xuất:** hiển thị lỗi tại hộp thoại chứa thao tác hủy; dùng một hộp thoại đổi nội dung thay vì chồng hai lớp. Khi xung đột trạng thái, đồng bộ lại và giải thích hành động tiếp theo.

Case: `cancel-error-visible`. [Ảnh lỗi hủy bị che](cancel-error-visible.png).

### 4. P2 — Hộp thoại không vừa màn hình thấp

Ở 844×390, hộp thoại bắt đầu tại y=24, cao khoảng 528px; nút “Đóng” nằm tại y≈485–527, hoàn toàn ngoài viewport. Overlay fixed không có vùng cuộn riêng để tiếp cận phần cuối. Ở 320×568, phần đáy card cũng vượt viewport; vị trí nút sát mép dưới. Mobile dọc 390×844 và 375×667 vẫn đạt.

Vị trí: `MemberPackagesPage.tsx:938–968`.

**Đề xuất:** giới hạn chiều cao theo viewport và cho cuộn bên trong hộp thoại/overlay; giữ nhóm hành động tiếp cận được, kể cả ngang màn hình hoặc khi zoom chữ.

Cases: `mobile-dialog-320`, `mobile-dialog-844`. [Ảnh màn hình ngang](mobile-dialog-844.png).

### 5. P2 — Bàn phím đi ra phía sau hộp thoại

Mở hộp thoại yêu cầu mua: focus không chuyển vào hộp thoại. Nhấn Escape không đóng; sau 6 lần Tab, kiểm tra vị trí focus lần lượt ở trong/ngoài: `false, true, true, false, false, false`.

`aria-modal="true"` chỉ khai báo ngữ nghĩa, không tự tạo focus trap. Vị trí: `MemberPackagesPage.tsx:956`. Dự án đã có shared `Modal` dùng native `<dialog>` có thể tái sử dụng.

**Đề xuất:** chuyển focus vào, giữ Tab bên trong, hỗ trợ Escape và trả focus về vị trí hợp lý khi đóng. Kết hợp với sửa chiều cao ở trên.

Case: `dialog-keyboard`. [Ảnh hộp thoại](dialog-keyboard.png).

### 6. P2 — Ví dụ số điện thoại bị chính form từ chối

Placeholder gợi ý `0912 345 678` nhưng nhập đúng chuỗi đó bị báo không hợp lệ vì chỉ trim đầu/cuối trước khi áp dụng regex. Vị trí: `RegisterPage.tsx:11,46–58,135`.

**Đề xuất:** chuẩn hóa khoảng trắng trước khi validate, hoặc đổi ví dụ thành định dạng form chấp nhận. Thông báo nên xuất hiện cạnh trường số điện thoại.

Case: `phone-placeholder`. [Ảnh lỗi trên mobile](phone-placeholder.png).

### 7. P2 — Chữ nút auth nhạt khi hover

Nút đăng ký bình thường đạt khoảng **6.03:1**. Khi hover, chữ thành trắng trên nền `#e1aa98`, chỉ còn **2.02:1**, ở cả hai theme. Đây là chữ 13px nên khó đọc.

Nguyên nhân: rule hover cũ tại `shared/ui/portal.css:545` đổi chữ sang trắng; `fitness-public.css:483` đổi nền salmon nhưng không giữ màu chữ charcoal.

**Đề xuất:** giữ chữ charcoal trong trạng thái hover của nút auth và kiểm tra tương tự cho login/OTP dùng chung class.

Cases: `auth-button-contrast-light`, `auth-button-contrast-dark`. [Ảnh hover light](auth-button-contrast-light.png).

### 8. P2 — Form báo lỗi nhưng không chỉ ra trường lỗi cho công cụ hỗ trợ

Nhập số điện thoại sai: có `role="alert"`, nhưng input không có `aria-invalid`, không liên kết thông báo bằng `aria-describedby`; focus không quay về trường lỗi. Với bàn phím hoặc screen reader, người dùng phải tự dò vị trí cần sửa.

Vị trí: `RegisterPage.tsx:123–135`.

**Đề xuất:** giữ banner nếu cần, bổ sung lỗi inline gắn vào input; sau submit sai, focus trường lỗi đầu tiên hoặc một error summary có liên kết.

Case: `registration-error-a11y`.

## Đánh giá từ góc nhìn người mua

Phần chọn gói tương đối dễ hiểu: có giá trọn gói, thời hạn, số lượt đặt lớp và thông báo thanh toán/kích hoạt tại quầy trước khi đăng ký. Desktop dùng ba card so sánh; mobile xếp dọc, không cần đi qua nhiều màn hình checkout. Không nên thêm payment gateway thật chỉ để giải quyết những điểm UX này; thanh toán tại quầy là phạm vi hiện hành.

Chỗ rườm rà nhất là **chọn gói → tạo tài khoản → OTP → đăng nhập lại → dashboard → tìm gói → chọn lại**. Đăng nhập lại sau OTP có thể là quyết định sản phẩm, nhưng việc mất gói đã chọn và đi qua dashboard không giúp người mua hoàn thành tác vụ.

Luồng gọn hơn: **chọn gói → xác thực → quay lại đúng gói → tạo yêu cầu → hướng dẫn đến quầy**. Giữ cùng dữ liệu giá/quyền lợi; thông báo rõ “đã tạo yêu cầu, chưa thanh toán/chưa kích hoạt”. Nếu có địa chỉ/giờ làm việc được xác minh, đưa ngay vào bước cuối; không tự suy đoán các thông tin đó. Hành động chính sau thành công nên giúp xem yêu cầu/hướng dẫn tiếp, thay vì chỉ “Đóng”; hủy là hành động phụ.

Ưu tiên sửa: phục hồi OTP → hộp thoại và thông báo lỗi → giữ gói sau xác thực → chi tiết form và hover.

## Những tình huống xử lý tốt

- Luồng mới hoàn tất yêu cầu mua trên desktop/mobile khi OTP, đăng nhập và server trả thành công.
- Chống double-click tạo trùng; không gọi API thanh toán online ngoài phạm vi.
- Server lỗi khi mua: có thông báo và thử lại được.
- Mất response sau khi server nhận yêu cầu: tải history phát hiện pending và chặn tạo thêm.
- Lỗi tải danh mục/lịch sử/thanh toán: có retry và chặn mua lúc trạng thái chưa rõ.
- Catalog rỗng không hiển thị gói tưởng tượng; landing lỗi có retry, không bịa giá.
- Pending tồn tại qua reload; hủy bình thường có xác nhận và mở lại quyền chọn gói.
- Có payment pending thì không cho mua trùng hoặc hủy tùy tiện.
- Refresh trạng thái sau khi giả lập lễ tân xác nhận làm hiện gói active.
- OTP sai có thông báo và sửa lại được; resend có cooldown.
- Phiên hết hạn đưa về login có giải thích; login sai giữ input và thử lại được.
- Menu mobile đi tới pricing với animation bật vẫn thao tác được.

## Giới hạn kiểm chứng

Kết quả ghi dữ liệu chứng minh hành vi frontend trước các response được kiểm soát. Chưa chứng minh SMTP gửi OTP thật, xác thực/account thật, transaction/trigger database hoặc nghiệp vụ thu tiền tại quầy chạy end-to-end. Các lỗi UI và state nêu trên đã được tái hiện trên browser; lỗi phục hồi register được đối chiếu thêm với backend source. Đây là báo cáo audit, chưa sửa hành vi sản phẩm hay push/commit thay đổi.

Để chạy lại: chuẩn bị web/API local cùng `playwright-core` trong `NODE_PATH`, đặt `CHROME_PATH` nếu cần, chạy `node scripts/audit-membership-purchase.cjs`. Dùng `AUDIT_CASE_FILTER` để chọn case và `AUDIT_OUTPUT` để tách artifact của lần chạy riêng.

## Ma trận kiểm thử

<!-- case-matrix -->

| Case | Tình huống | Kết quả |
| --- | --- | --- |
| `live-catalog` | Real landing UI renders the live public catalog and correct prices | PASS |
| `journey-1440` | New buyer: landing → register → OTP → login → package request | PASS |
| `journey-390` | New buyer: landing → register → OTP → login → package request | PASS |
| `selection-continuity` | Selected package and purchase intent survive authentication | ISSUE |
| `phone-placeholder` | Registration accepts the phone format shown in its placeholder | ISSUE |
| `validation` | Short username/password and invalid phone are blocked without API writes | PASS |
| `otp-retry` | Wrong OTP keeps the form; cooldown blocks resending; correct OTP recovers | PASS |
| `otp-send-recovery` | A failed OTP delivery after account creation can be retried | ISSUE |
| `otp-refresh` | Refreshing the OTP screen preserves the email and verification step | ISSUE |
| `double-submit` | Rapid double-click creates only one pending request | PASS |
| `purchase-500-retry` | Server failure shows a message and allows retry | PASS |
| `lost-response` | Lost response after server acceptance does not allow a duplicate purchase | PASS |
| `read-error-packages` | Read failure /packages: clear retry and no purchase while status unknown | PASS |
| `read-error-history` | Read failure /memberships/subscriptions/history: clear retry and no purchase while status unknown | PASS |
| `read-error-my` | Read failure /payments/my: clear retry and no purchase while status unknown | PASS |
| `empty-packages` | Empty or inactive catalog gives an explicit empty state | PASS |
| `loading-status` | Slow membership status shows loading and blocks purchasing | PASS |
| `pending-reload-cancel` | Pending request survives reload, cancellation confirms, then a different package can be selected | PASS |
| `dialog-keyboard` | Purchase dialog captures focus, traps Tab, and closes with Escape | ISSUE |
| `mobile-dialog-390` | Request summary and close/cancel controls fit the mobile viewport | PASS |
| `mobile-dialog-375` | Request summary and close/cancel controls fit the mobile viewport | PASS |
| `mobile-dialog-320` | Request summary and close/cancel controls fit the mobile viewport | ISSUE |
| `mobile-dialog-844` | Request summary and close/cancel controls fit the mobile viewport | ISSUE |
| `cancel-error-visible` | Cancellation conflict is explained inside the open confirmation dialog | ISSUE |
| `manual-activation` | After reception confirms payment, refresh shows active membership | PASS |
| `expired-session` | Expired session returns to login with an explanation | PASS |
| `login-error-retry` | Incorrect credentials keep input; retry succeeds without registering again | PASS |
| `otp-back-edit` | Changing optional information during OTP does not re-register the same account | ISSUE |
| `registration-error-a11y` | Invalid phone is associated with its input for keyboard/screen-reader users | ISSUE |
| `pending-payment-guard` | An existing payment-pending request blocks another purchase and cancellation | PASS |
| `catalog-failure-retry` | Landing handles catalog unavailability without showing invented prices | PASS |
| `landing-normal-motion` | A mobile guest can find pricing through the menu with animation enabled | PASS |
| `auth-button-contrast-light` | Registration submit text has readable contrast | ISSUE |
| `auth-button-contrast-dark` | Registration submit text has readable contrast | ISSUE |
