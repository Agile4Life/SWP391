# Phân công hoàn thiện tài liệu SCMS cho 5 người

Baseline eecc17a4 • 07/11/2026. 45 task, 147 giờ ước lượng, D1–D5 tương đối. Tài liệu và sơ đồ đã có bản nháp; bảng này giao review và hoàn thiện bản nộp.

| ID | Owner | Reviewer | Task | Hạn | Giờ | Phụ thuộc | Đầu ra | Nghiệm thu |
|---|---|---|---|---|---|---|---|---|
| DOC-TA-01 | Tài | Khoa | Xác nhận actors và RBAC | D1 | 3 |  | SRS 2.2 và ma trận quyền | 5 role seeded; tách Admin/Manager và alias legacy; đối chiếu route, filter, annotation, service |
| DOC-TA-02 | Tài | Thịnh | Rà UC auth và hồ sơ | D2 | 3 | DOC-TA-01 | FE-01 và SW auth | OTP/Google/KYC đúng code; trạng thái đăng ký không giả thành user row |
| DOC-TA-03 | Tài | Khoa | Rà hỗ trợ và escalation | D2 | 3 | DOC-TA-01 | FE-13; support swimlane/state | Manager chỉ ticket escalated; bỏ auto-close 72h không có writer |
| DOC-TA-04 | Tài | Thịnh | Rà chat và notification | D3 | 3 | DOC-TA-01 | FE-14/15; SW chat | Participant/send/seen và reaction cục bộ ở UI theo code; phân biệt in-app và mock adapters |
| DOC-TA-05 | Tài | Phong | Chốt BR IAM và security | D3 | 4 | DOC-TA-02,DOC-TA-03,DOC-TA-04 | Register BR IAM | Mỗi rule có source; tách BR/SEC/DI/OPEN; bỏ mô tả chưa reachable |
| DOC-TA-06 | Tài | An | Review state và flow nội bộ | D4 | 2 |  | FE-16 và state requests | PENDING/APPROVED/REJECTED/CANCELLED theo guards và ownership |
| DOC-TA-07 | Tài | Khoa | Review chéo screen flow quản trị | D4 | 3 | DOC-KH-02,DOC-KH-03 | SF staff coach manager admin | Không trao quyền chỉ dựa menu; phát hiện route alias và API deny |
| DOC-TA-08 | Tài | Phong | Hợp nhất business rule catalogue | D5 | 4 | DOC-AN-07,DOC-PH-06,DOC-TH-06 | SRS Business Rules | ID duy nhất; gộp trùng nghĩa có cross-reference; OPEN không bị coi thành policy đã chấp thuận |
| DOC-TA-09 | Tài | Thịnh | Smoke test auth support chat trên target nhóm | D5 | 3 | DOC-TA-05 | Evidence IAM | Ghi target/commit/kết quả; mask PII; chỉ đánh dấu pass khi có thực thi |
| DOC-AN-01 | An | Thịnh | Chốt feature membership và trial | D2 | 4 |  | FE-03/04; SW trial | KYC, dates inclusive, quoted price và trial duration discrepancy được ghi rõ |
| DOC-AN-02 | An | Phong | Rà hold resume cancellation | D2 | 4 | DOC-AN-01 | States membership/hold/cancel | Tách các state; staff tạo yêu cầu hủy; xác định revoke entitlement và credit ví |
| DOC-AN-03 | An | Khoa | Rà booking lớp và từng buổi | D2 | 4 |  | FE-05 và SW booking | Legacy và session riêng, capacity tổng, conflict, bulk skipped; không có hàng chờ runtime |
| DOC-AN-04 | An | Thịnh | Rà court booking | D3 | 3 | DOC-AN-01 | FE-06 và states courts | Đúng quota/slot/giá/cutoff; paymentStatus tách booking status |
| DOC-AN-05 | An | Khoa | Rà checkin attendance streak | D3 | 4 | DOC-AN-03 | FE-07 và states checkin | GRANTED/DENIED, visit timestamp, QR TTL, anti-passback, timezone, roster và quyền điểm danh |
| DOC-AN-06 | An | Phong | Rà facilities và trigger rules | D4 | 3 | DOC-AN-03 | FE-02; DI rules | Entity là nguồn schema; trigger capacity/conflict/entitlement giữ nguyên; không dùng DDL lịch sử |
| DOC-AN-07 | An | Tài | Chốt toàn bộ BR Operations | D4 | 4 | DOC-AN-02,DOC-AN-04,DOC-AN-05,DOC-AN-06 | Register BR OPS | Mỗi rule có evidence và phân loại; endpoint/service-only ghi riêng; không ép state enum thành transition |
| DOC-AN-08 | An | Khoa | Review ERD Operations | D4 | 2 | DOC-KH-04 | ERD membership scheduling attendance | FK/capacity và MapsId đúng; relationships không suy từ entity_id generic |
| DOC-AN-09 | An | Thịnh | Smoke test luồng Operations | D5 | 3 | DOC-AN-07 | Evidence Ops | Kiểm thử purchase→booking→checkin; negative hết hạn/full/conflict; ghi rõ target |
| DOC-PH-01 | Phong | An | Chốt payment VNPay và wallet | D2 | 4 |  | FE-10/11; finance swimlanes | IPN/verify-return, settlement/idempotency và refund paths khác nhau |
| DOC-PH-02 | Phong | Thịnh | Rà shop pricing stock expiry | D2 | 4 | DOC-PH-01 | FE-12 và shop states | Giá server, reserve/release, pickup/shipping, 48h runtime; gap24h ghi open |
| DOC-PH-03 | Phong | An | Rà coaching PT health AI | D3 | 4 |  | FE-08/09 và states | PT/current coach scope, metrics, plan writer; AI chat không mock fallback |
| DOC-PH-04 | Phong | Khoa | Chốt metric báo cáo và invoice | D3 | 3 | DOC-PH-01 | FE-17 report dictionary | Công thức/nguồn dữ liệu/đơn vị từ code; phân biệt invoice PDF hiện có và export không có |
| DOC-PH-05 | Phong | Khoa | Review ERD toàn hệ thống | D4 | 3 | DOC-KH-04 | ERD 59 mapping targets | 56 entity +2 join +1 collection; nullable unique sharedPK; PostgreSQL; không bịa FK tại scalar ID |
| DOC-PH-06 | Phong | Tài | Chốt BR Finance Shop Coaching AI | D4 | 4 | DOC-PH-02,DOC-PH-03,DOC-PH-04 | Register BR Finance và coaching | Source line chính xác; phân biệt code/config/provider thực; không khẳng định sandbox đang chạy |
| DOC-PH-07 | Phong | An | Kiểm tra mâu thuẫn code và tài liệu | D4 | 2 | DOC-PH-06,DOC-TA-05 | Appendix Open Issues | Quy tắc hiện hành theo code; tách desired decision khỏi as-built; gắn người quyết định |
| DOC-PH-08 | Phong | Tài | Smoke test sandbox hoặc ghi chưa chạy | D5 | 3 | DOC-PH-06 | Evidence Finance | Không giao dịch thật; test signature/idempotency/timeout và wallet; ghi config enabled/disabled |
| DOC-PH-09 | Phong | Khoa | Review kỹ thuật bản nộp | D5 | 2 | DOC-KH-09 | SRS release signoff | Các sơ đồ/state/BR/ERD khớp commit cuối; không đưa test cũ thành kết quả lần này |
| DOC-KH-01 | Khoa | Tài | Chốt index SRS và quy ước | D1 | 2 |  | SRS outline, revision, IDs | Bám mẫu Google Docs nhưng dùng SCMS; FE/UC/BR/UI/diagram ID nhất quán |
| DOC-KH-02 | Khoa | Tài | Rà screen flow Receptionist và Coach | D2 | 4 | DOC-KH-01 | SF staff và coach | Menu/page/modal/widget phân biệt; attendance path /staff là coach; có error/forbidden |
| DOC-KH-03 | Khoa | Tài | Rà screen flow Manager và Admin | D3 | 3 | DOC-KH-01 | SF manager admin | Manager không gộp admin; users/cancellations redirects không là màn hình riêng |
| DOC-KH-04 | Khoa | Phong | Đối chiếu ERD với JPA | D3 | 6 | DOC-KH-01 | 7 module ERD và overview | 59 mapping targets; PK/FK/cardinality/nullability/unique và annotation evidence đầy đủ |
| DOC-KH-05 | Khoa | An | Rà data dictionary | D4 | 4 | DOC-KH-04 | Data dictionary | Cột có kiểu Java/JPA và constraint đúng; inverse relation không tạo cột; chưa introspect DB ghi rõ |
| DOC-KH-06 | Khoa | Phong | Rà staff shop và reports UI | D4 | 3 | DOC-KH-03 | FE-12/17 staff flow | Fulfillment transition chính xác; màn chart/report không giả định export Excel |
| DOC-KH-07 | Khoa | Thịnh | Rà master swimlane và coverage | D4 | 2 | DOC-AN-07,DOC-PH-06,DOC-TA-05 | Master diagram và gap matrix | Actor đúng, hệ thống ngoài đúng, không giữ feature lịch sử thiếu code |
| DOC-KH-08 | Khoa | Tài | Hợp nhất SRS và phụ lục | D5 | 3 | DOC-TH-07,DOC-TA-08,DOC-KH-05 | DOCX cuối, figures, task sheet | Heading/caption/table/source links khớp, sơ đồ đọc được, không thiếu section yêu cầu |
| DOC-KH-09 | Khoa | Phong | Đóng gói bản nộp | D5 | 3 | DOC-KH-08,DOC-AN-09,DOC-TA-09,DOC-TH-09 | SRS baseline và source diagrams | Render/kiểm tra mọi trang; cập nhật revision; issue chưa đóng được ghi rõ; có reviewer signoff |
| DOC-TH-01 | Thịnh | Tài | Rà màn public và auth entry | D2 | 3 |  | SF public | Landing/sports/trainers/shop/login, purchase returnTo và cart; OTP là flow/modal nếu không route riêng |
| DOC-TH-02 | Thịnh | An | Rà screen flow Member | D2 | 4 | DOC-TH-01 | SF member | Packages/courts/classes/progress/card/checkin/streak/support/orders; ví và AI là overlay |
| DOC-TH-03 | Thịnh | Phong | Rà mua hàng từ public đến order | D3 | 3 | DOC-TH-01 | FE-12 member flow | Quote/địa chỉ/variant/payment/expiry/hủy; member không cần subscription active |
| DOC-TH-04 | Thịnh | Khoa | Rà conceptual model | D3 | 4 |  | Conceptual overall và commerce detail | Tên nghiệp vụ/cardinality; không cột kỹ thuật; entity SportsCenter không xuất hiện nếu code không có |
| DOC-TH-05 | Thịnh | Khoa | Chốt MVP theo code | D3 | 3 | DOC-TH-02,DOC-TH-03 | Feature scope matrix | Phân loại routed/API-only/legacy/config-dependent; không dùng backlog checkbox làm bằng chứng chạy |
| DOC-TH-06 | Thịnh | Phong | Review BR shop và UI constraints | D4 | 3 | DOC-PH-02 | Register shop/UI | DESIGN vs code được ghi thành issue; chỉ constraint backend thành BR khi có source |
| DOC-TH-07 | Thịnh | Tài | Chốt feature và screen catalogue | D4 | 4 | DOC-TH-05,DOC-KH-02,DOC-KH-03 | SRS Features và UI catalogue | Mỗi feature có actor/trigger/pre/post/main/exception và linked diagram/BR; alias phân biệt |
| DOC-TH-08 | Thịnh | An | Review diagrams từ góc người dùng | D4 | 2 | DOC-TH-07 | Diagram feedback | Nhánh lỗi/hủy đầy đủ; state không trộn page status; chữ không quá nhỏ |
| DOC-TH-09 | Thịnh | Khoa | Demo tuyến public member | D5 | 3 | DOC-TH-08 | Evidence UI | Ghi commit/target và screenshot đã ẩn PII; loading/empty/error/forbidden và role navigation |
