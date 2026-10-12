# BỘ CÔNG CỤ KHỞI CHẠY HỆ THỐNG (LOCAL RUNNER SCRIPTS)

Thư mục này chứa các script tự động hóa khởi chạy, kiểm tra môi trường và quản lý tiến trình local cho dự án **Sports Center Management System (SCMS)**.

SCRUM-91: Runner chọn database theo `SPRING_PROFILES_ACTIVE`/JDBC URL. Với Supabase PostgreSQL, cấu hình theo [SUPABASE_SETUP.md](../docs/SUPABASE_SETUP.md); không gọi initializer SQL Server. API/Web chạy nền, log tại `api.log`, `api-error.log`, `web.log`, `web-error.log` ở root. Script `init-db` chỉ chạy T-SQL khi chọn profile SQL Server; PostgreSQL sinh bảng khi API khởi động.

---

## Danh Mục Script

| Script Windows (Batch) | Script PowerShell | Chức năng chính |
|---|---|---|
| [`run-local.bat`](run-local.bat) | [`run-local.ps1`](run-local.ps1) | **Khởi chạy hệ thống 1-Click:** Tự động kiểm tra Node.js, Java 21, SQL Server, nạp biến môi trường `.env`, khởi tạo database nếu thiếu, và khởi động song song Backend API (8080) + Frontend Web (5173). |
| [`stop-local.bat`](stop-local.bat) | [`stop-local.ps1`](stop-local.ps1) | **Dừng nhanh các tiến trình local:** Quét và giải phóng cổng 8080 (API) và 5173 (Web). |
| [`init-db.bat`](init-db.bat) | [`init-db.ps1`](init-db.ps1) | **Khởi tạo cơ sở dữ liệu:** Thực thi file DDL [`../db/databaseschema.sql`](../db/databaseschema.sql) trên SQL Server để tạo 33 bảng, trigger và seed data. |

---

## Cách Sử Dụng

### Cách 1: Chạy trực tiếp từ thư mục `scripts/`
- Bấm đúp chuột vào file `.bat` tương ứng (`run-local.bat`, `stop-local.bat`, `init-db.bat`).

### Cách 2: Chạy qua lệnh NPM từ thư mục gốc
Tại thư mục gốc của dự án:
```bash
npm start          # Khởi động hệ thống (Web + API)
npm run stop       # Dừng hệ thống
npm run db:init    # Khởi tạo CSDL
```
