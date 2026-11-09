# Quyền lợi gói tập, đăng ký khóa học và bảo lưu

- Ngày: 2026-11-09
- Trạng thái: Đã chốt nghiệp vụ (vòng 3), sẵn sàng triển khai
- Liên quan: `2026-11-09-recurring-courses-design.md` (khóa học định kỳ, PR #120)

## 1. Nghiệp vụ đã chốt

### 1.1 Đánh giá thể trạng lần đầu
- Mọi member khi đến trung tâm lần đầu được **coach** đánh giá thể trạng và BMI, để tư vấn gói tập và lộ trình.
- Áp dụng cho tất cả, kể cả chưa mua gói. Đây là một bản ghi, **không chặn** việc mua gói.

### 1.2 Quyền lợi theo gói

| Quyền lợi | Silver | Gold | Platinum | Trial 3 ngày |
|---|---|---|---|---|
| Tập không giới hạn trong giờ hoạt động | ✔ | ✔ | ✔ | ✔ |
| Khu vực tập | Tiêu chuẩn | Tiêu chuẩn | + phòng VIP riêng | Như Gold |
| Lượt đăng ký khóa Group Fitness — gói 1 tháng | 1 | 2 | 4 | **0** |
| Lượt đăng ký khóa Group Fitness — gói 3 tháng | 3 | 6 | 12 | — |
| PT 1:1 | 0 | 3 / tháng | 6 / tháng | **1** |
| Phòng thay đồ, tủ khóa | Chung | Tủ cá nhân cố định | Tủ cao cấp có khóa riêng | Như Gold |
| Khăn | — | Khăn tập mỗi buổi | Khăn tập + khăn tắm VIP | Như Gold |
| Đồ uống | Nước uống | Nước uống | Nước khoáng + đồ uống thể thao | Như Gold |
| Đánh giá thể trạng | Lần đầu | Định kỳ mỗi tháng | Định kỳ + chuyên sâu: BMI, Body Fat, Muscle Mass | Như Gold |
| Kế hoạch / giáo án | — | Kế hoạch cơ bản | Giáo án riêng theo mục tiêu | Như Gold |
| Tư vấn dinh dưỡng với HLV | — | — | ✔ | — |
| Giảm giá PT bổ sung và sản phẩm | — | 10% | 20% | — |
| Sự kiện độc quyền | — | — | ✔ | — |

- Khăn, tủ khóa và đồ uống là quyền lợi tại quầy: chỉ hiển thị trong mô tả gói, hệ thống không kiểm soát.
- "Mỗi tháng" là mỗi chu kỳ 30 ngày tính từ ngày bắt đầu gói, không theo tháng dương lịch.

### 1.3 Khóa học
- **Bỏ hoàn toàn lớp học đơn lẻ một buổi.** Mọi lớp là khóa học định kỳ. Manager tự chọn số tuần cho phù hợp giáo án.
- **Mỗi lượt đăng ký là một khóa học**, không phải một buổi.
- Mỗi lần đăng ký trừ một lượt của gói. Hết lượt miễn phí thì phải thanh toán học phí khóa.
- **Khóa học phải kết thúc trước ngày hết hạn gói.** Nếu khóa kéo dài quá hạn, member phải gia hạn (và thanh toán xong kỳ gia hạn) mới được đăng ký. Hạn được tính đến ngày kết thúc của chuỗi gói đã thanh toán, gồm cả các kỳ gia hạn.
- Vắng hoặc đến trễ thì **không hoàn tiền, không dạy bù**. Khóa vẫn chạy theo lịch chung của lớp.

### 1.4 Vắng mặt và khóa quyền đăng ký
- Nếu member **vắng quá 50% số buổi** của một khóa đã đăng ký, hệ thống **khóa tính năng đăng ký khóa mới trong 30 ngày**.
- Cách tính:
  - Số buổi vắng > 50% tổng số buổi của khóa. Vì vậy có thể bị khóa ngay giữa khóa, không cần đợi khóa kết thúc.
  - Thời gian khóa bắt đầu từ lúc vượt ngưỡng.
- Trạng thái điểm danh:
  - `absent` tính là vắng.
  - `late` tính là có mặt.
  - `excused` không tính là vắng; gồm các buổi rơi vào giai đoạn bảo lưu đã duyệt.
- Buổi không được điểm danh sẽ tự chuyển `absent` sau khi buổi kết thúc. Coach vẫn sửa được.
- Lệnh khóa không ảnh hưởng các khóa đang học. Member vẫn check-in và học tiếp bình thường.

### 1.5 Quota khi gia hạn và nâng cấp
- Lượt khóa học và lượt PT **không cộng dồn**. Hết gói thì phần chưa dùng mất.
- **Nâng cấp giữa chừng:** lượt còn lại = hạn mức của gói mới − số lượt đã dùng trong kỳ hiện tại, tối thiểu 0.
  - Ví dụ: Silver đã dùng 1 lượt, nâng lên Gold (2 lượt) thì còn 1 lượt.
  - PT tính tương tự trong chu kỳ 30 ngày hiện tại.
- **Gia hạn giữa chừng:**
  - Kỳ gia hạn bắt đầu sau ngày hết hạn của kỳ hiện tại.
  - Lượt của kỳ nào thì trừ vào kỳ đó, tính theo ngày khai giảng của khóa.
  - Lượt đã dùng ở kỳ hiện tại không được hoàn lại hay chuyển sang kỳ mới.

### 1.6 Bảo lưu
- Phải có lý do và giấy tờ, thường là giấy tờ y tế.
- Thời gian tối đa:

  | Gói | Tối đa |
  |---|---|
  | Silver 3 tháng | 7 ngày |
  | Gold 3 tháng | 15 ngày |
  | Platinum 3 tháng | 30 ngày |
  | Platinum 1 tháng | 7 ngày |
  | Silver/Gold 1 tháng, Trial | Không được bảo lưu |

- Mỗi gói chỉ bảo lưu **một lần**, tối thiểu **3 ngày**.
- Phải nộp đơn **trước ít nhất 24 giờ** so với ngày bắt đầu bảo lưu, kèm giấy tờ y tế.
- Khi duyệt, hệ thống tự hủy các chỗ đã đặt (buổi khóa học, PT, sân) trong giai đoạn bảo lưu để trả chỗ cho người khác.
- Hạn gói được cộng thêm đúng số ngày đã bảo lưu.

**Màn hình cho member** — mục "Bảo lưu gói tập":
- Chọn ngày bắt đầu và kết thúc. Hệ thống hiện số ngày tối đa của gói và kiểm tra quy tắc ngay trên form.
- Nhập lý do, tải lên giấy tờ (ảnh/PDF), gửi đơn.
- Xem trạng thái đơn: chờ duyệt, đã duyệt, bị từ chối kèm lý do. Hủy được đơn khi còn đang chờ duyệt.

**Màn hình cho receptionist và manager** — "Quản lý bảo lưu":
- Danh sách đơn, lọc theo trạng thái.
- Xem chi tiết đơn và giấy tờ đính kèm, duyệt hoặc từ chối kèm lý do.
- Tra cứu lịch sử bảo lưu và giấy tờ đã lưu của từng member.
- Giấy tờ y tế là dữ liệu nhạy cảm. Chỉ member chủ đơn, receptionist và manager được xem. Tải về qua endpoint có kiểm tra quyền, không dùng link public.

## 2. Đối chiếu với code trên `main`

| # | Nghiệp vụ | Hiện trạng | Thay đổi cần làm |
|---|---|---|---|
| G1 | Lượt khóa học 1/2/4 (1 tháng), 3/6/12 (3 tháng), trial 0 | `CatalogSeeder`: Silver 2/6, Gold 5/15, Platinum không giới hạn, Trial 3 | Sửa seeder và cập nhật dữ liệu gói đang có |
| G2 | Phân hạng | `MembershipPackage.tier` đã có, nhưng PT, sân và phòng VIP vẫn so tên gói (`contains`) | Đọc `tier`. Thêm cột quota trên gói: `ptSessionLimit`, `holdMaxDays` |
| G3 | PT 0/3/6, trial 1 | `CoachBookingService` tính theo tháng dương lịch và theo tên gói | Đọc quota từ gói, tính theo chu kỳ 30 ngày của gói |
| G4 | Bỏ lớp đơn lẻ | Vẫn còn `POST /classes`, `POST /classes/{id}/sessions`, `POST /classes/sessions/{id}/enroll`, `session-bookings` | Giai đoạn 1: chặn tạo mới và ẩn trên UI. Giai đoạn 2: dọn code |
| G5 | Khóa học nằm trong hạn gói | `enrollCourse` chỉ kiểm tra gói đang active | Kiểm tra `course.endDate ≤ ngày hết hạn của chuỗi gói đã thanh toán`. Báo lỗi i18n gợi ý gia hạn |
| G6 | Vắng > 50% thì khóa 30 ngày | Điểm danh chỉ để thống kê, không có auto-absent | Job tự đánh `absent`. Thêm cờ khóa đăng ký trên member (`courseEnrollBlockedUntil`) và kiểm tra khi đăng ký. Hiển thị cho member |
| G7 | Lượt khi nâng cấp | Nâng cấp tạo subscription mới, lượt reset về đầy | Đếm lượt đã dùng trong kỳ hiện tại, trừ vào hạn mức gói mới |
| G8 | Bảo lưu theo gói | `MAX_HOLD_DAYS = 90` chung. Bảo lưu bắt đầu ngay khi duyệt, kết thúc khi member tự resume. Không có ngày bắt đầu/kết thúc, không có giấy tờ, không giới hạn số lần | Thêm `holdStartDate`, `holdEndDate`, cờ đã bảo lưu. Kiểm tra: ≥24h, 3–max ngày, một lần, gói được phép. Scheduler tự freeze vào ngày bắt đầu và tự mở lại vào ngày kết thúc |
| G9 | Giấy tờ bảo lưu | Chưa có nơi lưu file | Entity `HoldDocument`, upload/tải về có phân quyền. Tái sử dụng hạ tầng lưu ảnh KYC nếu được |
| G10 | Hủy chỗ khi bảo lưu | `approveHold` hủy toàn bộ lịch tương lai | Chỉ hủy trong giai đoạn bảo lưu. Buổi khóa học trong khoảng đó đánh `excused` |
| G11 | Giảm giá 10/20% | Chưa có | Áp dụng khi thanh toán PT bổ sung, học phí khóa và shop (xem mục 3.3) |
| G12 | Đánh giá thể trạng | Có `CoachHealthMetrics` (BMI, body_fat...), không phân quyền theo hạng | Coach đánh giá lần đầu cho mọi member. Gold định kỳ hằng tháng. Platinum thêm Body Fat và Muscle Mass |
| G13 | Giáo án | Coach lên giáo án được cho member mọi hạng | Coach vẫn tạo; ẩn giáo án với member Silver trên portal |

## 3. Quyết định bổ sung (vòng 3)

1. **Đặt sân:** giữ nguyên 1/2/3 lượt mỗi chu kỳ 30 ngày theo hạng, đọc từ `tier` thay vì so tên gói.
2. **Giáo án Silver:** coach vẫn tạo được, nhưng **ẩn với member Silver** (không hiện trên portal member). Member nâng lên Gold/Platinum thì thấy lại.
3. **Giảm giá 10/20%:** làm ngay trong đợt này.
   - Gold giảm 10%, Platinum giảm 20%; trial và Silver không giảm.
   - Áp dụng cho PT bổ sung (ngoài quota), học phí khóa (khi hết lượt miễn phí) và sản phẩm shop.
   - Hạng được xác định theo gói đang active **tại thời điểm tạo thanh toán**, và mức giảm được lưu trên payment hoặc order để đối soát.
   - Không áp dụng cho việc mua hoặc gia hạn gói tập.
4. **Trial không được vào phòng VIP.**
5. **Đánh giá lần đầu:** coach chỉ đánh giá cho người **đã có tài khoản member** (có thể chưa mua gói). Không ghi cho khách vãng lai.

## 4. Ticket đề xuất

**P1 — dữ liệu, quota, khóa học**
- T1: Cột quota trên `MembershipPackage`, seeder 1/2/4 và 3/6/12, bỏ so tên gói và chuyển sang `tier`, PT theo chu kỳ 30 ngày (G1–G3).
- T2: Chặn tạo lớp đơn lẻ và ẩn UI; cập nhật OpenAPI và test (G4).
- T3: Khóa học phải nằm trong hạn gói; trừ lượt khi nâng cấp (G5, G7).

**P2 — vắng mặt và bảo lưu**
- T4: Tự đánh vắng, luật vắng > 50% thì khóa đăng ký 30 ngày (G6).
- T5 (backend): Bảo lưu theo ngày, giới hạn theo gói, một lần, tối thiểu 3 ngày, nộp trước 24 giờ; scheduler freeze và mở lại; chỉ hủy chỗ trong giai đoạn bảo lưu (G8, G10).
- T6: Lưu giấy tờ y tế, API upload và tải về có phân quyền (G9).
- T7 (frontend member): Mục nộp giấy tờ và làm đơn bảo lưu.
- T8 (frontend receptionist/manager): Màn hình quản lý đơn và giấy tờ bảo lưu.

**P3 — dịch vụ theo hạng**
- T9: Coach đánh giá thể trạng lần đầu; đánh giá định kỳ và chuyên sâu theo hạng (G12).
- T10: Ẩn giáo án với member Silver (G13).
- T11: Giảm giá 10/20% theo hạng khi thanh toán PT bổ sung, học phí khóa, shop (G11) — làm trong đợt này.

Mọi ticket phải thêm message key vào `messages_vi.properties` và `messages_en.properties`, và cập nhật `docs/api-contracts/` nếu đổi API.
