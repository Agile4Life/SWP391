# Tri thức Sol AI

<!--
Nội dung Sol AI dùng để trả lời khách. Sửa file này không cần đụng code Java.
- Mỗi mục bắt đầu bằng "## ". Dòng "Từ khóa:" (viết không dấu) quyết định khi nào mục được đưa vào prompt;
  "Từ khóa: *" nghĩa là luôn đưa vào. Câu hỏi không khớp mục nào thì đưa toàn bộ.
- {{...}} là con số lấy từ code hoặc cấu hình lúc khởi động. Đừng thay bằng số viết cứng.
- Chỉ thêm quy định đã có trong code hoặc được trung tâm xác nhận. Không tự đặt giờ mở cửa, mức phí.
- Mục "Quyền lợi theo hạng gói" do code sinh ra từ PackageBenefits, không viết ở đây.
-->

## Giới thiệu
Từ khóa: *
- Trung tâm thể thao SÖL: Gym là bộ môn chính; bộ môn phụ gồm Bơi lội, Boxing, Tennis, Cầu lông, Yoga.
- Các mục trên Portal hội viên: 'Gói tập & Bảo lưu', 'Lịch học & Đặt chỗ', 'Đặt sân', 'Thẻ & Check-in', 'Giao dịch & Hóa đơn', 'Sản phẩm & Đơn hàng', 'Tiến độ & Giáo án', 'Hồ sơ & Sức khỏe', 'Thông báo'.
- Chỉ hội viên có gói tập đang hoạt động và chưa hết hạn mới đặt lớp, dùng quyền lợi gói và check-in được.

## Mua, gia hạn và nâng cấp gói
Từ khóa: mua goi, gia han, nang cap, goi tap, het han, dang ky goi, bang gia
- Mua mới, gia hạn hoặc nâng cấp gói tại mục 'Gói tập & Bảo lưu' hoặc tại quầy lễ tân.
- Giá và thời hạn từng gói xem ở bảng giá gói tập trong dữ liệu hệ thống.

## Gói trải nghiệm
Từ khóa: trai nghiem, dung thu, trial, mien phi, tap thu
- Gói trải nghiệm {{trial.days}} ngày chỉ dành cho hội viên mới chưa từng đăng ký gói tập; mỗi tài khoản và mỗi số CCCD/Hộ chiếu chỉ nhận một lần.
- Gửi yêu cầu trên Portal rồi xuất trình CCCD hoặc Hộ chiếu gốc tại quầy lễ tân để kích hoạt. Hộ chiếu dành cho người nước ngoài.

## Check-in và check-out
Từ khóa: check in, checkin, check out, checkout, qr, cong, the hoi vien, quet ma, vao cong
- Mở 'Thẻ & Check-in' > 'Quét QR cổng' và quét mã tại cổng sảnh lễ tân. Mã QR tự đổi sau mỗi {{checkin.qrTtlSeconds}} giây nên ảnh chụp màn hình không dùng được.
- Lượt vào chưa check-out sau {{checkin.autoCheckoutHours}} giờ được hệ thống tự check-out.
- Điểm danh buổi khóa học do HLV của lớp thực hiện. Quét cổng không tự điểm danh; HLV chỉ thấy thông tin bạn đã check-in vào trung tâm trong khung giờ buổi học.

## Lịch học và đặt chỗ
Từ khóa: dat lop, dat cho, lich hoc, huy lop, huy buoi, huy cho, khoa hoc, lop hoc, buoi hoc, dat nhieu buoi
- Mọi lớp là khóa học lặp lại theo lịch tuần. Tại 'Lịch học & Đặt chỗ', hội viên đăng ký cả khóa học; không còn đặt lẻ từng buổi hay đặt nhiều buổi một lượt.
- Chỉ đăng ký được khóa học chưa bắt đầu và kết thúc trong thời hạn gói. Mỗi gói có số khóa học miễn phí theo hạng (xem mục Quyền lợi theo hạng gói); vượt số này thì đóng học phí.
- Hủy đăng ký được trước khi khóa học bắt đầu: lượt miễn phí được trả lại, học phí đã trả hoàn vào Ví SÖL. Khóa đã bắt đầu thì không hủy được.
- Khóa học có phí trả online (ví hoặc VNPay) được giữ chỗ {{course.onlineHoldMinutes}} phút để thanh toán; trả tiền mặt tại quầy thì giữ chỗ đến khi khóa học bắt đầu.
- Vắng quá nửa số buổi của một khóa học sẽ bị chặn đăng ký khóa học mới trong {{course.blockDays}} ngày. Buổi nghỉ trong thời gian bảo lưu đã duyệt không tính là vắng.

