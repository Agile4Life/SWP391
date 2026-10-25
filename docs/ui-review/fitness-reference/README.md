# SÖL Fitness — UI công khai đã triển khai cục bộ

Phạm vi đã thống nhất: toàn bộ trang công khai (`/`, `/login`, `/register`, bước OTP). Portal dùng giao diện và luồng hiện có.

Quy chuẩn thiết kế chính dành cho các agent tiếp theo: [DESIGN.md](../../../DESIGN.md), được tham chiếu từ `AGENTS.md`. Báo cáo này lưu đối chiếu và kiểm chứng, không thay thế quy chuẩn chính.

Cập nhật theo yêu cầu tiếp theo: các trang công khai phủ kín chiều rộng viewport, bỏ viền salmon/padding ngoài và giới hạn canvas 1500px. Nội dung vẫn giữ khoảng cách bên trong để đọc và thao tác. Scrollbar dùng thumb salmon trên track than đậm; theme chỉ áp dụng khi layout công khai hiện diện.

Quyết định chuyển động cuối cùng: giữ cuộn dọc native, bỏ ý tưởng slide trang ngang–dọc. Hero, heading, card và form có animation xuất hiện; các card stagger, replay khi quay vào viewport ở cả hai chiều cuộn và chỉ reset sau khi rời hoàn toàn màn hình; đổi ảnh/nhóm HLV có fade. Reduced motion và môi trường không có IntersectionObserver hiển thị nội dung đầy đủ.

Áp dụng cùng quy tắc cho các component mới: chỉ số CLB, lịch lớp, các bước tham gia, BMI, FAQ và phần hướng dẫn nhóm cơ trong hero. Thẻ sau khi lọc lịch lớp được đăng ký tự động; câu trả lời FAQ có fade + nâng trong 320ms mỗi lần mở. Focus giữ chuyển động vị trí liên tục để không làm nút nhảy khỏi con trỏ khi bấm lúc reveal đang chạy.

## Cơ sở đối chiếu

- Ảnh tổng quan do người dùng cung cấp: hai bản website đặt chồng trên nền salmon. Khung trước cho thấy header, hero, dịch vụ và câu chuyện hội viên. Khung sau cho thấy trainer, không gian tập và bảng gói.
- Ảnh cận cảnh bổ sung: ba thẻ WeightLifting / Private Training / Build Muscle. Ảnh này là chuẩn ưu tiên cho cụm dịch vụ.
- Các phần bị che và chữ quá nhỏ không được xem là đã biết chính xác. Thứ tự của các phần trong trang chạy liên tục là cách ghép từ những vùng nhìn thấy trong mockup.

## Phân tích từng thành phần

