package com.swp391.scms.common.image;

import com.swp391.scms.common.exception.BadRequestException;

import java.util.Base64;

/**
 * Kiểm tra ảnh gửi lên dạng data URL (data:image/...;base64,...): đúng định dạng, không quá dung lượng và nội
 * dung thật khớp loại ảnh khai báo (chống giả mạo đuôi file).
 */
public final class ImageDataUrlValidator {
    /** Lớp tiện ích static, không cho tạo đối tượng. */
    private ImageDataUrlValidator() {}

    /** Kết quả ảnh hợp lệ: loại MIME đã xác minh và mảng byte đã giải mã. */
    public record ValidatedImage(String contentType, byte[] bytes) {}

    /** Kiểm tra ảnh với mã lỗi mặc định của ảnh sản phẩm. */
    public static ValidatedImage validate(String dataUrl, long maxBytes) {
        return validate(dataUrl, maxBytes, "PRODUCT_IMAGE_INVALID", "error.shop.product_image_invalid");
    }

    /**
     * Kiểm tra ảnh và ném BadRequestException với mã lỗi/message key do nơi gọi chọn nếu ảnh không hợp lệ. Trả
     * về loại ảnh và dữ liệu byte.
     */
    public static ValidatedImage validate(String dataUrl, long maxBytes, String errorCode, String messageKey) {
        if (dataUrl == null || !dataUrl.startsWith("data:")) {
            throw invalid(errorCode, messageKey);
        }
        int semi = dataUrl.indexOf(";base64,");
        if (semi <= 5) {
            throw invalid(errorCode, messageKey);
        }
        String declaredType = dataUrl.substring(5, semi).trim().toLowerCase(java.util.Locale.ROOT);
        String base64Part = dataUrl.substring(semi + 8).trim();
        if (base64Part.isEmpty()) {
            throw invalid(errorCode, messageKey);
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64Part);
        } catch (IllegalArgumentException e) {
            throw invalid(errorCode, messageKey);
        }
        if (bytes.length == 0 || bytes.length > maxBytes) {
            throw invalid(errorCode, messageKey);
        }
        String detectedType = detectMimeType(bytes);
        if (detectedType == null || !detectedType.equals(declaredType)) {
            throw invalid(errorCode, messageKey);
        }
        return new ValidatedImage(detectedType, bytes);
    }

    /**
     * Nhận diện loại ảnh qua "magic bytes" ở đầu file: JPEG (FF D8 FF), PNG (89 50 4E 47...), WEBP
     * (RIFF....WEBP). Trả null nếu không phải ba loại này.
     */
    private static String detectMimeType(byte[] b) {
        if (b.length >= 3
                && (b[0] & 0xFF) == 0xFF
                && (b[1] & 0xFF) == 0xD8
                && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length >= 8
                && (b[0] & 0xFF) == 0x89
                && b[1] == 'P'
                && b[2] == 'N'
                && b[3] == 'G'
                && b[4] == 0x0D
                && b[5] == 0x0A
                && b[6] == 0x1A
                && b[7] == 0x0A) {
            return "image/png";
        }
        if (b.length >= 12
                && b[0] == 'R'
                && b[1] == 'I'
                && b[2] == 'F'
                && b[3] == 'F'
                && b[8] == 'W'
                && b[9] == 'E'
                && b[10] == 'B'
                && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    /** Tạo lỗi 400 "ảnh không hợp lệ" với mã lỗi và message key cho trước. */
    private static BadRequestException invalid(String errorCode, String messageKey) {
        return new BadRequestException(errorCode, messageKey, null, "Invalid image");
    }
}