## Đặt sân
Từ khóa: san, dat san, tennis, cau long, boi, ho boi, gia san, thue san
- Đặt sân Tennis, Cầu lông và Bơi tại mục 'Đặt sân', mỗi lượt một giờ.
- Giá {{court.standardPrice}} VNĐ/giờ; khung bắt đầu từ {{court.eveningFrom}} trở đi là {{court.eveningPrice}} VNĐ/giờ (đã gồm tiền đèn).
- Thanh toán VNPay phải hoàn tất trong {{court.vnpayTimeoutMinutes}} phút. Lượt đặt trả tại quầy mà chưa thanh toán sẽ bị hủy {{court.cashReleaseLeadMinutes}} phút trước giờ chơi để nhường sân.
- Lượt sân miễn phí, số ngày được đặt trước và số lượt chờ thanh toán tùy hạng gói (xem mục Quyền lợi theo hạng gói).

## Bảo lưu gói tập
Từ khóa: bao luu, tam dung, dong bang, hold, nghi tap, tam ngung
- Gửi yêu cầu tại 'Gói tập & Bảo lưu' > 'Bảo lưu'; lễ tân xét duyệt.
- Gửi trước ngày bắt đầu bảo lưu ít nhất {{hold.noticeHours}} giờ; mỗi lần tối thiểu {{hold.minDays}} ngày, tối đa theo hạng và thời hạn gói (xem mục Quyền lợi theo hạng gói).
- Đính kèm được tối đa {{hold.maxDocuments}} giấy tờ, mỗi file không quá {{hold.maxDocumentMb}} MB.
- Trong thời gian bảo lưu đã duyệt không đặt được PT 1:1, sân, và không đăng ký được khóa học bắt đầu trong khoảng đó.
- Khi duyệt, các lịch rơi vào thời gian bảo lưu bị hủy: khóa học được trả lượt hoặc hoàn học phí nếu duyệt trước ngày khóa bắt đầu ít nhất {{hold.courseRefundDays}} ngày; PT 1:1 được trả lượt hoặc hoàn tiền nếu duyệt trước buổi tập ít nhất {{hold.ptRefundDays}} ngày; sân được trả lượt hoặc hoàn tiền nếu duyệt trước giờ chơi ít nhất {{hold.courtRefundHours}} giờ. Muộn hơn thì mất lượt hoặc mất tiền. Tiền hoàn vào Ví SÖL.
- Lễ tân từ chối thì luôn ghi lý do, hội viên xem được trong thông báo và trang Bảo lưu.
- Hết thời gian bảo lưu, gói tự hoạt động lại và được cộng bù số ngày đã bảo lưu.

## Hủy gói và hoàn tiền
Từ khóa: huy goi, hoan tien, refund, tra lai tien, ngung goi
- Liên hệ quầy lễ tân để lập yêu cầu hủy gói; quản lý trung tâm xét duyệt.
- Số tiền hoàn đề xuất là phần chưa sử dụng của số tiền hội viên đã thực trả cho kỳ gói (gồm giá trị chuyển từ gói cũ khi nâng cấp), không tính theo giá niêm yết hiện tại; quản lý có thể điều chỉnh. Tiền hoàn vào Ví SÖL.

## Ví SÖL
Từ khóa: vi, nap tien, so du, wallet, vnpay, thanh toan
- Nạp ví qua VNPay trên Portal hoặc nạp tiền mặt tại quầy lễ tân.
- Ví dùng để thanh toán khóa học có phí và đặt sân; tiền hoàn khi hủy gói hoặc hủy đơn hàng đã thanh toán được trả về ví.

## Cửa hàng sản phẩm
Từ khóa: san pham, cua hang, shop, don hang, mua hang, whey, thuc pham bo sung, giao hang
- Xem và đặt sản phẩm tại 'Sản phẩm & Đơn hàng'. Đặt hàng cần tài khoản hội viên nhưng không bắt buộc có gói tập đang hoạt động.
- Đơn thanh toán online được giữ hàng {{shop.paymentWindowMinutes}} phút; đơn nhận và trả tiền tại quầy được giữ {{shop.counterHoldHours}} giờ. Quá hạn, đơn tự hủy.
- Hủy đơn đã thanh toán thì tiền được hoàn vào Ví SÖL.
- Phí giao hàng {{shop.shippingFee}} VNĐ, miễn phí cho đơn từ {{shop.freeShippingThreshold}} VNĐ. Nhận tại quầy: {{shop.pickupAddress}}.

## Hỗ trợ và khiếu nại
Từ khóa: ho tro, khieu nai, phan anh, le tan, lien he, ticket, gop y
- Gửi phiếu tại 'Tin nhắn' > 'Hỗ trợ & Khiếu nại' để lễ tân xử lý, hoặc nhắn trực tiếp cho lễ tân/HLV trong mục Tin nhắn.
