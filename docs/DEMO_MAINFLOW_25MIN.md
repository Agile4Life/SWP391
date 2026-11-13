# Kịch bản demo mainflow 25 phút — Mua gói · Check-in cổng · Đặt lịch · Bảo lưu

Một câu chuyện xuyên suốt: **Hồ Mỹ Lan (`lan@demo.sol.vn`) — hội viên mới** đi từ KYC → mua gói Platinum 3 tháng → vào cổng → đăng ký khóa + đặt PT → xin bảo lưu. Lễ tân **Trần Bảo Ngọc (`letan@demo.sol.vn`)** xử lý phía quầy. Mật khẩu chung `Demo@12345` ([DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md)).

Căn cứ nghiệp vụ: [specs/2026-11-10-membership-and-attendance-business-rules.md](specs/2026-11-10-membership-and-attendance-business-rules.md). Tài liệu `SPRINT2_DEMO_REPORT_GUIDE.md` đã cũ (route `/staff/checkin`, 3 gói "The Essential…"), **không dùng** cho buổi này.

## Vì sao chọn Lan + Platinum 3 tháng

- Lan chưa có gói, KYC đang chờ duyệt → có sẵn bước KYC (bắt buộc cho gói đầu tiên: `MEMBERSHIP_KYC_REQUIRED`).
- **Chỉ gói dài hạn (≥ 60 ngày) hoặc Platinum 1 tháng mới được bảo lưu** (Silver/Gold 1 tháng không được). Platinum 3 tháng bảo lưu tối đa 30 ngày, và có 6 buổi PT miễn phí / chu kỳ, 4 khóa nhóm miễn phí → đặt lịch không vướng thanh toán.
- Gói mới bắt đầu **hôm nay** → check-in `GRANTED` ngay trong buổi demo.

## Chuẩn bị (làm trước 1 ngày + 15 phút trước giờ)

| Việc | Chi tiết |
|---|---|
| Seed lại dữ liệu | Seed hiện tại dựng theo ngày 12/11/2026. `hieu@` hết hạn 15/11, buổi lớp/PT "sắp tới" chỉ còn đúng nếu seed **1–2 ngày trước demo** ([DEMO_DATA.md](DEMO_DATA.md)). Chỉ bật trên DB demo. |
| 3 cửa sổ trình duyệt | (1) Hội viên `lan@` — cửa sổ ẩn danh. (2) Lễ tân `letan@` — profile thường. (3) Quản lý `manager@` — mở sẵn `/manager/reports`. Đăng nhập sẵn cả ba. |
| Điện thoại | Đăng nhập `lan@`, mở sẵn `/member/check-in` (camera). Máy chiếu bên lễ tân mở `/staff/check-in` để hiện **QR cổng**. |
| Thanh toán | VNPay Sandbox chỉ chạy khi backend có `VNPAY_ENABLED` + merchant ([VNPAY_SANDBOX.md](VNPAY_SANDBOX.md)). Chưa có → **demo tiền mặt tại quầy** (kịch bản dưới mặc định như vậy). Không đoán VNPay chạy được. |
| Kiểm tra nhanh | Đăng nhập `lan@`: chưa có gói. `/staff/kyc` có hồ sơ của Lan. `/member/classes` có khóa còn chỗ, các buổi rơi vào 3–10 ngày tới. Tab PT 1:1 có khung giờ trống cùng khoảng ngày đó. |
| Chọn ngày bảo lưu | Chốt trước: ngày bảo lưu = **hôm nay + 3 → hôm nay + 9** (7 ngày). Khóa nhóm có buổi và buổi PT đều rơi vào khoảng này (ví dụ hôm nay + 5). |

## Dòng thời gian

| Phút | Phần | Ai thao tác |
|---|---|---|
| 0:00–1:30 | Mở đầu, giới thiệu 3 vai trò | Người dẫn |
| 1:30–4:00 | **A.** KYC | Lễ tân |
| 4:00–9:00 | **B.** Mua gói → thu tiền → hóa đơn → thẻ QR | Hội viên + Lễ tân |
| 9:00–13:30 | **C.** Check-in cổng (GRANTED, check-out, DENIED) | Hội viên + Lễ tân |
| 13:30–18:30 | **D.** Đăng ký khóa nhóm + PT 1:1 | Hội viên |
| 18:30–23:00 | **E.** Bảo lưu và hệ quả | Hội viên + Lễ tân |
| 23:00–25:00 | **F.** Tổng kết, báo cáo quản lý | Quản lý |

