package com.swp391.scms.common.image;

import com.swp391.scms.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Bộ kiểm thử cho ImageDataUrlValidator (image data url validator). */
class ImageDataUrlValidatorTest {
    /** Hàm trợ giúp của test: tạo data URL từ loại ảnh và dữ liệu. */
    static String dataUrl(String type, byte[] bytes) {
        return "data:" + type + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    final byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    final byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0};
    final byte[] webp = {'R', 'I', 'F', 'F', 0x24, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '};

    /** Kiểm thử: chấp nhận PNG, JPEG và WebP thật. */
    @Test
    void acceptsRealPngJpegAndWebp() {
        var img = ImageDataUrlValidator.validate(dataUrl("image/png", png), 1_500_000);
        assertThat(img.contentType()).isEqualTo("image/png");
        assertThat(img.bytes()).isEqualTo(png);

        var jpgImg = ImageDataUrlValidator.validate(dataUrl("image/jpeg", jpeg), 1_500_000);
        assertThat(jpgImg.contentType()).isEqualTo("image/jpeg");

        var webpImg = ImageDataUrlValidator.validate(dataUrl("image/webp", webp), 1_500_000);
        assertThat(webpImg.contentType()).isEqualTo("image/webp");
    }

    /** Kiểm thử: từ chối SVG, sai loại và ảnh quá lớn. */
    @Test
    void rejectsSvgMismatchAndOversize() {
        assertThatThrownBy(() -> ImageDataUrlValidator.validate(dataUrl("image/svg+xml", "<svg/>".getBytes()), 1_500_000))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "PRODUCT_IMAGE_INVALID");
        assertThatThrownBy(() -> ImageDataUrlValidator.validate(dataUrl("image/jpeg", png), 1_500_000))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ImageDataUrlValidator.validate(dataUrl("image/png", new byte[1_600_000]), 1_500_000))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ImageDataUrlValidator.validate(dataUrl("image/png", png), 0))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ImageDataUrlValidator.validate(dataUrl("image/png", png), -1))
                .isInstanceOf(BadRequestException.class);
        // Chuỗi Base64 vượt quá giới hạn ký tự bị chặn trước bước giải mã.
        String oversizedBeforeDecode = "data:image/png;base64," + "A".repeat(20);
        assertThatThrownBy(() -> ImageDataUrlValidator.validate(oversizedBeforeDecode, 10))
                .isInstanceOf(BadRequestException.class);
    }
}
