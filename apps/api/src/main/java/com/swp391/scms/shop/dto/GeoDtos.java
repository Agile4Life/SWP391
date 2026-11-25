package com.swp391.scms.shop.dto;

/** Nhóm các DTO cho dữ liệu hành chính (tỉnh/phường). */
public final class GeoDtos {
    /** Constructor private: chỉ dùng làm nơi chứa các record. */
    private GeoDtos() {}

    /** Một đơn vị hành chính: mã và tên. */
    public record RegionDto(String code, String name) {}
}
