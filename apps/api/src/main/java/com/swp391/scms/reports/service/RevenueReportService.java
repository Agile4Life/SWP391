package com.swp391.scms.reports.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.reports.dto.ClassUtilizationDto;
import com.swp391.scms.reports.dto.DailyRevenueDto;
import com.swp391.scms.reports.dto.PackageRevenueDto;
import com.swp391.scms.reports.dto.RecentTransactionDto;
import com.swp391.scms.reports.dto.RenewalRateDto;
import com.swp391.scms.reports.dto.ReportSnapshotCreateDto;
import com.swp391.scms.reports.dto.ReportSnapshotDto;
import com.swp391.scms.reports.entity.ReportSnapshot;
import com.swp391.scms.reports.repository.ReportSnapshotRepository;
import com.swp391.scms.reports.repository.SessionAttendanceReportRepository;
import com.swp391.scms.reports.repository.TransactionReportRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Tính số liệu báo cáo cho quản lý: doanh thu theo ngày và theo gói, giao dịch gần đây, tỷ lệ gia hạn, mức sử
 * dụng lớp và lưu ảnh chụp báo cáo. Mọi ngày giờ tính theo giờ trung tâm.
 */
@Service
@Transactional
public class RevenueReportService {

    /** Giới hạn tối đa số ngày cho một truy vấn báo cáo doanh thu để chống OOM DoS. */
    public static final long MAX_RANGE_DAYS = 366L;
    /** Giới hạn tối đa kích thước payload JSON cho mỗi ảnh chụp báo cáo (256 KiB). */
    public static final int MAX_SNAPSHOT_DATA_LENGTH = 262_144;
    /** Giới hạn tối đa số ảnh chụp báo cáo trả về mỗi lần gọi danh sách. */
    private static final int MAX_SNAPSHOTS_LIST = 100;

    /** Khoảng ngày đã kiểm tra hợp lệ (ngày bắt đầu, ngày kết thúc). */
    private record DateRange(LocalDate start, LocalDate end) {}

    private final PaymentRepository paymentRepository;
    private final MembershipSubscriptionRepository subscriptionRepository;
    private final ReportSnapshotRepository snapshotRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionReportRepository transactionReportRepository;
    private final SessionAttendanceReportRepository sessionAttendanceReportRepository;

    /** Constructor cho test, không có repository thống kê chuyên cần lớp nhóm. */
    public RevenueReportService(PaymentRepository paymentRepository,
                                MembershipSubscriptionRepository subscriptionRepository,
                                ReportSnapshotRepository snapshotRepository,
                                UserRepository userRepository,
                                ObjectMapper objectMapper,
                                Clock clock,
                                TransactionReportRepository transactionReportRepository) {
        this(paymentRepository, subscriptionRepository, snapshotRepository, userRepository,
                objectMapper, clock, transactionReportRepository, null);
    }

    /** Constructor Spring dùng; repository chuyên cần lớp nhóm là tùy chọn. */
    @Autowired
    public RevenueReportService(PaymentRepository paymentRepository,
                                MembershipSubscriptionRepository subscriptionRepository,
                                ReportSnapshotRepository snapshotRepository,
                                UserRepository userRepository,
                                ObjectMapper objectMapper,
                                Clock clock,
                                TransactionReportRepository transactionReportRepository,
                                @Autowired(required = false) SessionAttendanceReportRepository sessionAttendanceReportRepository) {
        this.paymentRepository = paymentRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.snapshotRepository = snapshotRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.clock = (clock != null ? clock : Clock.system(com.swp391.scms.common.CenterTime.ZONE))
                .withZone(com.swp391.scms.common.CenterTime.ZONE);
        this.transactionReportRepository = transactionReportRepository;
        this.sessionAttendanceReportRepository = sessionAttendanceReportRepository;
    }

