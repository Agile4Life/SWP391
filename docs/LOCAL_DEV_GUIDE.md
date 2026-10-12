> SCRUM-91: Database mục tiêu là Supabase PostgreSQL. Xem [SUPABASE_SETUP.md](SUPABASE_SETUP.md) để cấu hình session pooler, SSL/RLS và test DB thật. Hướng dẫn SQL Server dưới đây chỉ áp dụng với profile `sqlserver`.

# Hướng Dẫn Chạy Local Dự Án SCMS (Sports Center Management System)

Bộ công cụ này giúp bạn khởi động toàn bộ hệ thống gồm **SQL Server Database**, **Spring Boot REST API** và **React Vite Web Portal** chỉ với **1 cú click** hoặc 1 dòng lệnh.

---

## 1. Yêu Cầu Môi Trường (Prerequisites)

| Công cụ | Phiên bản yêu cầu | Đã kiểm tra trên máy |
|---|---|---|
| **Node.js** | `>= 20.x` |  Đã cài (v24.x) |
| **npm** | `>= 10.x` |  Đã cài (v12.x) |
| **Java JDK** | `>= 21` |  Đã cài (JDK 25 LTS) |
| **SQL Server** | 2019+ hoặc Docker |  Đã chạy local (Port 1433, user `sa`) |
| **Maven** | 3.9+ |  Đã tích hợp sẵn Maven Wrapper (`mvnw.cmd` tại `apps/api`) |

---

## 2. Cách Chạy Nhanh Nhất (1-Click)

### Cách 1: Click đúp chuột (Khuyên dùng trên Windows)
- Bấm đúp vào file [`scripts/run-local.bat`](../scripts/run-local.bat).
- File sẽ tự động:
  1. Kiểm tra môi trường (Node, Java, SQL Server).
  2. Tạo file `.env` nếu chưa có.
  3. Kiểm tra và khởi tạo database `SportsCenterDB` nếu chưa có bảng.
  4. Mở 2 cửa sổ Console riêng biệt cho **API (Port 8080)** và **Web (Port 5173)**.
  5. Tự động mở trình duyệt truy cập `http://localhost:5173`.

### Cách 2: Chạy từ Terminal / PowerShell
```powershell
# Chạy qua npm từ thư mục gốc
npm start
# hoặc
npm run dev

# Hoặc gọi trực tiếp script
.\scripts\run-local.ps1
```

### Cách 3: Dừng toàn bộ hệ thống khi không dùng nữa
- Bấm đúp vào [`scripts/stop-local.bat`](../scripts/stop-local.bat) hoặc chạy:
```powershell
npm run stop
# hoặc
.\scripts\stop-local.ps1
```
*Lệnh này sẽ tự động giải phóng cổng 8080 và 5173, tránh lỗi "Port already in use".*

---

## 3. Các Lựa Chọn Chạy Nâng Cao

File [`scripts/run-local.ps1`](../scripts/run-local.ps1) hỗ trợ các tham số linh hoạt:

```powershell
# 1. Chỉ chạy Frontend React Web (Port 5173)
.\scripts\run-local.ps1 -Only web
# hoặc: npm run dev:web

# 2. Chỉ chạy Backend API (Port 8080)
.\scripts\run-local.ps1 -Only api
# hoặc: npm run dev:api

# 3. Chỉ kiểm tra và khởi tạo lại Database
.\scripts\run-local.ps1 -Only db
# hoặc: npm run db:init

# 4. Tạo lại Database từ đầu (Xóa cũ tạo mới theo schema)
npm run db:init:force
# hoặc: .\scripts\init-db.ps1 -Force

# 5. Chạy nhưng không tự động mở trình duyệt
.\scripts\run-local.ps1 -NoBrowser
```

---

## 4. Các Đường Dẫn Quan Trọng Sau Khi Chạy

| Dịch vụ | URL | Mô tả |
|---|---|---|
| **Web Portal** | [http://localhost:5173](http://localhost:5173) | Giao diện React Frontend |
| **API Health Check** | [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health) | Kiểm tra trạng thái Spring Boot |
| **Swagger UI (API Docs)**| [http://localhost:8080/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html) | Xem & test trực tiếp các REST API |
| **OpenAPI JSON Spec** | [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs) | Tài liệu OpenAPI của Backend |

---

## 5. Cấu Hình Cơ Sở Dữ Liệu (`.env`)

File [.env](file:///d:/SWP391_PROJECT/SWP391/.env) đã được thiết lập mặc định phù hợp với máy local:

```env
MSSQL_SA_PASSWORD=12345
SPRING_DATASOURCE_URL=jdbc:sqlserver://localhost:1433;databaseName=SportsCenterDB;encrypt=true;trustServerCertificate=true
SPRING_DATASOURCE_USERNAME=sa
SPRING_DATASOURCE_PASSWORD=12345
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

---

## 6. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Lỗi `Port 8080 is already in use` hoặc `Port 5173 is already in use`**:
   - Chạy script [stop-local.bat](file:///d:/SWP391_PROJECT/SWP391/stop-local.bat) hoặc gõ `npm run stop` để giải phóng port.

2. **Lỗi không kết nối được SQL Server**:
   - Kiểm tra xem dịch vụ `SQL Server (SQLEXPRESS)` hoặc `SQL Server (MSSQLSERVER)` trong Windows Services có đang ở trạng thái `Running` hay không.
   - Nếu bạn dùng Docker, chạy lệnh `docker compose up -d sqlserver`.

3. **Lỗi chính sách thực thi PowerShell (`ExecutionPolicy`)**:
   - Các file `.bat` đi kèm đã tích hợp sẵn `-ExecutionPolicy Bypass`.
   - Nếu chạy trực tiếp `.ps1` gặp thông báo Restricted, bạn chỉ cần gõ:
     `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
