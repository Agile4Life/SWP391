package com.swp391.scms.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Cấu hình tài liệu Swagger/OpenAPI: thông tin API, nhóm chức năng (tag) và cách nhập JWT Bearer để thử API
 * ngay trên Swagger UI.
 *
 * Cấu hình tài liệu OpenAPI 3 / Swagger cho SCMS API. Cấu hình sơ đồ xác thực JWT Bearer, các endpoint server
 * và tag theo module.
 */
@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "BearerAuth";

    /**
     * Mô tả tổng quan API: tiêu đề, phiên bản, liên hệ, máy chủ (dùng đường dẫn tương đối nên chạy được ở mọi
     * môi trường), các tag và cơ chế xác thực Bearer JWT.
     */
    @Bean
    public OpenAPI scmsOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Sports Center Management System (SCMS) API")
                        .description("Tài liệu đặc tả API chuẩn RESTful cho Hệ thống Quản lý Trung tâm Thể thao Đa năng SCMS (SWP391 - Nhóm 1).")
                        .version("v1.0.0")
                        .contact(new Contact()
                                .name("SWP391 Group 1 Development Team")
                                .email("group1.swp391@fpt.edu.vn"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0.html")))
                // URL tương đối: "Try it out" gọi tới origin đang phục vụ Swagger (localhost, VPS, Render).
                .servers(List.of(new Server().url("/").description("Máy chủ hiện tại (Current Server)")))
                .tags(List.of(
                        new Tag().name("Authentication").description("Đăng ký tài khoản, đăng nhập JWT, gửi và xác thực mã OTP"),
                        new Tag().name("Users & RBAC").description("Quản trị người dùng, trạng thái khóa/mở khóa và phân quyền vai trò"),
                        new Tag().name("Profile").description("Tra cứu và cập nhật hồ sơ cá nhân của người dùng"),
                        new Tag().name("Health Metrics").description("Ghi nhận và theo dõi các chỉ số sức khỏe của hội viên"),
                        new Tag().name("Payments & Invoices").description("Quản lý giao dịch thu tiền, xuất hóa đơn điện tử và công nợ"),
                        new Tag().name("Classes & Schedules").description("Quản lý lịch tập, phân bổ phòng, công suất và hàng chờ")
                ))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME, new SecurityScheme()
                                .name(SECURITY_SCHEME_NAME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Nhập chuỗi JWT Token vào ô bên dưới (Ví dụ: Bearer <token>)")));
    }

    /** Gom mọi endpoint dưới /api/v1/** vào một nhóm tài liệu "scms-public-api". */
    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder()
                .group("scms-public-api")
                .pathsToMatch("/api/v1/**")
                .build();
    }
}
