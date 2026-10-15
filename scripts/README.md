# BỘ CÔNG CỤ KHỞI CHẠY HỆ THỐNG (LOCAL RUNNER SCRIPTS)

Thư mục này chứa các script tự động hóa khởi chạy, kiểm tra môi trường và quản lý tiến trình local cho dự án **Sports Center Management System (SCMS)**.

Runner mặc định dùng Supabase PostgreSQL; cấu hình theo [SUPABASE_SETUP.md](../docs/SUPABASE_SETUP.md). API/Web chạy nền, log tại `api.log`, `api-error.log`, `web.log`, `web-error.log` ở root. Hibernate tạo/cập nhật schema và cài trigger khi API khởi động.

---

## Danh Mục Script

| Script Windows (Batch) | Script PowerShell | Chức năng chính |
|---|---|---|
| [`run-local.bat`](run-local.bat) | [`run-local.ps1`](run-local.ps1) | **Khởi chạy hệ thống:** Kiểm tra Node.js, Java 21 và cấu hình Supabase; nạp `.env`; chạy Backend API (8080) + Frontend Web (5173). |
| [`stop-local.bat`](stop-local.bat) | [`stop-local.ps1`](stop-local.ps1) | **Dừng nhanh các tiến trình local:** Quét và giải phóng cổng 8080 (API) và 5173 (Web). |
| [`init-db.bat`](init-db.bat) | [`init-db.ps1`](init-db.ps1) | **Kiểm tra cấu hình database:** Hướng dẫn khởi động API để Hibernate đồng bộ schema; không thực thi DDL hoặc reset dữ liệu. |

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