    /** Khoảng ngày mặc định 30 ngày gần nhất; ngày bắt đầu sau ngày kết thúc hoặc vượt 366 ngày thì báo 400. */
    private DateRange resolveValidatedDateRange(LocalDate startDate, LocalDate endDate) {
        LocalDate start = startDate != null ? startDate : LocalDate.now(clock).minusDays(30);
        LocalDate end = endDate != null ? endDate : LocalDate.now(clock);
        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "reports.revenue.invalid_date_range", null,
                    "Start date cannot be after end date");
        }
        long inclusiveDays = ChronoUnit.DAYS.between(start, end) + 1;
        if (inclusiveDays > MAX_RANGE_DAYS) {
            throw new BadRequestException("DATE_RANGE_TOO_LARGE", "reports.revenue.invalid_date_range", null,
                    "Date range cannot exceed " + MAX_RANGE_DAYS + " days");
        }
        return new DateRange(start, end);
    }

    /**
     * Tỷ lệ gia hạn: trong các kỳ đã trả tiền kết thúc trong khoảng (tính tới hôm qua), bao nhiêu % có kỳ tiếp
     * theo cũng đã trả tiền. Đọc với mức cô lập REPEATABLE_READ để hai số đếm nhất quán.
     */
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public RenewalRateDto getRenewalRate(LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveValidatedDateRange(startDate, endDate);
        LocalDate yesterday = LocalDate.now(clock).minusDays(1);
        LocalDate lastExpired = range.end().isBefore(yesterday) ? range.end() : yesterday;
        if (range.start().isAfter(lastExpired)) return new RenewalRateDto(0, 0, null);

        long expired = subscriptionRepository.countExpiredPaidPeriods(range.start(), lastExpired);
        long renewed = expired == 0 ? 0 : subscriptionRepository.countRenewedExpiredPaidPeriods(range.start(), lastExpired);
        Double rate = expired == 0 ? null : Math.round((100.0 * renewed / expired) * 10.0) / 10.0;
        return new RenewalRateDto(expired, renewed, rate);
    }

    /** 10 giao dịch thành công gần nhất trong khoảng ngày. */
    @Transactional(readOnly = true)
    public List<RecentTransactionDto> getRecentTransactions(LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveValidatedDateRange(startDate, endDate);
        return transactionReportRepository.findRecentTransactions(
                range.start().atStartOfDay(), range.end().plusDays(1).atStartOfDay(), PageRequest.of(0, 10));
    }

    /**
     * Doanh thu từng ngày trong khoảng: tổng hợp trực tiếp tại DB trên khoảng nửa mở
     * {@code [start 00:00, (end + 1) 00:00)} để không cắt cụt giây cuối ngày và không nạp ảnh biên lai vào heap.
     * Bỏ qua nạp ví (doanh thu ghi khi chi tiêu). Ngày không có giao dịch vẫn có dòng 0.
     */
    @Transactional(readOnly = true)
    public List<DailyRevenueDto> getDailyRevenue(LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveValidatedDateRange(startDate, endDate);
        LocalDate start = range.start();
        LocalDate end = range.end();
        LocalDateTime startTs = start.atStartOfDay();
        LocalDateTime endExclusive = end.plusDays(1).atStartOfDay();

        Map<LocalDate, DailyRevenueDto> byDate = new HashMap<>();
        if (transactionReportRepository != null) {
            List<TransactionReportRepository.DailyRevenueRow> rows =
                    transactionReportRepository.findDailyRevenue(startTs, endExclusive);
            if (rows != null) {
                for (TransactionReportRepository.DailyRevenueRow row : rows) {
                    if (row.getPaidDate() == null) {
                        continue;
                    }
                    BigDecimal revenue = row.getRevenue() != null ? row.getRevenue() : BigDecimal.ZERO;
                    int txCount = row.getTransactionCount() != null ? row.getTransactionCount().intValue() : 0;
                    byDate.put(row.getPaidDate(), new DailyRevenueDto(row.getPaidDate(), revenue, txCount));
                }
            }
        } else if (paymentRepository != null) {
            List<Payment> payments = paymentRepository.findByStatusAndPaidAtBetween("success",
                    startTs, endExclusive.minusNanos(1_000));
            Map<LocalDate, List<Payment>> grouped = payments.stream()
                    .filter(p -> p.getPaidAt() != null && !p.getPaidAt().isBefore(startTs) && p.getPaidAt().isBefore(endExclusive))
                    .filter(p -> p.getNote() == null || !p.getNote().startsWith("WALLET_TOPUP"))
                    .collect(Collectors.groupingBy(p -> p.getPaidAt().toLocalDate()));
            grouped.forEach((date, list) -> {
                BigDecimal sum = list.stream()
                        .map(Payment::netAmount)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                byDate.put(date, new DailyRevenueDto(date, sum, list.size()));
            });
        }

        List<DailyRevenueDto> result = new ArrayList<>();
        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            result.add(byDate.getOrDefault(cur, new DailyRevenueDto(cur, BigDecimal.ZERO, 0)));
            cur = cur.plusDays(1);
        }

        return result;
    }

    /**
     * Doanh thu theo gói tập: tổng hợp trực tiếp tại DB theo gói trong khoảng nửa mở
     * {@code [start 00:00, (end + 1) 00:00)}, tránh truy vấn 2N+1 và nạp ảnh biên lai; tính tỷ trọng % (làm tròn
     * 1 chữ số), sắp theo doanh thu giảm dần.
     */
    @Transactional(readOnly = true)
    public List<PackageRevenueDto> getRevenueByPackage(LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveValidatedDateRange(startDate, endDate);
        LocalDateTime startTs = range.start().atStartOfDay();
        LocalDateTime endExclusive = range.end().plusDays(1).atStartOfDay();

        if (transactionReportRepository != null) {
            List<TransactionReportRepository.PackageRevenueRow> rows =
                    transactionReportRepository.findRevenueByPackage(startTs, endExclusive);
            if (rows == null || rows.isEmpty()) {
                return List.of();
            }
            BigDecimal totalRevenue = rows.stream()
                    .map(r -> r.getRevenue() != null ? r.getRevenue() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            List<PackageRevenueDto> dtoList = new ArrayList<>(rows.size());
            for (TransactionReportRepository.PackageRevenueRow row : rows) {
                BigDecimal pkgRev = row.getRevenue() != null ? row.getRevenue() : BigDecimal.ZERO;
                int count = row.getSubscriptionCount() != null ? row.getSubscriptionCount().intValue() : 0;
                double pct = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                        ? pkgRev.multiply(BigDecimal.valueOf(100))
                        .divide(totalRevenue, 1, RoundingMode.HALF_UP)
                        .doubleValue()
                        : 0.0;
                dtoList.add(new PackageRevenueDto(row.getPackageId(), row.getPackageName(), pkgRev, count, pct));
            }
            dtoList.sort(Comparator.comparing(PackageRevenueDto::getRevenue).reversed());
            return dtoList;
        }

        List<Payment> payments = paymentRepository != null
                ? paymentRepository.findByStatusAndPaidAtBetween("success", startTs, endExclusive.minusNanos(1_000))
                : List.of();

        Map<Long, BigDecimal> revenueMap = new HashMap<>();
        Map<Long, Integer> countMap = new HashMap<>();
        Map<Long, String> nameMap = new HashMap<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;

        for (Payment payment : payments) {
            if (payment.getPaidAt() != null && !payment.getPaidAt().isBefore(startTs) && payment.getPaidAt().isBefore(endExclusive)
                    && (payment.getNote() == null || !payment.getNote().startsWith("WALLET_TOPUP"))
                    && payment.getSubscriptionId() != null && subscriptionRepository != null) {
                Optional<MembershipSubscription> subOpt = subscriptionRepository.findById(payment.getSubscriptionId());
                if (subOpt.isPresent() && subOpt.get().getMembershipPackage() != null) {
                    MembershipPackage pkg = subOpt.get().getMembershipPackage();
                    Long pkgId = pkg.getId();
                    String pkgName = pkg.getName();
                    BigDecimal amount = payment.netAmount() != null ? payment.netAmount() : BigDecimal.ZERO;

                    revenueMap.put(pkgId, revenueMap.getOrDefault(pkgId, BigDecimal.ZERO).add(amount));
                    countMap.put(pkgId, countMap.getOrDefault(pkgId, 0) + 1);
                    nameMap.put(pkgId, pkgName);
                    totalRevenue = totalRevenue.add(amount);
                }
            }
        }

        List<PackageRevenueDto> dtoList = new ArrayList<>();
        for (Long pkgId : revenueMap.keySet()) {
            BigDecimal pkgRev = revenueMap.get(pkgId);
            int count = countMap.get(pkgId);
            String name = nameMap.get(pkgId);

            Double pct = 0.0;
            if (totalRevenue.compareTo(BigDecimal.ZERO) > 0) {
                pct = pkgRev.multiply(BigDecimal.valueOf(100))
                        .divide(totalRevenue, 1, RoundingMode.HALF_UP)
                        .doubleValue();
            }
            dtoList.add(new PackageRevenueDto(pkgId, name, pkgRev, count, pct));
        }

        dtoList.sort(Comparator.comparing(PackageRevenueDto::getRevenue).reversed());
        return dtoList;
    }

    /**
     * SCRUM-120: Tính tỷ lệ sử dụng lớp nhóm (đăng ký / sức chứa) và tỷ lệ chuyên cần (lượt có mặt / tổng lượt
     * kỳ vọng = học viên ghi danh × số buổi không bị hủy), lọc theo khoảng ngày và disciplineId (tùy chọn), giới
     * hạn tối đa 100%, xử lý an toàn khi chia cho 0. Trả danh sách rỗng nếu không có repository.
     */
    @Transactional(readOnly = true)
    public List<ClassUtilizationDto> getClassUtilization(LocalDate startDate,
                                                         LocalDate endDate,
                                                         Long disciplineId) {
        LocalDate start = startDate != null ? startDate : LocalDate.of(2000, 1, 1);
        LocalDate end = endDate != null ? endDate : LocalDate.of(2099, 12, 31);
        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "reports.revenue.invalid_date_range", null,
                    "Start date cannot be after end date");
        }
        if (sessionAttendanceReportRepository == null) {
            return List.of();
        }

        LocalDateTime startTs = startDate != null ? startDate.atStartOfDay() : LocalDateTime.of(2000, 1, 1, 0, 0, 0);
        LocalDateTime endTs = endDate != null ? endDate.plusDays(1).atStartOfDay() : LocalDateTime.of(2100, 1, 1, 0, 0, 0);

        List<SessionAttendanceReportRepository.ClassUtilizationRow> rows;
        if (disciplineId != null) {
            rows = sessionAttendanceReportRepository.classUtilizationByDiscipline(start, end, startTs, endTs, disciplineId);
        } else {
            rows = sessionAttendanceReportRepository.classUtilizationAll(start, end, startTs, endTs);
        }
        if (rows == null) {
            return List.of();
        }

        List<ClassUtilizationDto> results = new ArrayList<>(rows.size());
        for (SessionAttendanceReportRepository.ClassUtilizationRow row : rows) {
            int capacity = row.getCapacity() != null ? row.getCapacity() : 0;
            long enrolledCount = row.getEnrolledCount() != null ? Math.max(row.getEnrolledCount(), 0L) : 0L;
            long presentCount = row.getPresentCount() != null ? Math.max(row.getPresentCount(), 0L) : 0L;
            Long rawSessionCount = row.getSessionCount();
            long expectedSlots;
            if (rawSessionCount != null) {
                long sessionCount = Math.max(rawSessionCount, 0L);
                expectedSlots = (enrolledCount > 0 && sessionCount > 0) ? enrolledCount * sessionCount : 0L;
            } else {
                expectedSlots = enrolledCount;
            }

            double utilizationRate = 0.0;
            if (capacity > 0) {
                utilizationRate = BigDecimal.valueOf(Math.min(enrolledCount, (long) capacity) * 100.0)
                        .divide(BigDecimal.valueOf(capacity), 1, RoundingMode.HALF_UP)
                        .doubleValue();
                if (utilizationRate > 100.0) {
                    utilizationRate = 100.0;
                }
            }

            double attendanceRate = 0.0;
            if (expectedSlots > 0) {
                attendanceRate = BigDecimal.valueOf(Math.min(presentCount, expectedSlots) * 100.0)
                        .divide(BigDecimal.valueOf(expectedSlots), 1, RoundingMode.HALF_UP)
                        .doubleValue();
                if (attendanceRate > 100.0) {
                    attendanceRate = 100.0;
                }
            }

            results.add(new ClassUtilizationDto(
                    row.getClassId(),
                    row.getClassName(),
                    row.getDisciplineId(),
                    row.getDisciplineName(),
                    row.getRoomName(),
                    capacity,
                    enrolledCount,
                    presentCount,
                    utilizationRate,
                    attendanceRate
            ));
        }

        return results;
    }

    /**
     * Lưu ảnh chụp báo cáo: kiểm tra khoảng ngày, kích thước tối đa 256 KB và dữ liệu phải là JSON object hợp lệ;
     * luôn dùng người đang đăng nhập làm người tạo (bỏ qua generatedById từ client); loại báo cáo mặc định
     * "revenue".
     */
    public ReportSnapshotDto generateSnapshot(ReportSnapshotCreateDto dto, Long currentUserId) {
        if (dto.getPeriodStart() != null && dto.getPeriodEnd() != null && dto.getPeriodStart().isAfter(dto.getPeriodEnd())) {
            throw new BadRequestException("INVALID_DATE_RANGE", "reports.revenue.invalid_date_range", null,
                    "Start date cannot be after end date");
        }
        if (dto.getData() == null || dto.getData().isBlank() || dto.getData().length() > MAX_SNAPSHOT_DATA_LENGTH) {
            throw new BadRequestException("INVALID_SNAPSHOT_DATA", "reports.snapshot.invalid_json", null,
                    "Snapshot data must be a valid JSON object within " + MAX_SNAPSHOT_DATA_LENGTH + " characters");
        }
        try {
            JsonNode root = objectMapper.readTree(dto.getData());
            if (root == null || !root.isObject()) {
                throw new BadRequestException("INVALID_SNAPSHOT_DATA", "reports.snapshot.invalid_json", null,
                        "Snapshot data must be a JSON object");
            }
        } catch (BadRequestException e) {
            throw e;
        } catch (JsonProcessingException | RuntimeException e) {
            throw new BadRequestException("INVALID_SNAPSHOT_DATA", "reports.snapshot.invalid_json", null,
                    "Snapshot data must be a valid JSON string");
        }

        User author = currentUserId != null
                ? userRepository.findByIdAndDeletedAtIsNull(currentUserId).orElse(null)
                : null;

        ReportSnapshot snapshot = new ReportSnapshot();
        snapshot.setReportType(dto.getReportType() != null ? dto.getReportType().toLowerCase(Locale.ROOT) : "revenue");
        snapshot.setPeriodStart(dto.getPeriodStart());
        snapshot.setPeriodEnd(dto.getPeriodEnd());
        snapshot.setData(dto.getData());
        snapshot.setGeneratedBy(author);
        snapshot.setGeneratedAt(LocalDateTime.now(clock));

        ReportSnapshot saved = snapshotRepository.save(snapshot);
        return toDto(saved);
    }

    /** Các ảnh chụp báo cáo gần nhất (tối đa 100 bản ghi), mới nhất trước. */
    @Transactional(readOnly = true)
    public List<ReportSnapshotDto> getSnapshots() {
        return snapshotRepository.findAllByOrderByGeneratedAtDesc(PageRequest.of(0, MAX_SNAPSHOTS_LIST)).stream()
                .map(this::toDto)
                .toList();
    }

    /** Một ảnh chụp báo cáo theo id; không thấy thì báo 404. */
    @Transactional(readOnly = true)
    public ReportSnapshotDto getSnapshotById(Long id) {
        ReportSnapshot snapshot = snapshotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.report_snapshot", id));
        return toDto(snapshot);
    }

    /** Chuyển ảnh chụp sang DTO kèm người tạo. */
    private ReportSnapshotDto toDto(ReportSnapshot snapshot) {
        ReportSnapshotDto dto = new ReportSnapshotDto();
        dto.setId(snapshot.getId());
        dto.setReportType(snapshot.getReportType());
        dto.setPeriodStart(snapshot.getPeriodStart());
        dto.setPeriodEnd(snapshot.getPeriodEnd());
        dto.setData(snapshot.getData());
        if (snapshot.getGeneratedBy() != null) {
            dto.setGeneratedById(snapshot.getGeneratedBy().getId());
            dto.setGeneratedByName(snapshot.getGeneratedBy().getFullName());
        }
        dto.setGeneratedAt(snapshot.getGeneratedAt());
        return dto;
    }
}
