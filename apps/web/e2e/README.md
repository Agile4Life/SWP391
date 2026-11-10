# E2E (Playwright)

Stack cô lập: PostgreSQL tạm (TLS tự ký) + API Docker, **không dùng Supabase/.env của dự án**.

```bash
cd apps/web
npm run e2e:stack:down && npm run e2e:stack:up   # DB mới + seed demo (bắt buộc trước mỗi lần chạy đầy đủ)
npm run e2e                                      # Vite dev (cổng 4173) tự khởi động, proxy /api -> localhost:8080
npm run e2e:report
```

Spec chạy tuần tự (dùng chung DB, `/auth` giới hạn 60 req/phút; helper tự chờ khi gặp 429). Nhiều spec tạo hội viên mới mỗi lần chạy,
nhưng các spec dùng tài khoản demo (`docs/DEMO_ACCOUNTS.md`) đổi dữ liệu của chúng, nên cần DB mới trước mỗi lần chạy đầy đủ.

| Spec | Phạm vi |
|---|---|
| 01 | trang công khai, catalog thật, FAQ, BMI, trang môn, cửa hàng, bảo vệ route |
| 02 | đăng nhập (đúng/sai/khóa 5 lần/XSS/hết hạn token), đăng ký + OTP, quên mật khẩu |
| 03 | phân quyền giao diện (5 vai trò × 13 route) và API (ma trận 401/403, token giả) |
| 04 | luồng mua gói: KYC → lễ tân duyệt → đăng ký → hủy/đăng ký lại → thu tiền mặt → kích hoạt |
| 05 | dashboard theo trạng thái gói, thẻ QR, hồ sơ, đổi mật khẩu, hỗ trợ (hội viên → lễ tân → quản lý) |
| 05b | nghiệp vụ đăng ký khóa học: hạn mức theo gói, học phí ngoài gói, ví, giữ chỗ, hoàn tiền |
| 06 | lịch lớp, lọc, quota/khóa đã bắt đầu, hội viên hết hạn |
| 07 | check-in/out tại quầy (mã động, dùng lại, mã rác), tự check-in, mã cổng |
| 08 | bảo lưu: điều kiện, dữ liệu xấu, nộp → từ chối → nộp lại → duyệt |
| 09 | cửa hàng: giỏ, thanh toán ví, vòng đời đơn với lễ tân, ví thiếu tiền, địa chỉ |
| 10 | đặt sân: khung giờ đã qua, đặt/hủy, định kỳ, hai người tranh một slot, hội viên hết hạn |
| 11 | HLV: lịch dạy, điểm danh, PT, đánh giá lần đầu, giáo án, số đo |
| 12 | quản lý (danh mục, thiết bị, nhân sự, báo cáo, audit) và admin |
| 13 | đơn từ nội bộ (HLV → quản lý), thông báo, tin nhắn |
| 14 | i18n, chế độ tối, di động 375px, tham quan 3D, SÖL AI |

`test.fail(true, 'BUG …')` đánh dấu lỗi sản phẩm đã xác nhận: test vẫn xanh, và sẽ đỏ ("expected to fail but passed") khi lỗi được sửa — lúc đó bỏ dòng `test.fail`.
