package com.swp391.scms.common;

import java.time.ZoneId;
import java.util.TimeZone;

/**
 * Múi giờ nghiệp vụ duy nhất của trung tâm (Asia/Ho_Chi_Minh): mọi giá trị ngày giờ API lưu hoặc so sánh đều
 * theo múi giờ này.
 *
 * The center's single business timezone: every wall-clock value the API stores or compares uses it.
 */
public final class CenterTime {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Lớp tiện ích chỉ chứa hằng số và hàm static, không cho tạo đối tượng. */
    private CenterTime() {}

    /**
     * Đặt múi giờ mặc định của JVM về giờ Việt Nam để LocalDateTime.now() trả đúng giờ trung tâm dù server chạy
     * ở múi giờ nào.
     *
     * Makes `LocalDateTime.now()` and `Clock.systemDefaultZone()` agree with {@link #ZONE}, whatever the host's timezone.
     */
    public static void useAsDefault() {
        TimeZone.setDefault(TimeZone.getTimeZone(ZONE));
    }
}
