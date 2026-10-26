# Kết quả sau sửa UX mua gói — 26/10/2026

Đã xử lý cả 8 nhóm vấn đề của [audit ban đầu](../README.md), bổ sung Zod và giữ nguyên thiết kế charcoal–salmon, React/TypeScript cùng thanh toán tại quầy.

## Thay đổi

| Nhóm | Hành vi sau sửa |
| --- | --- |
| Phục hồi OTP | Account được ghi nhận ngay khi register thành công; lỗi gửi mã vẫn ở màn hình OTP. Refresh khôi phục identity/cooldown. Resend không POST register lần nữa. |
| Email sai | Có đường “Đăng ký tài khoản khác”, xóa trạng thái pending tại máy; giải thích rõ tài khoản đã tạo vẫn tồn tại. Không giả vờ sửa tài khoản trên server. |
| Giữ gói | Standard login, Google handoff và login lại sau 401 quay về đúng package ID; chỉ whitelist trang gói cho Member. Card được đánh dấu và focus một lần, không tự gửi yêu cầu mua. |
| Lỗi hủy | Một hộp thoại xác nhận tại một thời điểm; lỗi 409 hiển thị ngay bên trong, không bị overlay che. |
| Mobile thấp | Native dialog có max-height và vùng cuộn; đóng/hủy tiếp cận được ở 320×568 và 844×390. |
| Bàn phím | Focus vào dialog, Tab/Shift+Tab wrap, Escape đóng và trả focus về pending request hoặc danh mục sau khi hủy. |
| Form | Zod 4.6.7 cho register/login/OTP; số điện thoại có khoảng trắng được chuẩn hóa. Lỗi inline có aria-invalid/aria-describedby và focus. Không trim mật khẩu. |
| Màu hover | Nút auth giữ chữ charcoal trên salmon ở cả light/dark. |

Pending-registration storage chỉ gồm username, email, createdAt và resendAt trong sessionStorage, không có password/OTP/token; metadata được Zod validate khi đọc và hết hạn sau 24h. Bước xác thực thành công xóa metadata. Dữ liệu browser không được coi là bằng chứng xác thực; API vẫn là nơi xác thực OTP/role.

## Kiểm chứng

- **299 frontend unit/component tests đạt, 49 file test.**
- **Lint và production build đạt.** Build còn cảnh báo chunk lớn vốn có; không thay bundling trong phạm vi sửa UX.
- **35 Playwright case đạt, 1 case API thật SKIP**, không có ISSUE/ERROR; Playwright không ghi nhận sự kiện pageerror trong các case giả lập. [Kết quả chi tiết](results.json).
- Case API live bị skip vì web/API local đang chạy trước đó đã dừng giữa phiên. Đã khởi động lại riêng frontend; dùng snapshot catalog thật đã đọc ở audit ban đầu. Không khởi động backend để tránh tác động DB ngoài phạm vi chỉ đọc đã thống nhất.
- Callback Google được kiểm bằng handoff/response giả lập, không đăng nhập provider thật. Thanh toán, register, OTP và mọi thao tác ghi đều bị intercept; chưa thử SMTP hoặc thu tiền/DB thật end-to-end.
- Regression bổ sung cho shared Modal trên 4 route coach/audit, hai theme và mobile/desktop: đạt (`scripts/verify-coach-theme.cjs`).
- Review độc lập không còn blocker; các phát hiện bổ sung về email sai và focus sau đóng đã sửa và có browser check.
- Khi dừng Vite, log dev có thông báo `ResizeObserver loop completed with undelivered notifications` từ các lần chạy responsive. Các assertion vẫn đạt và pageerror không ghi nhận lỗi; nguồn thông báo này chưa được điều tra trong phạm vi 8 nhóm lỗi mua gói.

## Bằng chứng giao diện

- [Yêu cầu mua desktop](journey-1440.png) · [mobile](journey-390.png).
- [Dialog trên màn hình ngang](mobile-dialog-844.png) · [màn hình nhỏ](mobile-dialog-320.png).
- [Lỗi hủy hiển thị trong dialog](cancel-error-visible.png).
- [Nút auth hover sáng](auth-button-contrast-light.png) · [tối](auth-button-contrast-dark.png).
- [Catalog có gói được chọn trên mobile](portal-catalog-390.png).

## Chạy lại

Script: `scripts/audit-membership-purchase.cjs`. Cần frontend local, Chrome và playwright-core trong NODE_PATH.

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:AUDIT_CATALOG_SNAPSHOT = 'docs/qa/purchase-ux-2026-10-26/results.json'
$env:AUDIT_OUTPUT = 'docs/qa/purchase-ux-2026-10-26/after'
$env:AUDIT_STRICT = '1'
node scripts/audit-membership-purchase.cjs
```

Đặt NODE_PATH tới bản playwright-core đã cài trên máy. Bỏ AUDIT_CATALOG_SNAPSHOT để kiểm lại catalog/API thật khi dịch vụ sẵn sàng. Có thể dùng AUDIT_CASE_FILTER để chọn case. Strict mode trả exit code khác 0 khi có ISSUE/ERROR; SKIP được ghi riêng.

## Các commit triển khai

- `04b967a` test(ux): capture membership purchase regressions [SCRUM-86]
- `019796d` fix(auth): validate registration with Zod and accessible errors [SCRUM-61,62]
- `a31874a` fix(auth): recover pending registration and OTP delivery [SCRUM-62]
- `2663a45` fix(membership): retain package selection through authentication [SCRUM-61,62,86]
- `24d0eb1` fix(membership): make dialogs accessible and show cancellation errors [SCRUM-86]
- `19b2770` fix(auth): keep submit hover text readable in both themes [SCRUM-61,62]
- `75b6b5b` fix(auth): handle inaccessible mailboxes and expired purchase sessions [SCRUM-61,62,86]
- `0e858c8` fix(ui): wrap modal keyboard focus and restore membership context [SCRUM-86]

Commit kiểm chứng cuối chứa script regression, ảnh sau sửa và cập nhật DESIGN.md.

## Ma trận regression cuối

| Case | Kết quả |
| --- | --- |
| `live-catalog` | SKIP |
| `journey-1440` | PASS |
| `journey-390` | PASS |
| `selection-continuity` | PASS |
| `phone-placeholder` | PASS |
| `validation` | PASS |
| `otp-retry` | PASS |
| `otp-send-recovery` | PASS |
| `otp-refresh` | PASS |
| `double-submit` | PASS |
| `purchase-500-retry` | PASS |
| `lost-response` | PASS |
| `read-error-packages` | PASS |
| `read-error-history` | PASS |
| `read-error-my` | PASS |
| `empty-packages` | PASS |
| `loading-status` | PASS |
| `pending-reload-cancel` | PASS |
| `dialog-keyboard` | PASS |
| `mobile-dialog-390` | PASS |
| `mobile-dialog-375` | PASS |
| `mobile-dialog-320` | PASS |
| `mobile-dialog-844` | PASS |
| `cancel-error-visible` | PASS |
| `manual-activation` | PASS |
| `expired-session` | PASS |
| `login-error-retry` | PASS |
| `otp-back-edit` | PASS |
| `otp-another-account` | PASS |
| `google-purchase-continuity` | PASS |
| `registration-error-a11y` | PASS |
| `pending-payment-guard` | PASS |
| `catalog-failure-retry` | PASS |
| `landing-normal-motion` | PASS |
| `auth-button-contrast-light` | PASS |
| `auth-button-contrast-dark` | PASS |

Ghi chú công cụ: `graphify update .` tại máy trả exit 1 không có output; không có artifact graph thay đổi được đưa vào commit.
