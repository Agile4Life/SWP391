<div align="center">

# 🏛️ SÖL Wellness Sanctuary — Sports Center Management System (SCMS)

[![CI/CD VPS and Vercel + Render one workflow only](https://github.com/Agile4Life/SWP391/actions/workflows/pipeline.yml/badge.svg)](https://github.com/Agile4Life/SWP391/actions/workflows/pipeline.yml)
![Java 21](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)
![Spring Boot 3](https://img.shields.io/badge/Spring_Boot-3.x-6DB33F?logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=black)
![Supabase PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=black)
![Docker Compose](https://img.shields.io/badge/VPS-Docker_Compose-2496ED?logo=docker&logoColor=white)

**Nền tảng vận hành trung tâm Gym — SWP391 Monorepo**

*Gói hội viên · PT 1:1 & giáo án · Check-in QR động · Bảo lưu có giấy tờ · Ví & hóa đơn · Báo cáo doanh thu*

<br />

<img src="docs/readme/landing-hero-dark.png" alt="Trang chủ SÖL Fitness" width="100%" />

<sub>Trang chủ công khai — giao diện tối charcoal–bạc với điểm nhấn salmon</sub>

[Giới thiệu](#-giới-thiệu) · [Tính năng](#-tính-năng-theo-vai-trò) · [Giao diện](#️-giao-diện) · [Kiến trúc](#️-kiến-trúc) · [CI/CD](#-cicd--một-workflow-hai-đường-deploy) · [Chạy local](#-chạy-local) · [Tài liệu](#-tài-liệu)

</div>

---

## ✨ Giới thiệu

**SCMS** là hệ thống vận hành cho trung tâm Gym, gồm ba phần. Từ 22/11/2026 phạm vi chỉ còn Gym: lớp học nhóm, đặt sân, cửa hàng, thiết bị, đánh giá HLV, chỉ số cơ thể, tiến độ và streak đã ngừng ([BUSINESS_FLOWS.md](docs/BUSINESS_FLOWS.md)).

- **Web portal nhiều vai trò** — React + Vite + TypeScript (`apps/web`), song ngữ Việt/Anh, hai giao diện sáng/tối.
- **REST API** — Spring Boot 3, Java 21 (`apps/api`), kiến trúc ba lớp theo package-by-feature, JWT, i18n qua `Accept-Language`.
- **Cơ sở dữ liệu PostgreSQL** — Hibernate Code-First (`ddl-auto: update`) cùng trigger PostgreSQL bảo vệ ràng buộc nghiệp vụ (trùng lịch PT/HLV, gói còn hạn).

| Bạn cần | Xem ở |
| :--- | :--- |
| Nghiệp vụ đang chạy | [BUSINESS_FLOWS.md](docs/BUSINESS_FLOWS.md) (thiết kế gốc: [PROJECT_MASTER_GUIDE.md](docs/PROJECT_MASTER_GUIDE.md)) |
| Quy tắc gói tập, khóa học, bảo lưu, điểm danh | [Business rules](docs/specs/2026-11-10-membership-and-attendance-business-rules.md) |
| Hợp đồng API (OpenAPI) | [docs/api-contracts](docs/api-contracts) |
| Quy chuẩn thiết kế giao diện | [DESIGN.md](DESIGN.md) |
| Tài khoản demo | [DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md) |

---

## 🎯 Tính năng theo vai trò

| Vai trò | Việc chính |
| :--- | :--- |
| 🧑‍🤝‍🧑 **Hội viên** | Mua, gia hạn, nâng cấp gói · đặt, hủy, thanh toán PT 1:1 · xem giáo án · thẻ hội viên với QR đổi mỗi 60 giây · xin bảo lưu kèm giấy tờ y tế · khám phá cơ sở 3D · nhắn tin với HLV và trợ lý AI |
| 🛎️ **Lễ tân** | Quầy POS, thu tiền gói và buổi PT · duyệt hồ sơ định danh (KYC) và bảo lưu · mã QR cổng check-in · hỗ trợ và đơn từ nội bộ |
| 🏋️ **Huấn luyện viên** | Lịch PT 1:1 theo tuần · điểm danh PT · giáo án (có AI gợi ý) · theo dõi học viên phụ trách |
| 📊 **Quản lý trung tâm** | Danh mục gói, Phòng Gym Tiêu chuẩn, bộ môn Gym · phân công và sắp xếp HLV · báo cáo doanh thu · duyệt hủy gói & hoàn tiền · tài khoản nhân sự |
| 🔐 **Quản trị hệ thống** | Tài khoản và phân quyền |

### Gói hội viên

| | Silver | Gold | Platinum | Trial 3 ngày |
| :--- | :---: | :---: | :---: | :---: |
| Giá 1 tháng / 3 tháng | 199k / 549k | 299k / 799k | 599k / 1.599k | 0đ |
| PT 1:1 mỗi 30 ngày | 0 | 3 | 6 | 1 |
| Giảm giá PT thêm | – | 10% | 20% | – |
| Bảo lưu (chỉ gói 3 tháng, Platinum 1 tháng) | 7 ngày | 15 ngày | 30 ngày (1 tháng: 7) | – |

<details>
<summary><b>Quy tắc cần nhớ</b></summary>

- **Chu kỳ quyền lợi** là 30 ngày tính từ ngày bắt đầu gói; nâng cấp tiếp tục chu kỳ cũ, ngày bảo lưu không tính vào chu kỳ. Lượt không cộng dồn.
- **PT 1:1** đặt trước ít nhất 2 giờ, tối đa 2 buổi chưa trả; hủy trước giờ tập thì trả lượt hoặc hoàn tiền vào Ví.
- **Điểm danh PT:** HLV đánh dấu tay; quét cổng không tự ghi có mặt, màn HLV chỉ hiện tag "Đã check-in". Lượt vào quên checkout tự đóng sau 8 giờ.
- **Bảo lưu:** tối thiểu 3 ngày, nộp trước 24 giờ (giấy tờ không bắt buộc), mỗi gói một lần; buổi PT trong kỳ bảo lưu bị hủy, duyệt sớm ≥ 3 ngày thì được trả lượt/hoàn tiền.
- **Định danh:** hồ sơ CCCD/hộ chiếu cần lễ tân duyệt trước khi mua gói đầu tiên; số giấy tờ lưu dạng mã hóa.
- **Chỉ Member có gói `active` và chưa hết hạn** mới được đặt PT và check-in.

</details>

---

## 🖥️ Giao diện

Mọi màn hình đều có hai chế độ: **Light — charcoal & salmon**, **Dark — charcoal & bạc**. Font Plus Jakarta Sans, sidebar icon, dashboard bốn cột. Quy chuẩn chi tiết ở [DESIGN.md](DESIGN.md).

### 1. Trang công khai

| Đăng nhập — Light (`/login`) | Đăng nhập — Dark |
| :---: | :---: |
| <img src="docs/readme/login-light.png" alt="Đăng nhập giao diện sáng" width="100%" /> | <img src="docs/readme/login-dark.png" alt="Đăng nhập giao diện tối" width="100%" /> |
| Đăng nhập bằng email/mật khẩu hoặc Google, chuyển ngôn ngữ ở footer | Cùng bố cục, nút chính đổi sang tông bạc |

### 2. Hội viên (`/member/*`)

<p align="center">
  <img src="docs/readme/member-dashboard-light.png" alt="Tổng quan hội viên" width="100%" />
  <br />
  <sub><b>Tổng quan</b> — bốn cột: gói đang dùng và số ngày còn lại · lịch PT đã đặt · thẻ & thanh toán · hồ sơ hội viên (ảnh chụp trước 22/11/2026)</sub>
</p>

| 💳 Gói tập (`/member/packages`) | 📅 Lịch PT 1:1 (`/member/classes`) |
| :---: | :---: |
| <img src="docs/readme/member-packages-light.png" alt="Gói tập" width="100%" /> | <img src="docs/readme/member-schedule-light.png" alt="Lịch PT" width="100%" /> |
| Gói hiện tại, so sánh Silver/Gold/Platinum, tab bảo lưu | Lịch của tôi và tab đặt HLV 1:1 (ảnh chụp trước khi bỏ lớp nhóm) |
| 🪪 **Thẻ hội viên & QR** (`/member/card`) | |
| <img src="docs/readme/member-card-dark.png" alt="Thẻ hội viên QR" width="100%" /> | |
| QR động đổi mỗi 60 giây, tải thẻ về máy | |
| 🧭 **Khám phá cơ sở 3D** (`/member/explore`) | 💬 **Tin nhắn & trợ lý AI** |
| <img src="docs/readme/member-explore-3d-light.png" alt="Bản đồ 3D" width="100%" /> | <img src="docs/readme/member-chat-light.png" alt="Tin nhắn" width="100%" /> |
| Mô hình tòa nhà theo tầng, cắt tường, tham quan có hướng dẫn | Chat với huấn luyện viên và SÖL AI ngay trong portal |

### 3. Lễ tân (`/staff/*`)

<p align="center">
  <img src="docs/readme/staff-reception-dark.png" alt="Quầy lễ tân" width="100%" />
  <br />
  <sub><b>Quầy lễ tân & POS</b> — QR cổng tự làm mới, tra cứu hội viên theo SĐT/mã/CCCD, xác nhận gói chờ thanh toán, lịch sử xử lý</sub>
</p>

### 4. Huấn luyện viên (`/coach/*`)

<p align="center">
  <img src="docs/readme/coach-schedule-light.png" alt="Lịch dạy huấn luyện viên" width="100%" />
  <br />
  <sub><b>Lịch PT & học viên</b> (`/coach/classes`) — thời khóa biểu PT 1:1 theo tuần và học viên phụ trách (ảnh chụp trước khi bỏ lớp nhóm và đánh giá)</sub>
</p>

### 5. Quản lý trung tâm (`/manager/*`)

<p align="center">
  <img src="docs/readme/manager-reports-light.png" alt="Báo cáo doanh thu" width="100%" />
  <br />
  <sub><b>Báo cáo doanh thu</b> — lọc theo khoảng ngày, duyệt hủy gói & hoàn tiền, doanh thu theo ngày và theo gói, tỷ lệ gia hạn</sub>
</p>

### 6. Trên điện thoại

Portal là PWA, có thanh điều hướng dưới cùng trên màn hình hẹp.

| Trang chủ | Tổng quan hội viên | Thẻ QR | Quầy lễ tân |
| :---: | :---: | :---: | :---: |
| <img src="docs/readme/mobile-landing-light.png" alt="Trang chủ mobile" width="100%" /> | <img src="docs/readme/mobile-member-dashboard-light.png" alt="Dashboard mobile" width="100%" /> | <img src="docs/readme/mobile-member-card-dark.png" alt="Thẻ QR mobile" width="100%" /> | <img src="docs/readme/mobile-staff-reception-dark.png" alt="Lễ tân mobile" width="100%" /> |

<details>
<summary><b>🌗 So sánh Light / Dark</b></summary>
<br />

| Light | Dark |
| :---: | :---: |
| <img src="docs/readme/member-dashboard-light.png" alt="Dashboard sáng" width="100%" /> | <img src="docs/readme/member-dashboard-dark.png" alt="Dashboard tối" width="100%" /> |

Màu nhấn đi qua token `--sol-accent*` trong `apps/web/src/shared/ui/theme.css`.

</details>

---

## 🏗️ Kiến trúc

```mermaid
flowchart LR
    subgraph Client["🌐 Frontend"]
        Web["React + Vite + TypeScript\n(apps/web)\nVercel hoặc Nginx trên VPS"]
    end
    subgraph Server["⚙️ Backend API"]
        API["Spring Boot 3 + Java 21\n3 lớp + i18n (apps/api)\nRender hoặc Docker trên VPS"]
    end
    subgraph Database["🗄️ PostgreSQL"]
        PG[("Hibernate Code-First\n+ PostgreSQL triggers")]
    end

    Web <-->|"REST (JWT + Accept-Language)"| API
    API <-->|"JDBC over TLS (profile supabase)"| PG
```

| Vòng đời tài khoản (`users.status`) | Vòng đời gói hội viên (`membership_subscriptions.status`) |
| :---: | :---: |
| <img src="docs/srs/diagrams/png/statechart_f0_user.png" alt="State diagram tài khoản" width="100%" /> | <img src="docs/srs/diagrams/png/statechart_f1_member_package.png" alt="State diagram gói hội viên" width="100%" /> |

Sơ đồ dữ liệu theo miền (Users, Classes, Bookings, Memberships, Payments, E-commerce…) nằm trong [docs/design](docs/design). Bộ sơ đồ của SRS (ERD sinh từ entity, conceptual model, swimlane, screen flow và 12 state diagram) kèm file draw.io nằm trong [docs/srs/diagrams](docs/srs/diagrams).

> [!IMPORTANT]
> **Bất biến kiến trúc dữ liệu**
> - **Code-First:** bảng, cột, khóa định nghĩa bằng JPA Entity (`ddl-auto: update`). File SQL trong `db/` chỉ là tài liệu lịch sử, không dùng để triển khai.
> - **Trigger bắt buộc:** chống trùng lịch, kiểm tra gói (và sức chứa lớp cho dữ liệu cũ) nạp tự động qua `PostgreSqlTriggerProvider`; lỗi trigger được map thành lỗi HTTP dễ hiểu.
> - **Chính sách database:** `DatabasePolicyTest`, `DatabaseProfilesTest` và `scripts/test-database-config.ps1` chỉ cho phép profile `supabase` (PostgreSQL).
> - **Đa ngôn ngữ:** `vi` (mặc định) và `en`; mọi thông báo mới phải có cả `messages_vi` và `messages_en`.
> - **Phân quyền ở backend:** ẩn menu ở frontend không phải là authorization.

---

## 🔄 CI/CD — một workflow, hai đường deploy

Toàn bộ kiểm tra và deploy nằm trong **một workflow** [`pipeline.yml`](.github/workflows/pipeline.yml):

```mermaid
flowchart LR
    T1["test-web\nFrontend test, lint, build"] --> C["config\nkiểm tra secret"]
    T2["test-api\nBackend compile + test"] --> C
    C --> R["Deploy backend\nRender"] --> V["Deploy frontend\nVercel"]
    T1 --> P["Deploy to VPS\nSSH + Docker Compose"]
    T2 --> P
    I["images\nBuild api + web"] --> P
```

- **PR và `develop`:** chỉ chạy test và build image Docker, không deploy.
- **`main`:** thêm hai đường deploy — Render rồi Vercel (health check, rollback); VPS qua SSH (`git merge --ff-only`, `docker compose up --wait`, health check, tự quay về commit cũ nếu lỗi). Thiếu secret của đường nào thì đường đó tự bỏ qua.
- **Run workflow** trong tab Actions để chạy lại commit mới nhất hoặc một commit chỉ định.
- Cấu hình: [CICD_SETUP.md](docs/CICD_SETUP.md) (Render, Vercel) · [DOCKER_COMPOSE.md](docs/DOCKER_COMPOSE.md) và [VPS_CICD_SETUP.md](docs/VPS_CICD_SETUP.md) (VPS).

---

## 📂 Cấu trúc thư mục

```text
SWP391/
├── apps/
│   ├── api/        Spring Boot 3 REST API (Java 21, Maven, JPA/Hibernate, Security, i18n)
│   └── web/        React + Vite + TypeScript Web Portal (UI theo feature)
├── db/             Tài liệu cấu trúc dữ liệu lịch sử (chỉ tham chiếu)
├── docs/           Master guide, plans, specs, API contracts, diagrams, QA, ảnh README
├── postman/        Bộ collection gọi thử API
├── scripts/        Chạy local (run-local, stop-local, init-db) và kiểm tra database
├── compose.yml     Docker Compose cho VPS (web + API)
└── .github/        workflows/pipeline.yml: CI + CD Render/Vercel + CD VPS
```

---

## 🚀 Chạy local

**Yêu cầu:** Java 21+, Node.js 22, thông tin kết nối Supabase PostgreSQL ([hướng dẫn](docs/SUPABASE_SETUP.md)).

### Cách 1 — một lệnh (Windows)

```bash
npm start
```

Lệnh này gọi [`scripts/run-local.bat`](scripts/run-local.bat): kiểm tra môi trường và cấu hình Supabase rồi khởi chạy **Web + API**; Hibernate tự tạo/cập nhật bảng và nạp trigger. Dừng bằng `npm run stop`. Chi tiết: [LOCAL_DEV_GUIDE.md](docs/LOCAL_DEV_GUIDE.md).

### Cách 2 — thủ công (mọi hệ điều hành)

1. Sao chép `.env.example` thành `.env` và điền thông tin Supabase.
2. Backend:
   ```bash
   cd apps/api && ./mvnw spring-boot:run
   ```
3. Frontend:
   ```bash
   cd apps/web && npm install && npm run dev
   ```

| Điểm truy cập | Địa chỉ |
| :--- | :--- |
| Web Portal | `http://localhost:5173` |
| API healthcheck | `http://localhost:8080/api/v1/health` |
| Swagger UI (chỉ khi `SWAGGER_ENABLED=true`) | `http://localhost:8080/swagger-ui/index.html` |

> [!TIP]
> Bật `APP_DEMO_SEED_ENABLED=true` để có sẵn dữ liệu và tài khoản demo cho mọi vai trò — xem [DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md) và [DEMO_DATA.md](docs/DEMO_DATA.md).

### Kiểm tra trước khi mở PR

```bash
npm --prefix apps/web test && npm --prefix apps/web run lint && npm --prefix apps/web run build
```

```bash
cd apps/api && ./mvnw test
```

Hai lệnh này giống các job `test-web` và `test-api` trong Pipeline.

---

## 📚 Tài liệu

| Tài liệu | Mô tả |
| :--- | :--- |
| [📘 PROJECT_MASTER_GUIDE.md](docs/PROJECT_MASTER_GUIDE.md) | Đặc tả nghiệp vụ tổng thể, vai trò và quy trình cốt lõi |
| [🧾 Business rules](docs/specs/2026-11-10-membership-and-attendance-business-rules.md) | Gói tập, khóa học, điểm danh, bảo lưu và QR cổng |
| [🎁 Quyền lợi gói](docs/specs/2026-11-09-membership-benefits-design.md) | Thiết kế và trạng thái triển khai quyền lợi theo hạng |
| [🎨 DESIGN.md](DESIGN.md) | Quy chuẩn thiết kế giao diện đang có hiệu lực |
| [🏛️ backend-architecture.md](docs/rules/backend-architecture.md) | Kiến trúc 3 lớp, SOLID, IoC, JPA |
| [☁️ SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | JDBC TLS, RLS và schema test biệt lập |
| [🔄 CICD_SETUP.md](docs/CICD_SETUP.md) | Thiết lập Pipeline: Render, Vercel |
| [🐳 DOCKER_COMPOSE.md](docs/DOCKER_COMPOSE.md) | Chạy web + API bằng Docker Compose và deploy VPS |
| [🎬 DEMO_MAINFLOW_25MIN.md](docs/DEMO_MAINFLOW_25MIN.md) | Kịch bản demo luồng chính |
| [📋 AGILE_SCRUM_JIRA_PLAN.md](docs/plans/AGILE_SCRUM_JIRA_PLAN.md) | Backlog, phân công màn hình, tiêu chí nghiệm thu |
| [🤖 AGENTS.md](AGENTS.md) | Quy tắc bắt buộc cho contributor và AI coding agent |

---

## 🤝 Quy ước làm việc

Xem [CONTRIBUTING.md](CONTRIBUTING.md) và [bản đồ cấu trúc repo](docs/architecture/REPOSITORY_STRUCTURE.md).

- Đọc [AGENTS.md](AGENTS.md), [backend-architecture.md](docs/rules/backend-architecture.md) và [backlog](docs/plans/AGILE_SCRUM_JIRA_PLAN.md) trước khi nhận ticket; mỗi PR xử lý một Jira ticket, nhánh đặt theo `SCMS-123/short-description`.
- Đổi API thì cập nhật OpenAPI trong `docs/api-contracts/` cùng PR.
- Mọi thay đổi schema đi qua **JPA Entity**; trigger cập nhật qua `PostgreSqlTriggerProvider`.
- Thông báo hoặc mã lỗi mới ở backend phải có cả `messages_vi.properties` và `messages_en.properties`.
- Đọc [DESIGN.md](DESIGN.md) trước khi sửa giao diện; frontend luôn có trạng thái loading, empty và error.
- **Tuyệt đối không** commit `.env`, mật khẩu, JWT secret, API token hay dữ liệu nhạy cảm.

---

<div align="center">
  <sub>© 2026 <b>Agile4Life — SWP391 Team</b>. Built with ❤️ using Spring Boot 3, React and PostgreSQL.</sub>
</div>
