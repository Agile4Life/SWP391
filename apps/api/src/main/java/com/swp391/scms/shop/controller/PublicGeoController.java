package com.swp391.scms.shop.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.shop.service.GeoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * API công khai tra cứu tỉnh/thành và phường/xã (đã ngừng; bật qua app.shop.enabled).
 *
 * Disabled by default: Shop module removed from the active scope.
 */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@RestController
@RequestMapping("/api/v1/public/geo")
public class PublicGeoController {
    private final GeoService geo;
    private final MessageService messages;

    /** Constructor cho test: không có MessageService. */
    public PublicGeoController(GeoService geo) {
        this(geo, null);
    }

    /** Constructor chính: nhận GeoService và MessageService. */
    @Autowired
    public PublicGeoController(GeoService geo, MessageService messages) {
        this.geo = geo;
        this.messages = messages;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messages == null ? key : messages.getMessage(key);
    }

    /** GET /provinces: danh sách tỉnh/thành. */
    @GetMapping("/provinces")
    public ApiResponse<List<GeoService.Region>> provinces() {
        return ApiResponse.ok(msg("success.shop.geo"), geo.provinces());
    }

    /** GET /provinces/{code}/wards: danh sách phường/xã của một tỉnh. */
    @GetMapping("/provinces/{code}/wards")
    public ApiResponse<List<GeoService.Region>> wards(@PathVariable String code) {
        return ApiResponse.ok(msg("success.shop.geo"), geo.wards(code));
    }
}
