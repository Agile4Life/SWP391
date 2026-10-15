# Sports Center Management System

Monorepo khởi tạo cho SWP391, gồm React web portal và Spring Boot REST API.

Database của dự án là **Supabase PostgreSQL**, tạo schema bằng Hibernate Code-First. Xem [hướng dẫn Supabase](docs/SUPABASE_SETUP.md) để lấy kết nối JDBC, cấu hình SSL/RLS và chạy test DB thật.

## Cấu trúc

```text
apps/api/       Spring Boot API (Java 21)
apps/web/       React + Vite + TypeScript
db/             tài liệu cấu trúc và lịch sử dữ liệu; không dùng để bootstrap database
docs/           toàn bộ tài liệu (plans, diagrams, rules, guides, api-contracts, specs)
scripts/        bộ script tự động hóa khởi chạy local (run-local, stop-local, init-db)
.agents/        quy ước cho các agent phát triển tiếp
```

## Khởi động local

### Cách 1: 1-Click (Khuyên dùng trên Windows)
- Chạy `npm start` (hoặc bấm đúp vào [`scripts/run-local.bat`](scripts/run-local.bat) / chạy `.\scripts\run-local.ps1`).
- Bộ chạy kiểm tra môi trường và cấu hình Supabase, khởi chạy Web + API. Hibernate tạo/cập nhật bảng và cài trigger khi API chạy.
- Để dừng hệ thống: chạy `npm run stop` (hoặc bấm đúp [`scripts/stop-local.bat`](scripts/stop-local.bat)).

Chi tiết xem tại [docs/LOCAL_DEV_GUIDE.md](docs/LOCAL_DEV_GUIDE.md).

### Cách 2: Khởi động thủ công
1. Cài Java 21+, Maven 3.9+, Node.js 20+ và chuẩn bị kết nối PostgreSQL/Supabase.
2. Sao chép `.env.example` thành `.env` (hoặc cấu hình lại thông số kết nối).
3. Điền kết nối theo [Supabase setup](docs/SUPABASE_SETUP.md). Hibernate tạo schema từ Entity; không cần chạy file DDL thủ công.
4. Chạy API: `cd apps/api && .\mvnw.cmd spring-boot:run`.
5. Chạy Web: `cd apps/web && npm install && npm run dev`.

Web: `http://localhost:5173` · API: `http://localhost:8080/api/v1/health` · Swagger: `http://localhost:8080/swagger-ui/index.html`.

## Quy ước làm việc

- Đọc [AGENTS.md](AGENTS.md) và [docs/plans/AGILE_SCRUM_JIRA_PLAN.md](docs/plans/AGILE_SCRUM_JIRA_PLAN.md) trước khi nhận ticket.
- Mỗi PR chỉ xử lý một Jira ticket, đặt tên `SCMS-123/short-description`.
- Định nghĩa thay đổi schema bằng JPA Entity và cập nhật trigger PostgreSQL qua provider hiện có.
- Không commit `.env`, password, JWT secret hoặc dữ liệu thật.
