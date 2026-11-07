# Bộ tài liệu SCMS theo mã nguồn hiện tại

Baseline: eecc17a4. Ngày khảo sát: 07/11/2026.

Mở SCMS_SRS.html để đọc và cuộn/zoom sơ đồ, hoặc mở DOCX để biên tập bản nộp. SCMS_Task_Sheet_5_nguoi.xlsx có bảng giao việc 5 người, features, diagram gaps, rules, screens, data model, dictionary, diagrams và open issues. Mermaid và SVG trong diagrams/ dùng để chỉnh sửa/đưa vào báo cáo; các PNG là bản raster dùng trong DOCX.

Phạm vi: 18 nhóm feature, 49 sơ đồ (17 swimlane, 16 state, 7 ERD, 6 screen flow, 2 conceptual, 1 context), 61 route declarations (có alias/redirect), 56 Entity + 2 JoinTable + 1 CollectionTable = 59 bảng đích ORM. Dictionary có 548 cột đã gộp alias. 277 mục quy tắc/phát hiện gồm 224 BR, 20 DI, 10 SEC và 23 OPEN.

Nguồn là code hiện tại, không phải 33 bảng SQL Server trong các sơ đồ cũ. Chưa introspect DB, chạy ứng dụng, kiểm tra deployment/config, test E2E hay tạo giao dịch trong đợt lập tài liệu. Cấu trúc tham khảo mẫu SRS Google Docs do người dùng cung cấp; chỉ xuất các phần được yêu cầu và kế hoạch review, không tự tạo cam kết NFR chưa được đo.

45 task là workload review/hoàn thiện hồ sơ, không là 45 feature còn thiếu. D1–D5 là lịch tương đối; 147 giờ là ước lượng, không phải giờ thực tế. Tên thành viên: Tài, An, Phong, Khoa, Thịnh.
