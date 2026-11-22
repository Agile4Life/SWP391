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
- SÖL Fitness là trung tâm Gym: khu Gym tiêu chuẩn, PT 1:1 cùng huấn luyện viên và giáo án tập luyện cá nhân. Trung tâm không có lớp học nhóm, đặt sân theo giờ hay cửa hàng sản phẩm.
- Các mục trên Portal hội viên: 'Gói tập & Bảo lưu', 'Thẻ & Check-in', 'Giao dịch & Hóa đơn', 'Giáo án', 'Hồ sơ', 'Thông báo'.
- Chỉ hội viên có gói tập đang hoạt động và chưa hết hạn mới đặt PT 1:1, dùng quyền lợi gói và check-in được.

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

## Bảo lưu gói tập
Từ khóa: bao luu, tam dung, dong bang, hold, nghi tap, tam ngung
- Gửi yêu cầu tại 'Gói tập & Bảo lưu' > 'Bảo lưu'; lễ tân xét duyệt.
- Gửi trước ngày bắt đầu bảo lưu ít nhất {{hold.noticeHours}} giờ; mỗi lần tối thiểu {{hold.minDays}} ngày, tối đa theo hạng và thời hạn gói (xem mục Quyền lợi theo hạng gói).
- Đính kèm được tối đa {{hold.maxDocuments}} giấy tờ, mỗi file không quá {{hold.maxDocumentMb}} MB.
- Trong thời gian bảo lưu đã duyệt không đặt được PT 1:1.
- Khi duyệt, các buổi PT 1:1 rơi vào thời gian bảo lưu bị hủy: được trả lượt hoặc hoàn tiền nếu duyệt trước buổi tập ít nhất {{hold.ptRefundDays}} ngày. Muộn hơn thì mất lượt hoặc mất tiền. Tiền hoàn vào Ví SÖL.
- Lễ tân từ chối thì luôn ghi lý do, hội viên xem được trong thông báo và trang Bảo lưu.
- Hết thời gian bảo lưu, gói tự hoạt động lại và được cộng bù số ngày đã bảo lưu.

## Hủy gói và hoàn tiền
Từ khóa: huy goi, hoan tien, refund, tra lai tien, ngung goi
- Liên hệ quầy lễ tân để lập yêu cầu hủy gói; quản lý trung tâm xét duyệt.
- Số tiền hoàn đề xuất là phần chưa sử dụng của số tiền hội viên đã thực trả cho kỳ gói (gồm giá trị chuyển từ gói cũ khi nâng cấp), không tính theo giá niêm yết hiện tại; quản lý có thể điều chỉnh. Tiền hoàn vào Ví SÖL.

## Ví SÖL
Từ khóa: vi, nap tien, so du, wallet, vnpay, thanh toan
- Nạp ví qua VNPay trên Portal hoặc nạp tiền mặt tại quầy lễ tân.
- Ví dùng để thanh toán dịch vụ trên Portal; tiền hoàn khi hủy gói hoặc khi buổi PT 1:1 bị hủy được trả về ví.

## Hỗ trợ và khiếu nại
Từ khóa: ho tro, khieu nai, phan anh, le tan, lien he, ticket, gop y
- Gửi phiếu tại 'Tin nhắn' > 'Hỗ trợ & Khiếu nại' để lễ tân xử lý, hoặc nhắn trực tiếp cho lễ tân/HLV trong mục Tin nhắn.
