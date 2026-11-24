package com.swp391.scms.shop.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Nhóm các DTO cho địa chỉ giao hàng. */
public final class AddressDtos {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private AddressDtos() {}

    /**
     * Yêu cầu tạo/sửa địa chỉ: người nhận, số điện thoại Việt Nam, mã tỉnh/phường, địa chỉ chi tiết, ghi chú và
     * có đặt làm mặc định không.
     */
    public record AddressRequest(
            @NotBlank(message = "{validation.shop.address.recipient_required}")
            @Size(min = 2, max = 80, message = "{validation.shop.address.recipient_size}")
            String recipientName,

            @NotBlank(message = "{validation.shop.address.phone_invalid}")
            @Pattern(regexp = "^(0|\\+84)(3|5|7|8|9)\\d{8}$", message = "{validation.shop.address.phone_invalid}")
            String phone,

            @NotBlank(message = "{validation.shop.address.province_required}")
            String provinceCode,

            @NotBlank(message = "{validation.shop.address.ward_required}")
            String wardCode,

            @NotBlank(message = "{validation.shop.address.street_size}")
            @Size(min = 5, max = 200, message = "{validation.shop.address.street_size}")
            String streetLine,

            @Size(max = 200, message = "{validation.shop.address.note_size}")
            String note,

            boolean makeDefault
    ) {}

    /**
     * Thông tin địa chỉ trả về client: người nhận, số điện thoại, tỉnh, phường, địa chỉ chi tiết, ghi chú và cờ
     * mặc định.
     */
    public record AddressDto(
            Long id,
            String recipientName,
            String phone,
            String provinceCode,
            String provinceName,
            String wardCode,
            String wardName,
            String streetLine,
            String note,
            boolean isDefault
    ) {}
}
