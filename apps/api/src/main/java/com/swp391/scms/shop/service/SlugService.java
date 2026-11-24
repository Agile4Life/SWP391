package com.swp391.scms.shop.service;

import java.text.Normalizer;
import java.util.Locale;

/** Tạo slug URL từ chuỗi tiếng Việt (bỏ dấu, chữ thường, nối bằng dấu gạch ngang). */
public final class SlugService {
    private static final int MAX_LENGTH = 180;

    /** Constructor private: lớp tiện ích chỉ có hàm static. */
    private SlugService() {}

    /**
     * Chuyển chuỗi thành slug: bỏ dấu, đổi đ thành d, chỉ giữ a-z0-9 nối bằng "-", cắt tối đa 180 ký tự; chuỗi
     * rỗng trả "".
     */
    public static String slugify(String input) {
        if (input == null || input.isBlank()) {
            return "";
        }
        String decomposed = Normalizer.normalize(input.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'd')
                .toLowerCase(Locale.ROOT);
        String slug = decomposed
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (slug.length() > MAX_LENGTH) {
            slug = slug.substring(0, MAX_LENGTH).replaceAll("-+$", "");
        }
        return slug;
    }
}