Đệm: nếu trễ, cắt D (bỏ PT, chỉ giữ khóa) hoặc F; **không cắt E** vì đó là điểm ăn tiền của nghiệp vụ.

---

## 0:00–1:30 — Mở đầu

Nói: "Hôm nay nhóm demo một vòng đời hội viên trọn vẹn tại SÖL Fitness: đăng ký → trả tiền → vào cổng → đặt lịch → bảo lưu. Ba vai trò thao tác song song: hội viên, lễ tân, quản lý. Mọi quy tắc quan trọng đều do backend kiểm tra, không phải ẩn nút ở giao diện."

## A. KYC (1:30–4:00)

1. **Lễ tân** → `/staff/kyc` → mở hồ sơ Lan (chờ duyệt) → **Duyệt**.
2. Nói: gói đầu tiên bắt buộc KYC; số CCCD/hộ chiếu được băm (`CccdHasher`), không lưu bản rõ.
3. (Tùy thời gian) Chỉ nhanh `phuc@` cũng đang chờ KYC để cho thấy hàng đợi.

Điểm nhấn: nếu bỏ bước này, Lan bấm mua sẽ nhận `MEMBERSHIP_KYC_REQUIRED`.

## B. Mua gói và thu tiền (4:00–9:00)

1. **Hội viên (Lan)** → `/member/packages` → chọn **Platinum 3 tháng** → vào `/member/packages/checkout`. Chỉ ra: giá và quyền lợi theo hạng, trang thanh toán có "VNPay hoặc Ví SÖL" và "Tiền mặt tại quầy".
2. Chọn **tiền mặt** → yêu cầu ở trạng thái `pending_payment`, bắt đầu hôm nay.
3. Bấm mua lần hai (hoặc gói khác) để lộ guard: bị chặn `MEMBERSHIP_PENDING_EXISTS` — mỗi hội viên chỉ một yêu cầu chờ.
4. **Lễ tân** → `/staff/reception` → mục **Đơn tại quầy** (tự làm mới 30 giây, bấm làm mới ngay) → dòng yêu cầu của Lan → chọn hình thức thu → **Xác nhận thu tiền**.
5. Hiện **hóa đơn** (`PaymentInvoice`, có nút in).
6. **Hội viên** → `/member/invoices` thấy hóa đơn; `/member/card` thấy thẻ **Active**, mã QR vừa được sinh.

Nói khi kích hoạt (một transaction): Payment `success` → subscription `active` → sinh `qr_code` → phát hành hóa đơn. Giá là **giá chốt lúc tạo yêu cầu**; quản lý đổi giá sau đó không ảnh hưởng số tiền đã báo cho Lan.

Nếu có VNPay Sandbox: thay bước 2–4 bằng "Thanh toán VNPay Sandbox", nói thêm "kết quả chỉ được ghi nhận khi IPN hợp lệ (HMAC-SHA512, khớp số tiền), trang return không cấp quyền".

## C. Check-in cổng (9:00–13:30)

Có hai đường vào, demo cả hai:

1. **Hội viên tự quét QR cổng** (đường chính): Lễ tân mở `/staff/check-in` → hiện **QR cổng** (sống 60 giây, tự làm mới 45 giây). Lan dùng **điện thoại** → `/member/check-in` → chế độ Check-in → quét. Kết quả **Check-in thành công**, tên và giờ vào; lịch sử ra vào cập nhật.
2. **Lễ tân quét thẻ hội viên**: `/member/card` của Lan → sao chép mã QR → dán vào ô "Mã QR hội viên" trên `/staff/check-in`. Lần này sẽ **bị từ chối `already_checked_in`** (anti-passback — Lan đang ở trong trung tâm). Nói: khóa hàng hội viên nên hai cổng quét cùng lúc cũng không lọt.
3. **Check-out**: Lan chuyển sang chế độ Check-out và quét lại QR cổng (hoặc lễ tân bấm "Ra về" ở `/staff/check-out`). Sau đó có thể check-in lại.
4. **DENIED**: dán mã QR của hội viên không đủ điều kiện:
   - `dung@` — gói **hết hạn** (`subscription_expired`);
   - `em@` — gói **bảo lưu** (`frozen` bị từ chối, nối sang phần E).
   Nói: mọi lượt quét, kể cả bị từ chối, đều được ghi lại kèm lý do; trigger DB là lớp bảo vệ thứ hai.