| Thành phần | Chi tiết nhìn thấy trong mẫu | Cách dựng trong bản mới | Độ khớp ước lượng |
| --- | --- | --- | --- |
| Nền và khung | Nền hồng đất, canvas than đậm, chữ trắng ngà; hai khung có bóng đổ | Salmon `#ce9180`, charcoal `#202020`, trắng `#faf9f6`; canvas phủ kín trang theo yêu cầu cập nhật, không còn viền salmon ngoài | Giữ bảng màu; cách trình bày đã chuyển sang full width theo yêu cầu |
| Header | Wordmark nhỏ bên trái, menu giữa, nút trắng nhỏ bên phải | Giữ thương hiệu SÖL; menu anchor và nút đăng nhập/portal; menu thu gọn trên điện thoại | 85–90% |
| Hero — tiêu đề | BUILD YOUR bên trái, BODY SHAPES bên phải; chữ in hoa, đậm và giãn nhẹ | Cùng câu chữ và bố cục hai vế trên desktop; thu thành hai dòng trên mobile | 85–90% |
| Hero — nhân vật | Người đàn ông ngồi cầm tạ, quần tối, giày xanh, ảnh tách nền nằm giữa | Ảnh mới được tạo và tách nền; giữ mô típ ngồi cầm tạ nhưng nhân vật, chân và hướng đầu khác | 75–85% |
| Hero — phụ trợ | Mô tả ngắn bên trái, ba avatar chồng nhau, nút trắng có vòng tròn salmon; nét hình học rất mảnh | Đủ mô tả, avatar, nút pill/mũi tên và đường nét trang trí; nội dung tiếng Việt | 85–90% |
| Dịch vụ — silhouette | Thẻ giữa rộng/cao hơn; hai thẻ ngoài có mép trên xiên, đáy gần ngang; thân thu vào; góc bo lớn | Ba đường SVG riêng làm bề mặt, chữ giữ ngang; tỷ lệ cột `1 / 1.2 / 1`; thẻ giữa cao hơn 35px | 90–95% |
| Dịch vụ — icon | Người nâng tạ, hai tạ bắt chéo, bắp tay có biểu tượng tim; nét nâu, màu kem và hồng | Icon SVG riêng, tô nhiều màu và thống nhất nét; không dùng thư viện icon mới | 85–90% |
| Dịch vụ — chữ | Tiêu đề trắng, đường kẻ trắng mảnh bên dưới; mô tả nhỏ căn giữa 3–4 dòng | Giữ cấu trúc; bỏ nhãn phụ và nút từng xuất hiện trong bản đầu; dùng nội dung tiếng Việt thay lorem ipsum | 90–95% về cấu trúc; nội dung và ngắt dòng khác |
| Dịch vụ — ánh sáng | Một vùng sáng trắng xám mờ kéo dài phía sau ba thẻ | Radial gradient mờ, không dùng ảnh nền bổ sung | 85–90% |
| Câu chuyện hội viên | Tiêu đề hai dòng, bốn ảnh liền hàng; tên và sao đặt trên chân ảnh; phần dưới tối | Bốn cột, overlay tối, tên, sao, trích dẫn. Có chú thích minh họa để phân biệt với đánh giá thật | 75–85%; ảnh và nội dung khác |
| Huấn luyện viên | Tiêu đề bên trái, hai portrait bo rất lớn bên phải, một thẻ lớn hơn; gradient salmon ở đáy và thanh điều khiển | Hai portrait tạo mới cùng ánh sáng, dáng khoanh tay; kích thước lệch, overlay salmon và chuyển nhóm hoạt động | 85–90%; không có danh tính/ảnh gốc |
| Không gian tập | Ảnh gym bo góc; ảnh lớn có bóng tối, thumbnail pill phía dưới | Ảnh gym lưu cục bộ, overlay, ba thumbnail có thể chuyển ảnh. Thumbnail dùng để đổi ảnh, không giả lập video | 80–85% |
| Gói tập | Tiêu đề lớn giữa trang, switch pill, thẻ tối xen thẻ salmon; nhãn thời hạn trắng, giá đậm, checklist, CTA nhỏ | Ba thẻ, gói giữa salmon, switch lọc thời hạn; giữ các mức giá giới thiệu trước đó của SÖL và ghi rõ giá tham khảo | 85–90% về component; đơn vị, số tiền và nội dung khác mẫu |
| Đăng nhập | Không xuất hiện trong ảnh nguồn | Thiết kế tiếp theo cùng bộ màu: nội dung/ảnh bên trái, form tối bên phải, nút salmon. Giữ tài khoản đang đăng nhập, Google OAuth, lỗi và trạng thái chờ | Không chấm phần trăm sao chép; đánh giá theo độ nhất quán |
| Đăng ký / OTP | Không xuất hiện trong ảnh nguồn | Dùng cùng layout; giữ kiểm tra email/điện thoại/mật khẩu, gửi OTP, xác thực, đếm ngược gửi lại, thông báo lỗi và thành công | Không chấm phần trăm sao chép; đánh giá theo độ nhất quán |
| CTA cuối trang / footer | Không nhìn thấy đầy đủ trong mẫu | Hoàn thiện bằng cùng màu, chữ và nút; dùng thông tin liên hệ hiện có trong dự án | Phần thiết kế tiếp nối, không tính là chi tiết sao chép |

