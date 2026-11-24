package com.swp391.scms.common;

import java.time.ZoneId;
import java.util.TimeZone;

/**
 * Múi giờ nghiệp vụ duy nhất của trung tâm (Asia/Ho_Chi_Minh): mọi giá trị ngày giờ API lưu hoặc so sánh đều
 * theo múi giờ này.
 *
 * Múi giờ nghiệp vụ duy nhất của trung tâm: mọi giá trị giờ tường mà API lưu hoặc so sánh đều dùng nó.
 */
public final class CenterTime {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Lớp tiện ích chỉ chứa hằng số và hàm static, không cho tạo đối tượng. */
    private CenterTime() {}

    /**
     * Đặt múi giờ mặc định của JVM về giờ Việt Nam để LocalDateTime.now() trả đúng giờ trung tâm dù server chạy
     * ở múi giờ nào.
     *
     * Làm cho `LocalDateTime.now()` và `Clock.systemDefaultZone()` thống nhất với {@link #ZONE}, bất kể múi
     * giờ của máy chủ.
     */
    public static void useAsDefault() {
        TimeZone.setDefault(TimeZone.getTimeZone(ZONE));
    }
}
