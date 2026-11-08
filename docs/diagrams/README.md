# THƯ MỤC SƠ ĐỒ HỆ THỐNG (SYSTEM DIAGRAMS)

Thư mục này lưu trữ toàn bộ các sơ đồ kiến trúc, cơ sở dữ liệu, quy trình nghiệp vụ (swimlane flows) và máy trạng thái (state machines) của dự án **Sports Center Management System (SCMS)**.

---

## 1. Danh Mục Sơ Đồ CSDL & Thực Thể (ERD & Data Models)

| Tên tập tin | Định dạng | Mô tả chi tiết |
|---|:---:|---|
| [`erd_sports_center.drawio`](erd_sports_center.drawio) | Draw.io XML | **ERD tổng thể 33 bảng** phân chia theo 6 tabs module chức năng có mã màu nhận diện trực quan. |
| [`erd_complete_all_relationships.drawio`](erd_complete_all_relationships.drawio) | Draw.io XML | **ERD đầy đủ quan hệ**: Thể hiện toàn bộ 54 đường liên kết khóa ngoại (Foreign Keys), thuộc tính và kiểu dữ liệu chuẩn T-SQL. |
| [`erd_chen_notation.drawio`](erd_chen_notation.drawio) | Draw.io XML | **ERD ký pháp Chen**: Trực quan hóa các tập thực thể (Entities), thuộc tính (Attributes) và mối kết hợp (Relationships). |
| [`erd_logical_noAttribute.drawio`](erd_logical_noAttribute.drawio) | Draw.io XML | **Mô hình logic rút gọn**: Tập trung vào quan hệ giữa các thực thể mà không hiển thị chi tiết thuộc tính. |
| [`sports_center_logical_model.drawio`](sports_center_logical_model.drawio) | Draw.io XML | **Mô hình dữ liệu logic tổng quan** của toàn bộ trung tâm thể thao. |

---

## 2. Danh Mục Sơ Đồ Quy Trình Nghiệp Vụ (Swimlane & Flows)

| Tên tập tin | Định dạng | Mô tả chi tiết |
|---|:---:|---|
| [`screen_flow_diagram.drawio`](screen_flow_diagram.drawio) | Draw.io XML | **Sơ đồ luồng màn hình (Screen Flow Diagram - 7 tabs)**: Chia tách tinh gọn theo phân hệ (Tổng quan điều hướng, Public/Cửa hàng/Auth, Hội viên - Mua gói & Tập luyện, Hội viên - Mua sắm & Hỗ trợ, Lễ tân, Huấn luyện viên, Quản lý & Admin) kèm liên kết chuyển trang (`data:page/id`). |
| [`sports_center_all_flows_swimlane.drawio`](sports_center_all_flows_swimlane.drawio) | Draw.io XML | **Sơ đồ phân làn Swimlane đầy đủ (7 tabs)**: Gồm Master Swimlane và 6 luồng nghiệp vụ chi tiết (Đăng ký/Mua gói, Đặt lịch/Hủy lớp, Check-in/Điểm danh, AI Coaching & Tập luyện, Hỗ trợ & Đổi ca, Báo cáo & Quyết toán). |
| [`sports_center_main_flow_swimlane.drawio`](sports_center_main_flow_swimlane.drawio) | Draw.io XML | **Sơ đồ phân làn luồng chính**: Tương tác giữa 6 Actor (Member, Receptionist, Coach, Center Manager, AI Engine, System Core). |
| [`sports_center_flow.drawio`](sports_center_flow.drawio) | Draw.io XML | **Sơ đồ quy trình nghiệp vụ nguyên bản** kết hợp các bước thao tác người dùng. |

---

## 3. Danh Mục Sơ Đồ Máy Trạng Thái (State Machine Diagrams)

| Tên tập tin | Định dạng | Mô tả chi tiết |
|---|:---:|---|
| [`state_diagrams.drawio`](state_diagrams.drawio) | Draw.io XML | **12 biểu đồ trạng thái UML chuẩn** cho các thực thể quan trọng nhất: `users`, `membership_subscriptions`, `class_enrollments`, `class_sessions`, `payments`, `support_requests`, `training_plans`, `center_checkins`, `session_attendance`, `notifications`, `ai_chat_sessions`, `class_waitlists`. |
| [`StateDiagram.drawio`](StateDiagram.drawio) | Draw.io XML | Bản phác thảo trạng thái mở rộng. |

---

## 4. Ảnh Chụp Minh Chứng Kết Xuất (Screenshots)

Thư mục [`screenshots/`](screenshots/) chứa các ảnh PNG kết xuất độ phân giải cao phục vụ báo cáo và kiểm tra nhanh:
- `page_1.png` - Trạng thái: Tài khoản người dùng (`users`)
- `page_1_user_account.png` - Trạng thái chi tiết tài khoản
- `page_2.png` - Trạng thái: Gói hội viên (`membership_subscriptions`)
- `page_3.png` - Trạng thái: Đăng ký lớp học (`class_enrollments`)
- `page_4.png` - Trạng thái: Buổi học (`class_sessions`)
- `page_5.png` - Trạng thái: Giao dịch thanh toán (`payments`)
- `page_6.png` - Trạng thái: Yêu cầu hỗ trợ (`support_requests`)
- `page_7.png` - Trạng thái: Kế hoạch tập luyện (`training_plans`)
- `page_8.png` - Trạng thái: Check-in trung tâm (`center_checkins`)
- `page_9.png` - Trạng thái: Điểm danh buổi học (`session_attendance`)
- `page_10.png` - Trạng thái: Thông báo hệ thống (`notifications`)
- `page_11.png` - Trạng thái: Phiên trò chuyện AI (`ai_chat_sessions`)
- `page_12.png` - Trạng thái: Hàng chờ lớp học (`class_waitlists`)

---

## 5. Công Cụ Tự Động Hóa (Automation Scripts)

- [`build_screen_flow_diagram.py`](build_screen_flow_diagram.py): Script Python (theo chuẩn `drawio-skill`) tự động sinh file [`screen_flow_diagram.drawio`](screen_flow_diagram.drawio) gồm 7 tabs phân hệ.
  ```bash
  # Cách chạy tái tạo sơ đồ luồng màn hình:
  python3 docs/diagrams/build_screen_flow_diagram.py
  ```
- [`build_state_diagrams.js`](build_state_diagrams.js): Script Node.js tự động tạo file `state_diagrams.drawio` và kết xuất ra ảnh PNG tại `screenshots/` bằng draw.io CLI.
  ```bash
  # Cách chạy tái tạo sơ đồ và ảnh:
  node diagrams/build_state_diagrams.js
  ```
