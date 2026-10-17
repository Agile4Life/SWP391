# Chạy local SCMS với Supabase PostgreSQL

Cần Java 21+, Node.js 20+ và kết nối Supabase PostgreSQL. Maven Wrapper nằm trong `apps/api`.

## Cấu hình

1. Sao chép `.env.example` thành `.env` ở root.
2. Lấy thông số kết nối từ Supabase Dashboard và điền theo [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
3. Dùng profile `supabase` (profile database duy nhất), cấu hình JWT secret và TLS trong `.env`. API/Web chạy local nhưng database luôn ở Supabase; không bật profile `local` hoặc `postgresql` riêng.

Không commit `.env` hoặc mật khẩu. Hibernate tạo/cập nhật schema từ JPA Entity khi API khởi động;
PostgreSQL provider tự cài trigger P2/P3/P4 và các index bắt buộc.

## Khởi chạy

```powershell
npm start
npm run stop
```

Runner nạp `.env`, kiểm tra môi trường và chạy API/Web nền. Log nằm tại
`api.log`, `api-error.log`, `web.log`, `web-error.log` ở root.

```powershell
.\scripts\run-local.ps1 -Only web
.\scripts\run-local.ps1 -Only api
.\scripts\run-local.ps1 -NoBrowser
npm run db:init
```

`db:init` kiểm tra cấu hình và hướng dẫn khởi động API; không chạy DDL hoặc reset database.
Có thể chạy thủ công bằng `npm run dev:api` và `npm run dev:web` sau khi cấu hình môi trường.

| Dịch vụ | URL |
|---|---|
| Web | http://localhost:5173 |
| API health | http://localhost:8080/api/v1/health |
| Swagger | http://localhost:8080/swagger-ui/index.html |

## Xử lý sự cố

- Cổng 8080/5173 đã dùng: chạy `npm run stop`, kiểm tra log rồi khởi động lại.
- Không kết nối được database: đối chiếu host, port, username, password và TLS với
  Dashboard; xem hướng dẫn pooler trong [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
- Không cài được trigger: kiểm tra quyền database role; không tắt trigger để chạy tạm.
- PowerShell chặn script: dùng file `.bat` trong `scripts/` hoặc đặt ExecutionPolicy
  cho riêng phiên chạy theo hướng dẫn của môi trường phát triển.
