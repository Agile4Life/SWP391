# TRUNG TÂM TÀI LIỆU DỰ ÁN (PROJECT DOCUMENTATION HUB)

Thư mục `docs/` là nơi lưu trữ tập trung toàn bộ tài liệu kiến trúc, sơ đồ thiết kế, quy tắc phát triển, hợp đồng API và kế hoạch dự án của hệ thống **Sports Center Management System (SCMS)**.

---

## 1. Cấu Trúc Các Phân Hệ Tài Liệu

```
docs/
├── PROJECT_MASTER_GUIDE.md # Cẩm nang kiến trúc và nghiệp vụ toàn diện (57KB)
├── LOCAL_DEV_GUIDE.md      # Cẩm nang cài đặt và chạy môi trường local
│
├── architecture/      # Bản đồ cấu trúc repo và audit kỹ thuật
├── plans/             # Kế hoạch phát triển, Jira Backlog & lộ trình Sprint
│   ├── README.md
│   ├── AGILE_SCRUM_JIRA_PLAN.md
│   ├── 2026-09-26-scms-luxury-editorial-frontend.md
│   └── 2026-10-01-backend-layered-jpa.md
│
├── srs/               # Tài liệu SRS (Word) & toàn bộ sơ đồ hệ thống
│   ├── Group1_SportsCenterManagement_SRS.docx
│   └── diagrams/
│       ├── drawio/    # File draw.io chỉnh sửa được (ERD, swimlane, screen flow, state diagram…)
│       └── png/       # Ảnh xuất từ các sơ đồ, dùng trong SRS
│
├── rules/             # Quy tắc kiến trúc mã nguồn & tiêu chuẩn kỹ thuật
│   └── backend-architecture.md  # Chuẩn 3 lớp, SOLID, IoC, JPA & i18n
│
├── api-contracts/     # Hợp đồng giao tiếp API (OpenAPI / Swagger)
│   ├── README.md
│   └── openapi-sprint1.yaml
│
├── adr/               # Bản ghi quyết định kiến trúc (Architectural Decision Records)
│   └── 0001-modular-monolith.md
│
└── specs/             # Đặc tả thiết kế kỹ thuật chi tiết
    ├── 2026-10-01-backend-layered-jpa-design.md
    └── 2026-10-01-backend-postgresql-amendment.md
```

---

## 2. Danh Mục Tài Liệu Nhanh

| Mục | Đường dẫn | Nội dung tóm tắt |
|---|---|---|
| 🧭 **Cấu trúc repository** | [`architecture/REPOSITORY_STRUCTURE.md`](architecture/REPOSITORY_STRUCTURE.md) | Ranh giới frontend/backend, vị trí module và quy tắc version control. |
| 📖 **Cẩm nang Master Guide** | [`PROJECT_MASTER_GUIDE.md`](PROJECT_MASTER_GUIDE.md) | Toàn bộ 10 Modules, 33 Bảng, 6 Luồng nghiệp vụ cốt lõi, 12 Trạng thái UML. |
| 💻 **Hướng dẫn Local Dev** | [`LOCAL_DEV_GUIDE.md`](LOCAL_DEV_GUIDE.md) | Cài đặt Node.js, Java 21, cấu hình Supabase PostgreSQL và chạy local. |
| 📋 **Kế hoạch & Backlog Jira** | [`plans/`](plans/README.md) | Epics, User Stories, Sprint Backlog 1-4, AC và phân công Jira keys. |
| 📊 **SRS & sơ đồ hệ thống** | [`srs/`](srs/Group1_SportsCenterManagement_SRS.docx) | Tài liệu SRS; ERD 61 bảng sinh từ entity, conceptual model, 9 swimlane, 6 screen flow và 12 state diagram (draw.io + PNG trong `srs/diagrams/`). |
| ⚖️ **Quy tắc Backend** | [`rules/backend-architecture.md`](rules/backend-architecture.md) | Chuẩn 3 lớp, ORM Code-First, Trigger Strategy và xử lý đa ngôn ngữ i18n. |
| 🔌 **Hợp đồng API** | [`api-contracts/`](api-contracts/README.md) | OpenAPI YAML specification cho các API Sprint 1. |
| 🏛️ **Kiến trúc ADR** | [`adr/`](adr/0001-modular-monolith.md) | Quyết định kiến trúc Modular Monolith (Spring Boot + React). |
| 📝 **Thiết kế kỹ thuật** | [`specs/`](specs/2026-10-01-backend-layered-jpa-design.md) | Đặc tả chi tiết triển khai JPA, Entity mapping và Trigger Strategy. |

---

## 3. Tài Liệu Quan Trọng & Tài Nguyên Liên Quan

- **Quy ước cho Contributor & AI Agent:** [`../AGENTS.md`](../AGENTS.md) — Bất biến dữ liệu, trigger và phạm vi MVP.
- **Schema triển khai:** JPA Entity trong `apps/api/src/main/java/com/swp391/scms/`; [`../db/databaseschema.sql`](../db/databaseschema.sql) chỉ là tham chiếu lịch sử, không dùng triển khai.
- **Bộ công cụ khởi chạy hệ thống:** [`../scripts/`](../scripts/README.md) — Scripts run-local, stop-local, init-db.
