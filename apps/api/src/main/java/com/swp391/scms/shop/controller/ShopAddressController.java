package com.swp391.scms.shop.controller;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.shop.dto.AddressDtos.AddressDto;
import com.swp391.scms.shop.dto.AddressDtos.AddressRequest;
import com.swp391.scms.shop.service.AddressService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API sổ địa chỉ giao hàng của hội viên (đã ngừng; bật qua app.shop.enabled).
 *
 * Mặc định tắt: module cửa hàng đã bị gỡ khỏi phạm vi đang chạy.
 */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@RestController
@RequestMapping("/api/v1/shop/addresses")
@PreAuthorize("hasRole('MEMBER')")
public class ShopAddressController {
    private final AddressService addresses;
    private final MessageService messages;

    /** Constructor cho test: không có MessageService. */
    public ShopAddressController(AddressService addresses) {
        this(addresses, null);
    }

    /** Constructor chính: nhận AddressService và MessageService. */
    @Autowired
    public ShopAddressController(AddressService addresses, MessageService messages) {
        this.addresses = addresses;
        this.messages = messages;
    }

    /** Dịch message key; không có MessageService thì trả lại key. */
    private String msg(String key) {
        return messages == null ? key : messages.getMessage(key);
    }

    /** GET: danh sách địa chỉ của hội viên. */
    @GetMapping
    public ApiResponse<List<AddressDto>> list(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return ApiResponse.ok(msg("success.shop.addresses"), addresses.list(principal.id()));
    }

    /** POST: thêm địa chỉ mới. */
    @PostMapping
    public ResponseEntity<ApiResponse<AddressDto>> create(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @Valid @RequestBody AddressRequest request
    ) {
        AddressDto created = addresses.create(principal.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(msg("success.shop.address_saved"), created));
    }

    /** PUT /{id}: cập nhật địa chỉ. */
    @PutMapping("/{id}")
    public ApiResponse<AddressDto> update(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody AddressRequest request
    ) {
        return ApiResponse.ok(msg("success.shop.address_saved"), addresses.update(principal.id(), id, request));
    }

    /** POST /{id}/default: đặt địa chỉ làm mặc định, trả về danh sách mới. */
    @PostMapping("/{id}/default")
    public ApiResponse<List<AddressDto>> makeDefault(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(msg("success.shop.address_saved"), addresses.makeDefault(principal.id(), id));
    }

    /** DELETE /{id}: xóa địa chỉ, trả về danh sách còn lại. */
    @DeleteMapping("/{id}")
    public ApiResponse<List<AddressDto>> delete(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable Long id
    ) {
        return ApiResponse.ok(msg("success.shop.address_deleted"), addresses.delete(principal.id(), id));
    }
}