**Ước lượng thị giác tổng thể: khoảng 85%.** Riêng cụm dịch vụ sau ảnh cận cảnh: khoảng 90–95% về bố cục và hình thẻ. Đây là đánh giá thủ công dựa trên những vùng nhìn thấy, không phải kết quả pixel-diff hoặc phép đo tự động. Không có ảnh nguồn cùng viewport để tính tỷ lệ pixel tương đồng có ý nghĩa.

## Ảnh để duyệt

- [Hero desktop](hero-desktop.png), [toàn bộ landing desktop](landing-desktop.png).
- [Hero trên màn hình rộng 1920px](hero-wide.png).
- [Cụm dịch vụ desktop](services-desktop.png), [cụm dịch vụ mobile](services-mobile.png).
- [Landing mobile](landing-mobile.png).
- [Đăng nhập desktop](login-desktop.png), [đăng nhập mobile](login-mobile.png), [trạng thái lỗi](login-error-desktop.png).
- [Đăng ký desktop](register-desktop.png), [đăng ký mobile](register-mobile.png).
- [OTP desktop](otp-desktop.png), [OTP mobile](otp-mobile.png).
- [UI trước khi thay đổi](before-desktop.png).

Xem bản chạy: `http://localhost:5173/`, `/login`, `/register` khi Vite đang mở.

## Kiểm tra

- Production build: chạy `npm --prefix apps/web run build`.
- Lint: chạy `npm --prefix apps/web run lint`.
- Test frontend: chạy `npm --prefix apps/web run test`.
- Browser: `scripts/verify-public-ui.cjs`, cần Playwright có trong môi trường và Vite đang chạy. Nếu dùng bản Playwright cài global trên PowerShell: `$env:NODE_PATH = npm root -g; node scripts/verify-public-ui.cjs`.
- Animation: `scripts/verify-public-animation.cjs`, kiểm tra khi animation bật, replay hai chiều, không nhấp nháy khi còn một phần component trên màn hình, chuyển nội dung, đăng ký thẻ mới sau khi lọc, stagger, nhập BMI, mở/đóng FAQ nhiều lần, tương tác form, mobile, thay đổi reduced motion khi đang chạy và fallback khi không có IntersectionObserver. Kiểm tra các section mới được thực hiện khi section đã có trong trang.
- Browser kiểm tra landing ở 320 / 375 / 390 / 768 / 1024 / 1440 / 1920 / 2560px; auth ở mobile, tablet và desktop. Xác nhận canvas chạm hai mép viewport, không có padding ngoài, không tràn ngang, scrollbar dùng đúng màu, document theme không áp dụng ngoài layout công khai. Kiểm tra thêm chuyển trainer, gallery, lọc gói; menu mobile; hiện mật khẩu; lỗi đăng nhập; đăng ký → OTP; đếm ngược và lỗi OTP.
- Các request auth trong browser check được chặn bằng response giả lập. Kết quả này xác nhận UI và payload gửi đi, không xác nhận email/OTP hoặc Google OAuth end-to-end với backend thật.
- [Kết quả browser](browser-verification.json).

Kết quả kiểm tra ngày 22/10/2026: build và lint thành công; 28 file test / 195 test qua; browser UI và animation check qua, không có lỗi JavaScript chưa xử lý. Build vẫn có cảnh báo bundle JavaScript lớn hơn 500kB do ứng dụng đóng gói chung các route. Ba PNG tạo mới khoảng 2MB/ảnh; ảnh dưới hero dùng lazy loading. Bản này chưa xử lý tối ưu bundle hoặc chuyển đổi định dạng ảnh.

## Ảnh và nguồn

