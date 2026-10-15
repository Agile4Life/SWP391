# Database Supabase PostgreSQL

Schema triển khai được định nghĩa bằng JPA Entity trong `apps/api`, đồng bộ bởi
Hibernate `ddl-auto: update`. Trigger và index bắt buộc được cài bởi PostgreSQL provider.

Xem [Supabase setup](../docs/SUPABASE_SETUP.md) để cấu hình JDBC, TLS và kiểm thử database.
Các file schema/migration cũ tại đây chỉ lưu lịch sử thiết kế và phục vụ kiểm tra cấu trúc;
không dùng chúng để bootstrap hoặc nâng cấp môi trường hiện tại.