Chuẩn bị riêng: lấy sẵn mã QR của `dung@` và `em@` (đăng nhập, mở thẻ, sao chép) vì mã sống theo từng gói; nếu thẻ không hiện mã, quét QR cổng bằng tài khoản đó trên `/member/check-in` để lấy kết quả DENIED. **Hãy chạy thử trước một lần** — mình chưa kiểm chứng thẻ của gói hết hạn/đóng băng có cho sao chép mã hay không.

Nói thêm khi quét cổng: nếu Lan có buổi lớp/PT trong ngày, hệ thống tự điểm danh (từ 30 phút trước giờ bắt đầu; muộn hơn 15 phút là `late`).

## D. Đặt lịch (13:30–18:30)

Chính sách: **không có lớp lẻ / đặt từng buổi** (`SingleSessionPolicy`, spec 2026-11-09). Mọi lớp là một khóa định kỳ; hội viên đăng ký **trọn khóa**, nên không có hàng chờ (waitlist) và không có "đặt một buổi".

1. **Khóa nhóm** — Lan → `/member/classes` → chọn một khóa **khai giảng trong hoặc kéo dài qua khoảng bảo lưu** → **Đăng ký trọn gói** (khóa có phí: **Đăng ký & Thanh toán**). Badge đổi sang đã đăng ký, nút thành **Hủy khóa học**. Platinum có 4 khóa miễn phí mỗi chu kỳ.
2. Thử đăng ký một khóa **trùng giờ** với khóa vừa đăng ký → bị chặn (kiểm tra chồng lịch ở giao diện và trigger DB).
3. Nói: chỉ hội viên có gói `active` đăng ký được; khóa phải nằm gọn trong hạn gói; sĩ số khóa dòng + trigger capacity. Nút "Đặt chỗ ngay" ở danh sách buổi cũng chỉ đăng ký cả khóa. Quản lý chỉ tạo được khóa định kỳ (`POST /classes/recurring`).
4. **PT 1:1** — cùng trang, tab **Đặt lịch HLV 1:1 (PT)** (`?tab=pt`) → chọn HLV → khung giờ trống cùng ngày (hôm nay + 5) → xác nhận. Platinum có 6 buổi PT miễn phí/chu kỳ nên **không phát sinh thanh toán**; hết hạn mức thì PT trả theo giờ (tiền mặt hoặc VNPay).
5. Hiện lịch của tôi: khóa đã đăng ký + buổi PT. Buổi PT sẽ bị hủy ở phần E; các buổi của khóa trong kỳ bảo lưu được đánh dấu `excused`.

## E. Bảo lưu (18:30–23:00)

1. **Hội viên (Lan)** → `/member/hold`. Chỉ ra khung **Quy định bảo lưu**: 3–30 ngày, một lần cho mỗi gói, nộp trước ít nhất 24 giờ, ngày bảo lưu được cộng vào hạn gói.
2. Điền: bắt đầu **hôm nay + 3**, kết thúc **hôm nay + 9**, lý do (ví dụ "Công tác xa"), đính kèm 1 ảnh/PDF (giấy tờ không bắt buộc ở giao diện hiện tại — tài liệu spec nói "bắt buộc" đã lạc hậu, giao diện và code chỉ giới hạn tối đa 5 tệp, mỗi tệp 5 MB; xin đừng nói bắt buộc). **Gửi đơn** → trạng thái **Đang chờ duyệt**.
3. Thử nộp sai để thấy guard (chọn một lần): bắt đầu ngày mai (vi phạm nộp trước 24 giờ), hoặc khoảng 2 ngày (dưới tối thiểu 3 ngày).
4. **Lễ tân** → `/staff/holds` → bấm mở giấy tờ đính kèm → **Duyệt bảo lưu**.
5. **Quay lại Lan**: `/member/classes` — buổi PT trong khoảng bảo lưu **đã bị hủy tự động**, chỗ được giải phóng; các buổi của khóa trong kỳ bảo lưu hiện **excused** (không tính vắng, cần kiểm tra trên màn điểm danh); `/member/hold` hiện **Đã duyệt**; có thông báo. Hạn gói sẽ được cộng đúng số ngày bảo lưu khi kỳ bảo lưu kết thúc.
6. Giải thích vòng đời (không cần chờ thật): job 00:15 hằng ngày đóng băng gói sang `frozen` vào ngày đầu kỳ bảo lưu và tự khôi phục sau ngày cuối; hội viên cũng có thể `resume` sớm. Trong lúc `frozen`: không check-in, không đặt lịch.
7. **Chứng minh bằng dữ liệu có sẵn**: mở `em@` (Silver, **đang bảo lưu**) → `/member/hold` hiện đơn đã duyệt; dán QR của `em@` vào `/staff/check-in` → từ chối. Kết nối lại với phần C.
8. Nhấn mạnh: có thể **hủy bảo lưu chưa bắt đầu** (lịch đã hủy không tự khôi phục, gói được trả lại lượt bảo lưu), và buổi lớp trong kỳ bảo lưu được đánh dấu `excused` nên không tính vắng, không dính quy tắc 50%.