Tất cả asset dùng trong trang nằm ở `apps/web/public/images/fitness/`. Không thêm package frontend mới.
Prompt đầy đủ và chế độ tạo/chỉnh ảnh: [image-prompts.md](image-prompts.md).

- `hero-athlete.png`: built-in imagegen, prompt tạo vận động viên trưởng thành ngồi cầm tạ đơn, quần đen/giày xanh; chỉnh tiếp bằng background-extraction để có alpha trong suốt.
- `coach-strength.png`: built-in imagegen, prompt portrait nam HLV áo charcoal, khoanh tay, nền xám, ánh sáng studio ấm.
- `coach-movement.png`: built-in imagegen, prompt portrait nữ HLV áo charcoal, khoanh tay, cùng nền/ánh sáng.
- `gym-floor.jpg`: Unsplash `photo-1534438327276-14e5300c3a48`.
- `trainer-strength.jpg`: Unsplash `photo-1534368270820-9de3d8053204`.
- `strength-session.jpg`: Unsplash `photo-1583454110551-21f2fa2afe61`.
- Ảnh studio Pilates dùng lại asset sẵn có của dự án.

Ảnh và câu chuyện là minh họa cho bản dựng. Các gói hiện hành và quyền lợi thực tế vẫn do portal/backend quản lý.

## Các mốc commit và cách hoàn tác

Theo yêu cầu chia commit để dễ quay lại, thay đổi được lưu theo các phần:

| Commit | Phần thay đổi | Phụ thuộc |
| --- | --- | --- |
| `86f1b84` | Sáu ảnh fitness dùng trong trang công khai | Không đổi UI đang chạy |
| `373f4b4` | Layout chung, landing và style charcoal–salmon | Cần commit ảnh trước đó |
| `a04eeaa` | Giao diện đăng nhập, đăng ký và OTP | Cần layout từ commit landing |
| `test(web): document and verify public UI redesign` | Script browser, ảnh chụp, báo cáo và hướng dẫn này | Kiểm chứng bản UI đầy đủ |
| `fix(web): fill public viewport and theme scrollbars` | Bỏ khung ngoài, phủ kín trang, scrollbar theo palette; kiểm tra đến 2560px và cập nhật ảnh | Mở rộng bản UI đầy đủ |
| `b9fadb9` | Animation xuất hiện ban đầu cho component công khai | Cần layout công khai |
| `44da88d` | Replay hai chiều, đăng ký component mới, stagger và FAQ, sửa focus khi đang reveal | Cần animation ban đầu; không gồm nội dung/layout các section được bổ sung song song |

Mốc trước thay đổi UI: `0182b12`. Các commit chỉ gồm file UI/ảnh/tài liệu của tác vụ này; thay đổi backend đang có trong workspace không được đưa vào.

Hoàn tác riêng màn hình tài khoản, giữ landing mới:

```sh
git revert a04eeaa
```

Quay về giao diện trước khi đổi, giữ ảnh và tài liệu tham chiếu:

```sh
git revert a04eeaa 373f4b4
```

Hai lệnh trên là hai lựa chọn thay thế nhau, áp dụng từ mốc `b8bc3ac`; không chạy liên tiếp cả hai. Nếu đã có các commit chỉnh giao diện tiếp theo, hoàn tác các commit đó trước. Riêng thay đổi full width/scrollbar có commit riêng để hoàn tác độc lập. Ở commit landing, hai trang tài khoản cũ có import CSS riêng nên vẫn hiển thị đầy đủ khi chỉ hoàn tác commit auth. Dùng `git revert` tạo commit hoàn tác và giữ nguyên lịch sử.

## Liên hệ backlog

Backlog hiện có owner đăng nhập: Khoa; đăng ký/OTP: Thịnh. Luồng Google OAuth thuộc SCRUM-89. Không tìm thấy Jira key riêng cho yêu cầu clone landing trong backlog cục bộ; không tự gán ticket hoặc thay acceptance criteria của các ticket nghiệp vụ.
