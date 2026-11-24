package com.swp391.scms.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.coaching.service.CurrentCoachMembers;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.health.dto.HealthMetricBatchDto;
import com.swp391.scms.health.dto.HealthMetricDto;
import com.swp391.scms.health.entity.MemberProgressLog;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Bộ kiểm thử cho HealthAssessmentTier (phân hạng đánh giá sức khỏe).
 *
 * Đặc tả 2026-11-09: buổi đánh giá đầu tiên do bất kỳ HLV nào thực hiện;
 * chỉ số mỡ cơ thể ({@code body_fat}) và khối lượng cơ ({@code muscle_mass}) dành cho hạng Platinum;
 * đánh giá theo dõi định kỳ áp dụng từ hạng Gold trở lên.
 */
class HealthAssessmentTierTest {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final MemberProgressLogRepository logs = mock(MemberProgressLogRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CurrentCoachMembers access = mock(CurrentCoachMembers.class);
    private final MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private final HealthMetricService service = new HealthMetricService(logs, members, users);
    // 2026-11-09 20:00 tại TP. Hồ Chí Minh
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T13:00:00Z"), ZONE);
    private final LocalDate today = LocalDate.of(2026, 11, 9);
    private Member member;

    /** Hàm trợ giúp của test: tạo một chỉ số sức khỏe mẫu. */
    private HealthMetricDto metric(String name, String value, String unit) {
        return new HealthMetricDto(null, name, new BigDecimal(value), unit, 999L, LocalDateTime.of(2000, 1, 1, 0, 0));
    }

    /** Chuẩn bị trước mỗi test: tạo service chỉ số sức khỏe với repository giả lập. */
    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "currentCoachMembers", access);
        ReflectionTestUtils.setField(service, "subscriptions", subscriptions);
        ReflectionTestUtils.setField(service, "clock", clock);
        member = new Member();
        member.setUserId(10L);
        User memberUser = new User();
        memberUser.setId(10L);
        member.setUser(memberUser);
        User recorder = new User();
        recorder.setId(20L);
        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(users.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(recorder));
        when(users.findByIdAndDeletedAtIsNull(30L)).thenReturn(Optional.of(recorder));
        when(logs.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (row). */
    private MemberProgressLog row(Long recorderId, LocalDateTime at) {
        MemberProgressLog log = new MemberProgressLog();
        log.setMember(member);
        log.setMetricName("weight");
        log.setMetricValue(new BigDecimal("70"));
        User by = new User();
        by.setId(recorderId);
        log.setRecordedBy(by);
        log.setRecordedAt(at);
        return log;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (active). */
    private MembershipSubscription active(String tier, int days) {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName(tier);
        pkg.setTier(tier);
        pkg.setDurationDays(days);
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        sub.setStartDate(today.minusDays(2));
        sub.setEndDate(today.plusDays(20));
        return sub;
    }

    /** Kiểm thử: bất kỳ HLV nào cũng được nhận buổi đánh giá đầu tiên của hội viên đã đăng ký. */
    @Test
    void anyCoachTakesTheFirstAssessmentOfARegisteredMember() {
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of());

        assertThat(service.addMetric(10L, metric("weight", "70", "kg"), 20L, "COACH").metricName()).isEqualTo("weight");

        verify(access, never()).requireCoachOf(any(), any());
    }

    /**
     * Kiểm thử: cùng HLV có thể hoàn thành đánh giá trong ngày nhưng không được đánh giá các ngày sau nếu chưa
     * được phân công.
     */
    @Test
    void theSameCoachCanFinishTheAssessmentTheSameDayButNotLaterOnesWithoutBeingAssigned() {
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.atTime(18, 30))));
        assertThat(service.addMetric(10L, metric("height", "172", "cm"), 20L, "COACH").metricName()).isEqualTo("height");

        // Một tháng sau cùng hội viên đó đã có bản ghi: chỉ HLV được phân công mới được thêm số đo mới.
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.minusDays(30).atTime(9, 0))));
        doThrow(new ForbiddenException("X", "coaching.member.not_assigned", null, "Denied")).when(access).requireCoachOf(20L, 10L);
        assertThatThrownBy(() -> service.addMetric(10L, metric("weight", "69", "kg"), 20L, "COACH"))
                .isInstanceOf(ForbiddenException.class);
    }

    /** Kiểm thử: tài khoản đã xóa không có buổi đánh giá đầu tiên. */
    @Test
    void aDeletedAccountGetsNoFirstAssessment() {
        member.getUser().setDeletedAt(LocalDateTime.now());
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of());
        doThrow(new ForbiddenException("X", "coaching.member.not_assigned", null, "Denied")).when(access).requireCoachOf(20L, 10L);

        assertThatThrownBy(() -> service.addMetric(10L, metric("weight", "70", "kg"), 20L, "COACH"))
                .isInstanceOf(ForbiddenException.class);
    }

    /** Kiểm thử: mỡ cơ thể và khối lượng cơ chỉ dành cho hạng Platinum. */
    @Test
    void bodyFatAndMuscleMassAreOnlyForPlatinum() {
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of());
        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active("GOLD", 30)));
        assertThatThrownBy(() -> service.addMetric(10L, metric("body_fat", "18", "%"), 30L, "CENTER_MANAGER"))
                .isInstanceOf(ForbiddenException.class).hasMessageContaining("Platinum");
        assertThatThrownBy(() -> service.addMetric(10L, metric("muscle_mass", "30", "kg"), 30L, "CENTER_MANAGER"))
                .isInstanceOf(ForbiddenException.class);

        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active("PLATINUM", 90)));
        assertThat(service.addMetric(10L, metric("body_fat", "18", "%"), 30L, "CENTER_MANAGER").metricName()).isEqualTo("body_fat");
        assertThat(service.addMetric(10L, metric("muscle_mass", "30", "kg"), 30L, "CENTER_MANAGER").metricName()).isEqualTo("muscle_mass");
    }

    /** Kiểm thử: Silver chỉ có buổi đánh giá đầu tiên, Gold và Platinum có đánh giá theo dõi. */
    @Test
    void silverGetsTheFirstAssessmentOnlyWhileGoldAndPlatinumGetFollowUps() {
        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active("SILVER", 30)));
        // Các số đo trong cùng một ngày được tính là một phần của buổi đánh giá đầu tiên.
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.atTime(9, 0))));
        assertThat(service.addMetric(10L, metric("height", "172", "cm"), 30L, "CENTER_MANAGER").metricName()).isEqualTo("height");

        // Một số đo từ ngày trước đó đồng nghĩa với buổi đánh giá theo dõi, quyền lợi mà hạng Silver không bao gồm.
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.minusDays(35).atTime(9, 0))));
        assertThatThrownBy(() -> service.addMetric(10L, metric("weight", "69", "kg"), 30L, "CENTER_MANAGER"))
                .isInstanceOf(ForbiddenException.class).hasMessageContaining("Gold");

        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active("GOLD", 30)));
        assertThat(service.addMetric(10L, metric("weight", "69", "kg"), 30L, "CENTER_MANAGER").metricName()).isEqualTo("weight");
    }

    /** Kiểm thử: Gold và Platinum có một ngày đánh giá mỗi chu kỳ 30 ngày. */
    @Test
    void goldAndPlatinumGetOneAssessmentDayPerThirtyDayCycle() {
        // Gói Gold bắt đầu 2 ngày trước: chu kỳ là today-2 .. today+27, nên một ngày khác trong chu kỳ này đã được dùng.
        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active("GOLD", 30)));
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.minusDays(1).atTime(9, 0))));

        ForbiddenException ex = assertThrows(ForbiddenException.class,
                () -> service.addMetric(10L, metric("weight", "69", "kg"), 30L, "CENTER_MANAGER"));
        assertEquals("HEALTH_ASSESSMENT_CYCLE_USED", ex.getErrorCode());

        // Nhiều số đo trong cùng một ngày được tính là một buổi đánh giá.
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.atTime(8, 0))));
        assertThat(service.addMetric(10L, metric("height", "172", "cm"), 30L, "CENTER_MANAGER").metricName()).isEqualTo("height");

        // Các số đo trước chu kỳ hiện tại (buổi đánh giá đầu tiên hoặc gói trước đó) không tiêu tốn lượt của chu kỳ này.
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.minusDays(40).atTime(9, 0))));
        assertThat(service.addMetric(10L, metric("weight", "69", "kg"), 30L, "CENTER_MANAGER").metricName()).isEqualTo("weight");

        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active("PLATINUM", 90)));
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.minusDays(1).atTime(9, 0))));
        assertThrows(ForbiddenException.class, () -> service.addMetric(10L, metric("body_fat", "18", "%"), 30L, "CENTER_MANAGER"));
    }

    /** Hàm trợ giúp của test: tạo một mục đo cho request ghi hàng loạt. */
    private HealthMetricBatchDto.Item item(String name, String value, String unit) {
        return new HealthMetricBatchDto.Item(name, new BigDecimal(value), unit);
    }

    /** Kiểm thử: ghi hàng loạt lưu mọi số đo và chỉ suy ra BMI một lần. */
    @Test
    void aBatchSavesEveryMeasurementAndDerivesBmiOnlyOnce() {
        MemberProgressLog height = row(20L, today.atTime(20, 0));
        height.setMetricName("height");
        height.setMetricValue(new BigDecimal("172"));
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.atTime(20, 0)), height));
        var saved = service.addMetrics(10L, new HealthMetricBatchDto(List.of(
                item("height", "172", "cm"), item("weight", "68", "kg"), item("body_fat", "18", "%"))), 30L, "CENTER_MANAGER");

        assertThat(saved).extracting(HealthMetricDto::metricName).containsExactly("height", "weight", "body_fat");
        org.mockito.ArgumentCaptor<MemberProgressLog> captor = org.mockito.ArgumentCaptor.forClass(MemberProgressLog.class);
        verify(logs, org.mockito.Mockito.times(4)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(MemberProgressLog::getMetricName)
                .containsExactly("height", "weight", "body_fat", "bmi");
    }

    /** Kiểm thử: ghi hàng loạt từ chối BMI nhập tay trùng và vi phạm hạng mà không lưu gì. */
    @Test
    void aBatchRejectsManualBmiDuplicatesAndTierViolationsWithoutSavingAnything() {
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of());
        assertThatThrownBy(() -> service.addMetrics(10L, new HealthMetricBatchDto(List.of(
                item("weight", "68", "kg"), item("bmi", "23", ""))), 30L, "CENTER_MANAGER"))
                .hasMessageContaining("BMI");
        assertThatThrownBy(() -> service.addMetrics(10L, new HealthMetricBatchDto(List.of(
                item("weight", "68", "kg"), item("weight", "69", "kg"))), 30L, "CENTER_MANAGER"))
                .hasMessageContaining("once");
        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active("GOLD", 30)));
        assertThatThrownBy(() -> service.addMetrics(10L, new HealthMetricBatchDto(List.of(
                item("weight", "68", "kg"), item("body_fat", "18", "%"))), 30L, "CENTER_MANAGER"))
                .isInstanceOf(ForbiddenException.class);

        verify(logs, never()).save(any());
    }

    /** Kiểm thử: hội viên không có gói đang hoạt động thì không bị giới hạn. */
    @Test
    void membersWithoutAnActivePackageAreNotRestricted() {
        when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of());
        when(logs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(row(20L, today.minusDays(60).atTime(9, 0))));

        assertThat(service.addMetric(10L, metric("body_fat", "18", "%"), 30L, "CENTER_MANAGER").metricName()).isEqualTo("body_fat");
    }
}