Câu hỏi hội đồng hay hỏi, trả lời sẵn: *"Gold 1 tháng có bảo lưu không?"* Không — chỉ gói dài hạn và Platinum 1 tháng. *"Bảo lưu hai lần?"* Không — `hold_used` đặt khi duyệt và không xóa.

## F. Tổng kết và báo cáo (23:00–25:00)

1. **Quản lý** → `/manager/reports`: doanh thu có khoản vừa thu của Lan. (Có thể thêm `/admin/payments` — đối soát thanh toán, nếu có đăng nhập admin.)
2. Chốt 4 ý:
   - Một vòng đời, ba vai trò, mọi bước có audit: hóa đơn, bản ghi check-in (kể cả DENIED), đơn bảo lưu.
   - Backend luôn kiểm tra role và quy tắc; trigger DB chặn trùng lịch, vượt sĩ số, gói hết hạn.
   - Giá chốt, tiền hoàn tính từ tiền thực trả.
   - Song ngữ vi/en qua `Accept-Language`.
3. Mở Q&A.

---

## Sự cố thường gặp và cách xử lý trên sân khấu

| Tình huống | Xử lý |
|---|---|
| Camera điện thoại không quét được QR cổng | Quay lại cách 2: sao chép mã QR từ `/member/card` dán vào `/staff/check-in`. |
| QR cổng hết hạn khi vừa quét | Mã sống 60 giây; bấm "Tạo lại mã QR cổng". |
| Lan bị `MEMBERSHIP_KYC_REQUIRED` | Chưa duyệt KYC ở bước A; quay lại `/staff/kyc`. |
| Nút "Gửi đơn bảo lưu" không hiện | Gói chưa `active`, hoặc đã dùng lượt bảo lưu, hoặc gói không đủ điều kiện (Silver/Gold 1 tháng). Dùng `an@` (Platinum 3 tháng, hạn 31/12) làm phương án thay thế. |
| Không có khung giờ PT/lớp trong khoảng 3–9 ngày tới | Đổi ngày bảo lưu cho khớp, hoặc bỏ phần PT. Seed lại 1–2 ngày trước demo giải quyết phần lớn. |
| VNPay lỗi cấu hình (503) | Chuyển sang tiền mặt tại quầy, không giải thích dài. |
| Mạng chậm | Các trang đều có skeleton/lỗi/thử lại; chờ, đừng tải lại liên tục (QR cổng tải lại sẽ đổi mã). |

## Chia vai gợi ý (4 người)

| Người | Phần |
|---|---|
| Người dẫn | Mở đầu, nói lời chuyển, tổng kết, F |
| Thao tác hội viên (Lan) | B1–B3, C, D, E1–E3 |
| Thao tác lễ tân | A, B4–B5, C kết hợp, E4 |
| Giải thích kỹ thuật | Chỉ vào log/Swagger/trigger khi hội đồng hỏi: `PaymentService`, `CheckInService`, `MembershipSubscriptionService` (bảo lưu), `PostgreSqlTriggerProvider` |

## Chưa kiểm chứng (đọc code/tài liệu, chưa chạy thật)

- Luồng chạy end-to-end trên DB demo hiện tại; thứ tự nút, câu chữ giao diện lấy từ mã nguồn, có thể lệch nhẹ.
- Thẻ QR của gói hết hạn/đóng băng có sao chép được không (phần C, mục DENIED).
- Khi duyệt bảo lưu, việc xử lý đăng ký **trọn khóa** (giữ nguyên + excused hay hủy) — chạy thử trước khi nói với hội đồng.
- VNPay Sandbox: cần merchant thật.
