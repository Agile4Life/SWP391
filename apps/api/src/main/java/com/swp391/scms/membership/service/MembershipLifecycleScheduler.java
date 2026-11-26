package com.swp391.scms.membership.service;

import com.swp391.scms.common.i18n.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job dọn dẹp vòng đời gói tập hằng ngày. Mỗi hạng mục chạy trong transaction riêng thông qua các service proxy,
 * nên nếu một hạng mục lỗi sẽ được ghi log và các hạng mục còn lại vẫn chạy bình thường.
 * <ul>
 *   <li>Các đợt bảo lưu đã duyệt sẽ chuyển sang trạng thái frozen vào ngày đầu tiên và tự động tiếp tục lại vào
 *   ngày ngay sau ngày cuối cùng (hoặc khi đạt {@link MembershipSubscriptionService#MAX_HOLD_DAYS} với các bảo lưu
 *   không có ngày cụ thể).</li>
 *   <li>Các lớp học và buổi tập 1:1 đã đặt cho những ngày không còn gói hội viên active nào bao phủ
 *   (đã hết hạn hoặc không gia hạn) sẽ được giải phóng để nhường chỗ hoặc khung giờ cho người khác.</li>
 * </ul>
 */
@Component
public class MembershipLifecycleScheduler {

    private static final Logger log = LoggerFactory.getLogger(MembershipLifecycleScheduler.class);

    private final MembershipSubscriptionService subscriptions;
    private final EntitlementRevocationService revocation;
    private final MessageService messages;

    /** Nhận dịch vụ gói tập, dịch vụ thu hồi quyền lợi và MessageService. */
    public MembershipLifecycleScheduler(MembershipSubscriptionService subscriptions,
                                        EntitlementRevocationService revocation,
                                        MessageService messages) {
        this.subscriptions = subscriptions;
        this.revocation = revocation;
        this.messages = messages;
    }

    /**
     * Chạy lúc 00:15 hằng ngày (cấu hình app.membership.lifecycle.cron): bắt đầu bảo lưu, kết thúc bảo lưu,
     * giải phóng lịch, rồi ghi log số lượng.
     */
    @Scheduled(cron = "${app.membership.lifecycle.cron:0 15 0 * * ?}")
    public void runDaily() {
        int started = startDueHolds();
        int resumed = resumeExpiredHolds();
        int released = releaseUncoveredBookings();
        log.info("[MembershipLifecycle] started {} hold(s), resumed {} hold(s), released {} booking(s)", started, resumed, released);
    }

    /**
     * Tự kết thúc các bảo lưu đã hết hạn (đủ 90 ngày hoặc qua ngày cuối); lỗi từng kỳ chỉ ghi log. Trả số kỳ đã
     * kết thúc.
     */
    public int resumeExpiredHolds() {
        int resumed = 0;
        java.util.Set<Long> due = new java.util.LinkedHashSet<>(subscriptions.findHoldsDueForResume());
        due.addAll(subscriptions.findDatedHoldsDueForResume());
        for (Long id : due) {
            try {
                if (subscriptions.autoResumeHold(id)) resumed++;
            } catch (RuntimeException ex) {
                log.warn("[MembershipLifecycle] could not resume hold on subscription {}", id, ex);
            }
        }
        return resumed;
    }

    /**
     * Chuyển sang trạng thái frozen các đợt bảo lưu đã duyệt đã đến ngày bắt đầu; trả về số kỳ đã chuyển.
     */
    public int startDueHolds() {
        int started = 0;
        for (Long id : subscriptions.findHoldsDueToStart()) {
            try {
                if (subscriptions.startHold(id)) started++;
            } catch (RuntimeException ex) {
                log.warn("[MembershipLifecycle] could not start hold on subscription {}", id, ex);
            }
        }
        return started;
    }

    /**
     * Với mỗi hội viên có lịch sắp tới, hủy các lịch không còn gói nào bao phủ (gói hết hạn hoặc không gia
     * hạn); trả số lịch đã hủy.
     */
    public int releaseUncoveredBookings() {
        String reason = messages != null ? messages.getMessage("scheduling.enrollment.cancelled_by_expiry") : null;
        int released = 0;
        for (Long memberId : revocation.membersWithUpcomingBookings()) {
            try {
                released += revocation.revokeUncoveredBookings(memberId, reason);
            } catch (RuntimeException ex) {
                log.warn("[MembershipLifecycle] could not release bookings of member {}", memberId, ex);
            }
        }
        return released;
    }
}
