package com.swp391.scms.catalog;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

/** API danh mục công khai (không cần đăng nhập) cho trang chủ: gói tập đang bán và đội ngũ HLV. */
@RestController
@RequestMapping("/api/v1/public/catalog")
public class PublicCatalogController {
    private final PublicCatalogService service;
    private final MessageService messages;

    /** Constructor cho test, không có MessageService. */
    public PublicCatalogController(PublicCatalogService service) { this(service, null); }

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public PublicCatalogController(PublicCatalogService service, MessageService messages) {
        this.service = service;
        this.messages = messages;
    }

    /** GET /api/v1/public/catalog: trả danh mục công khai. */
    @GetMapping
    @Operation(summary = "Active packages, public coach profiles and upcoming seven-day class schedule")
    public ResponseEntity<ApiResponse<PublicCatalogService.CatalogDto>> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(
                messages != null ? messages.getMessage("catalog.public.loaded") : "catalog.public.loaded",
                service.getCatalog()));
    }
}
