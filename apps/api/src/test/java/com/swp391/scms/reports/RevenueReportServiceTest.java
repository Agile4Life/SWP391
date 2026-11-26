package com.swp391.scms.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.attendance.entity.SessionAttendance;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.reports.dto.ClassUtilizationDto;
import com.swp391.scms.reports.dto.DailyRevenueDto;
import com.swp391.scms.reports.dto.PackageRevenueDto;
import com.swp391.scms.reports.dto.RecentTransactionDto;
import com.swp391.scms.reports.dto.ReportSnapshotCreateDto;
import com.swp391.scms.reports.dto.ReportSnapshotDto;
import com.swp391.scms.reports.entity.ReportSnapshot;
import com.swp391.scms.reports.repository.ReportSnapshotRepository;
import com.swp391.scms.reports.repository.SessionAttendanceReportRepository;
import com.swp391.scms.reports.repository.TransactionReportRepository;
import com.swp391.scms.reports.service.RevenueReportService;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service RevenueReportService (revenue report service). */
@ExtendWith(MockitoExtension.class)
class RevenueReportServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private MembershipSubscriptionRepository subscriptionRepository;

    @Mock
    private ReportSnapshotRepository snapshotRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TransactionReportRepository transactionReportRepository;

    @Mock
    private SessionAttendanceReportRepository sessionAttendanceReportRepository;

    private ObjectMapper objectMapper;
    private Clock clock;
    private RevenueReportService service;

    /** Chuẩn bị trước mỗi test: tạo RevenueReportService với repository giả lập. */
    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        clock = Clock.fixed(Instant.parse("2026-10-05T10:00:00Z"), ZoneOffset.UTC);
        service = new RevenueReportService(
                paymentRepository, subscriptionRepository,
                snapshotRepository, userRepository, objectMapper, clock,
                transactionReportRepository, sessionAttendanceReportRepository);
    }

    /** Kiểm thử: trả giao dịch thật với ngày kết thúc tính cả ngày đó và giới hạn 10 giao dịch. */
    @Test
    void returnsRealTransactionsWithInclusiveEndDateAndLimitOfTen() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 5);
        var transaction = new RecentTransactionDto(78L, "SCMS-78", "Nguyễn An", "Gold",
                new BigDecimal("750000"), "cash", end.atTime(23, 59, 59, 999999999));
        when(transactionReportRepository.findRecentTransactions(start.atStartOfDay(),
                end.plusDays(1).atStartOfDay(), PageRequest.of(0, 10))).thenReturn(List.of(transaction));

        assertEquals(List.of(transaction), service.getRecentTransactions(start, end));
    }

    /** Kiểm thử: từ chối khoảng ngày giao dịch bị đảo ngược. */
    @Test
    void rejectsReversedTransactionDateRange() {
        assertThrows(BadRequestException.class, () -> service.getRecentTransactions(
                LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 1)));
        verifyNoInteractions(transactionReportRepository);
    }

    /** Kiểm thử: khoảng giao dịch mặc định dùng đồng hồ của ứng dụng. */
    @Test
    void defaultsTransactionPeriodUsingApplicationClock() {
        when(transactionReportRepository.findRecentTransactions(LocalDate.of(2026, 9, 5).atStartOfDay(),
                LocalDate.of(2026, 10, 6).atStartOfDay(), PageRequest.of(0, 10))).thenReturn(List.of());
        assertTrue(service.getRecentTransactions(null, null).isEmpty());
    }

    /** Kiểm thử: tỷ lệ gia hạn chỉ tính các kỳ đã trả và hết hạn trong nhóm được chọn. */
    @Test
    void renewalRateCountsOnlyExpiredPaidPeriodsInSelectedCohort() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate lastExpired = LocalDate.of(2026, 10, 4);
        when(subscriptionRepository.countExpiredPaidPeriods(start, lastExpired)).thenReturn(4L);
        when(subscriptionRepository.countRenewedExpiredPaidPeriods(start, lastExpired)).thenReturn(3L);

        var result = service.getRenewalRate(start, LocalDate.of(2026, 10, 31));

        assertEquals(4L, result.expiredCount());
        assertEquals(3L, result.renewedCount());
        assertEquals(75.0, result.renewalRate());
    }

    /** Kiểm thử P3-BE-18: tỷ lệ gia hạn được làm tròn đúng 1 chữ số thập phân (tránh số thực lẻ dài IEEE-754). */
    @Test
    void renewalRateRoundsToOneDecimalPlace() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate lastExpired = LocalDate.of(2026, 10, 4);
        when(subscriptionRepository.countExpiredPaidPeriods(start, lastExpired)).thenReturn(3L);
        when(subscriptionRepository.countRenewedExpiredPaidPeriods(start, lastExpired)).thenReturn(1L);
        assertEquals(33.3, service.getRenewalRate(start, lastExpired).renewalRate());

        when(subscriptionRepository.countRenewedExpiredPaidPeriods(start, lastExpired)).thenReturn(2L);
        assertEquals(66.7, service.getRenewalRate(start, lastExpired).renewalRate());
    }

    /** Kiểm thử: tỷ lệ gia hạn không khả dụng khi nhóm rỗng. */
    @Test
    void renewalRateIsUnavailableForAnEmptyCohort() {
        var result = service.getRenewalRate(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 10));

        assertEquals(0L, result.expiredCount());
        assertNull(result.renewalRate());
        verifyNoInteractions(subscriptionRepository);
    }

    /** Kiểm thử: tỷ lệ gia hạn không khả dụng khi chưa có kỳ trả phí nào hết hạn. */
    @Test
    void renewalRateIsUnavailableWhenNoPaidPeriodsExpired() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 4);
        when(subscriptionRepository.countExpiredPaidPeriods(start, end)).thenReturn(0L);

        assertNull(service.getRenewalRate(start, end).renewalRate());
        verify(subscriptionRepository, never()).countRenewedExpiredPaidPeriods(any(), any());
    }

    /** Kiểm thử: tỷ lệ gia hạn từ chối khoảng ngày bị đảo ngược. */
    @Test
    void renewalRateRejectsReversedDateRange() {
        assertThrows(BadRequestException.class, () -> service.getRenewalRate(
                LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 1)));
        verifyNoInteractions(subscriptionRepository);
    }

    /** Kiểm thử: tính đúng doanh thu theo ngày bằng truy vấn tổng hợp nửa mở [start, end+1) tại DB. */
    @Test
    @DisplayName("Should calculate daily revenue via DB aggregate with half-open upper bound")
    void shouldCalculateDailyRevenueCorrectly() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 3);

        var row1 = dailyRow(LocalDate.of(2026, 10, 1), new BigDecimal("1500000.00"), 2L);
        var row2 = dailyRow(LocalDate.of(2026, 10, 3), new BigDecimal("2000000.00"), 1L);

        when(transactionReportRepository.findDailyRevenue(start.atStartOfDay(), end.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(row1, row2));

        List<DailyRevenueDto> result = service.getDailyRevenue(start, end);

        assertEquals(3, result.size());
        assertEquals(new BigDecimal("1500000.00"), result.get(0).getRevenue());
        assertEquals(2, result.get(0).getTransactionCount());
        assertEquals(BigDecimal.ZERO, result.get(1).getRevenue());
        assertEquals(0, result.get(1).getTransactionCount());
        assertEquals(new BigDecimal("2000000.00"), result.get(2).getRevenue());
        assertEquals(1, result.get(2).getTransactionCount());
        verifyNoInteractions(paymentRepository);
    }

    /** Kiểm thử: fallback sang paymentRepository khi transactionReportRepository là null. */
    @Test
    void dailyRevenueFallsBackWhenTransactionReportRepositoryIsNull() {
        RevenueReportService fallbackService = new RevenueReportService(
                paymentRepository, subscriptionRepository, snapshotRepository, userRepository,
                objectMapper, clock, null);
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 1);
        Payment p1 = new Payment();
        p1.setAmount(new BigDecimal("1000000.00"));
        p1.setStatus("success");
        p1.setPaidAt(LocalDateTime.of(2026, 10, 1, 23, 59, 59, 500_000_000));
        when(paymentRepository.findByStatusAndPaidAtBetween(eq("success"), eq(start.atStartOfDay()), any()))
                .thenReturn(List.of(p1));

        List<DailyRevenueDto> result = fallbackService.getDailyRevenue(start, end);
        assertEquals(1, result.size());
        assertEquals(new BigDecimal("1000000.00"), result.get(0).getRevenue());
    }

    /** Kiểm thử: ném lỗi khi ngày bắt đầu sau ngày kết thúc. */
    @Test
    @DisplayName("Should throw BadRequestException when start date is after end date")
    void shouldThrowWhenStartDateAfterEndDate() {
        LocalDate start = LocalDate.of(2026, 10, 10);
        LocalDate end = LocalDate.of(2026, 10, 1);

        assertThrows(BadRequestException.class, () -> service.getDailyRevenue(start, end));
    }

    /** Kiểm thử P1-BE-39: chặn khoảng ngày vượt quá 366 ngày và cho phép đúng 366 ngày (năm nhuận). */
    @Test
    void rejectsDateRangeExceeding366DaysAndAllowsExactLeapYear() {
        assertThrows(BadRequestException.class, () -> service.getDailyRevenue(
                LocalDate.of(2024, 1, 1), LocalDate.of(2025, 1, 1)));
        assertThrows(BadRequestException.class, () -> service.getRevenueByPackage(
                LocalDate.of(2000, 1, 1), LocalDate.of(2099, 12, 31)));

        when(transactionReportRepository.findDailyRevenue(
                LocalDate.of(2024, 1, 1).atStartOfDay(), LocalDate.of(2025, 1, 1).atStartOfDay()))
                .thenReturn(List.of());
        assertEquals(366, service.getDailyRevenue(LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31)).size());
    }

    /** Kiểm thử P1-BE-38 & P1-BE-39: doanh thu theo gói tổng hợp trực tiếp tại DB với cận trên nửa mở. */
    @Test
    @DisplayName("Should calculate revenue by package via DB aggregate without 2N+1 queries")
    void shouldCalculateRevenueByPackageCorrectly() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 5);

        when(transactionReportRepository.findRevenueByPackage(start.atStartOfDay(), end.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(
                        packageRow(1L, "Gold 6 Tháng", new BigDecimal("3000000.00"), 3L),
                        packageRow(2L, "Silver 1 Tháng", new BigDecimal("1000000.00"), 2L)
                ));

        List<PackageRevenueDto> result = service.getRevenueByPackage(start, end);

        assertEquals(2, result.size());
        assertEquals("Gold 6 Tháng", result.get(0).getPackageName());
        assertEquals(new BigDecimal("3000000.00"), result.get(0).getRevenue());
        assertEquals(75.0, result.get(0).getPercentage());
        assertEquals(25.0, result.get(1).getPercentage());
        verifyNoInteractions(paymentRepository, subscriptionRepository);
    }

    /** Kiểm thử P1-BE-40: tính tỷ lệ lấp đầy và tỷ lệ chuyên cần theo (session × member), không thổi phồng lên 100%. */
    @Test
    @DisplayName("Should calculate class utilization and attendance across sessions safely")
    void shouldCalculateClassUtilizationSafely() {
        SessionAttendanceReportRepository.ClassUtilizationRow row1 = utilizationRow(10L, "Morning Yoga", 2L, "Yoga", 20, 2L, 1L, 1L);
        SessionAttendanceReportRepository.ClassUtilizationRow row2 = utilizationRow(11L, "Open Workshop", 2L, "Yoga", 0, 0L, 0L, 0L);
        SessionAttendanceReportRepository.ClassUtilizationRow row3 = utilizationRow(12L, "Multi-Session Yoga", 2L, "Yoga", 10, 1L, 1L, 12L);

        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 5);
        when(sessionAttendanceReportRepository.classUtilizationByDiscipline(
                start, end, start.atStartOfDay(), end.plusDays(1).atStartOfDay(), 2L))
                .thenReturn(List.of(row1, row2, row3));

        List<ClassUtilizationDto> list = service.getClassUtilization(start, end, 2L);

        assertEquals(3, list.size());
        assertEquals(10.0, list.get(0).utilizationRate()); // 2 / 20 = 10%
        assertEquals(50.0, list.get(0).attendanceRate());  // 1 / (2 * 1) = 50%
        assertEquals(0.0, list.get(1).utilizationRate());  // zero capacity -> 0.0
        assertEquals(0.0, list.get(1).attendanceRate());   // zero booked -> 0.0
        assertEquals(10.0, list.get(2).utilizationRate()); // 1 / 10 = 10%
        assertEquals(8.3, list.get(2).attendanceRate());   // 1 / (1 * 12) = 8.3%, NOT 100%
    }

    /** Kiểm thử P2-BE-46: getClassUtilization kiểm tra start <= end SAU KHI áp giá trị mặc định. */
    @Test
    void classUtilizationRejectsInvertedRangeAfterApplyingDefaults() {
        assertThrows(BadRequestException.class, () -> service.getClassUtilization(
                LocalDate.of(2100, 1, 1), null, null));
        assertThrows(BadRequestException.class, () -> service.getClassUtilization(
                null, LocalDate.of(1999, 12, 31), null));
        verifyNoInteractions(sessionAttendanceReportRepository);
    }

    /** Kiểm thử P1-BE-37: tạo ảnh chụp luôn dùng currentUserId (bỏ qua generatedById giả mạo từ client). */
    @Test
    @DisplayName("Should generate snapshot using authenticated currentUserId and ignore spoofed generatedById")
    void shouldGenerateSnapshotWhenJsonIsValid() {
        var authUser = new com.swp391.scms.users.entity.User();
        authUser.setId(1L);
        authUser.setFullName("Authenticated Manager");
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(authUser));

        ReportSnapshotCreateDto dto = new ReportSnapshotCreateDto(
                "class_utilization",
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 5),
                "{\"averageUtilization\": 75.0}",
                999L
        );

        when(snapshotRepository.save(any(ReportSnapshot.class))).thenAnswer(inv -> inv.getArgument(0));

        ReportSnapshotDto result = service.generateSnapshot(dto, 1L);
        assertNotNull(result);
        assertEquals("class_utilization", result.getReportType());
        assertEquals(1L, result.getGeneratedById());
        assertEquals("Authenticated Manager", result.getGeneratedByName());
        verify(userRepository).findByIdAndDeletedAtIsNull(1L);
        verify(userRepository, never()).findByIdAndDeletedAtIsNull(999L);
        verify(snapshotRepository).save(any(ReportSnapshot.class));
    }

    /** Kiểm thử P1-BE-37: từ chối JSON không hợp lệ, JSON không phải object và payload vượt quá 256 KB. */
    @Test
    @DisplayName("Should reject snapshot generation when json is invalid, non-object, or oversized")
    void shouldRejectSnapshotWhenJsonIsInvalid() throws Exception {
        ReportSnapshotCreateDto badSyntax = new ReportSnapshotCreateDto(
                "revenue", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5), "{invalid_json_format", null);
        ReportSnapshotCreateDto arrayJson = new ReportSnapshotCreateDto(
                "revenue", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5), "[1, 2, 3]", null);
        ReportSnapshotCreateDto primitiveJson = new ReportSnapshotCreateDto(
                "revenue", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5), "\"hello\"", null);
        String oversized = "{\"x\":\"" + "a".repeat(RevenueReportService.MAX_SNAPSHOT_DATA_LENGTH) + "\"}";
        ReportSnapshotCreateDto tooBig = new ReportSnapshotCreateDto(
                "revenue", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5), oversized, null);

        assertThrows(BadRequestException.class, () -> service.generateSnapshot(badSyntax, 1L));
        assertThrows(BadRequestException.class, () -> service.generateSnapshot(arrayJson, 1L));
        assertThrows(BadRequestException.class, () -> service.generateSnapshot(primitiveJson, 1L));
        assertThrows(BadRequestException.class, () -> service.generateSnapshot(tooBig, 1L));

        var sizeAnnotation = ReportSnapshotCreateDto.class.getDeclaredField("data")
                .getAnnotation(jakarta.validation.constraints.Size.class);
        assertNotNull(sizeAnnotation);
        assertEquals(262144, sizeAnnotation.max());
    }

    /** Kiểm thử P1-BE-39: getSnapshots giới hạn số bản ghi bằng PageRequest(0, 100). */
    @Test
    void getSnapshotsBoundsResultSetTo100() {
        when(snapshotRepository.findAllByOrderByGeneratedAtDesc(PageRequest.of(0, 100))).thenReturn(List.of());
        assertTrue(service.getSnapshots().isEmpty());
        verify(snapshotRepository).findAllByOrderByGeneratedAtDesc(PageRequest.of(0, 100));
    }

    /** Kiểm thử: toàn bộ JPQL mới trong TransactionReportRepository và SessionAttendanceReportRepository biên dịch hợp lệ. */
    @Test
    void reportJpqlQueriesCompileAgainstHibernateEntityMappings() throws Exception {
        var registry = new org.hibernate.boot.registry.StandardServiceRegistryBuilder()
                .applySetting("jakarta.persistence.database-product-name", "PostgreSQL")
                .applySetting("jakarta.persistence.database-major-version", "16")
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", "false")
                .build();
        try {
            var sources = new org.hibernate.boot.MetadataSources(registry);
            var scanner = new org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new org.springframework.core.type.filter.AnnotationTypeFilter(jakarta.persistence.Entity.class));
            for (var bean : scanner.findCandidateComponents("com.swp391.scms")) {
                sources.addAnnotatedClass(Class.forName(bean.getBeanClassName()));
            }
            try (var factory = sources.buildMetadata().buildSessionFactory();
                 var session = factory.openSession()) {
                var recentMethod = TransactionReportRepository.class.getMethod(
                        "findRecentTransactions", LocalDateTime.class, LocalDateTime.class, org.springframework.data.domain.Pageable.class);
                session.createQuery(recentMethod.getAnnotation(org.springframework.data.jpa.repository.Query.class).value(), RecentTransactionDto.class)
                        .setParameter("start", LocalDateTime.of(2026, 10, 1, 0, 0))
                        .setParameter("endExclusive", LocalDateTime.of(2026, 10, 2, 0, 0));

                var dailyMethod = TransactionReportRepository.class.getMethod(
                        "findDailyRevenue", LocalDateTime.class, LocalDateTime.class);
                session.createQuery(dailyMethod.getAnnotation(org.springframework.data.jpa.repository.Query.class).value(), jakarta.persistence.Tuple.class)
                        .setParameter("start", LocalDateTime.of(2026, 10, 1, 0, 0))
                        .setParameter("endExclusive", LocalDateTime.of(2026, 10, 2, 0, 0));

                var pkgMethod = TransactionReportRepository.class.getMethod(
                        "findRevenueByPackage", LocalDateTime.class, LocalDateTime.class);
                session.createQuery(pkgMethod.getAnnotation(org.springframework.data.jpa.repository.Query.class).value(), jakarta.persistence.Tuple.class)
                        .setParameter("start", LocalDateTime.of(2026, 10, 1, 0, 0))
                        .setParameter("endExclusive", LocalDateTime.of(2026, 10, 2, 0, 0));

                var utilAll = SessionAttendanceReportRepository.class.getMethod(
                        "classUtilizationAll", LocalDate.class, LocalDate.class, LocalDateTime.class, LocalDateTime.class);
                var utilByDisc = SessionAttendanceReportRepository.class.getMethod(
                        "classUtilizationByDiscipline", LocalDate.class, LocalDate.class, LocalDateTime.class, LocalDateTime.class, Long.class);
                session.createQuery(utilAll.getAnnotation(org.springframework.data.jpa.repository.Query.class).value(), jakarta.persistence.Tuple.class)
                        .setParameter("start", LocalDate.of(2026, 10, 1))
                        .setParameter("end", LocalDate.of(2026, 10, 5))
                        .setParameter("startTs", LocalDateTime.of(2026, 10, 1, 0, 0))
                        .setParameter("endTs", LocalDateTime.of(2026, 10, 6, 0, 0));
                session.createQuery(utilByDisc.getAnnotation(org.springframework.data.jpa.repository.Query.class).value(), jakarta.persistence.Tuple.class)
                        .setParameter("start", LocalDate.of(2026, 10, 1))
                        .setParameter("end", LocalDate.of(2026, 10, 5))
                        .setParameter("startTs", LocalDateTime.of(2026, 10, 1, 0, 0))
                        .setParameter("endTs", LocalDateTime.of(2026, 10, 6, 0, 0))
                        .setParameter("disciplineId", 1L);
            }
        } finally {
            org.hibernate.boot.registry.StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    private static TransactionReportRepository.DailyRevenueRow dailyRow(LocalDate date, BigDecimal revenue, Long txCount) {
        return new TransactionReportRepository.DailyRevenueRow() {
            @Override public LocalDate getPaidDate() { return date; }
            @Override public BigDecimal getRevenue() { return revenue; }
            @Override public Long getTransactionCount() { return txCount; }
        };
    }

    private static TransactionReportRepository.PackageRevenueRow packageRow(Long id, String name, BigDecimal revenue, Long count) {
        return new TransactionReportRepository.PackageRevenueRow() {
            @Override public Long getPackageId() { return id; }
            @Override public String getPackageName() { return name; }
            @Override public BigDecimal getRevenue() { return revenue; }
            @Override public Long getSubscriptionCount() { return count; }
        };
    }

    private static SessionAttendanceReportRepository.ClassUtilizationRow utilizationRow(
            Long classId, String className, Long disciplineId, String disciplineName,
            Integer capacity, Long enrolled, Long present, Long sessionCount) {
        return new SessionAttendanceReportRepository.ClassUtilizationRow() {
            @Override public Long getClassId() { return classId; }
            @Override public String getClassName() { return className; }
            @Override public Long getDisciplineId() { return disciplineId; }
            @Override public String getDisciplineName() { return disciplineName; }
            @Override public String getRoomName() { return null; }
            @Override public Integer getCapacity() { return capacity; }
            @Override public Long getEnrolledCount() { return enrolled; }
            @Override public Long getPresentCount() { return present; }
            @Override public Long getSessionCount() { return sessionCount; }
        };
    }
}
