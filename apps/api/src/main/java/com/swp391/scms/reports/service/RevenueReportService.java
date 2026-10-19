package com.swp391.scms.reports.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.reports.dto.DailyRevenueDto;
import com.swp391.scms.reports.dto.RecentTransactionDto;
import com.swp391.scms.reports.repository.TransactionReportRepository;
import org.springframework.data.domain.PageRequest;
import com.swp391.scms.reports.dto.PackageRevenueDto;
import com.swp391.scms.reports.dto.ReportSnapshotCreateDto;
import com.swp391.scms.reports.dto.ReportSnapshotDto;
import com.swp391.scms.reports.entity.ReportSnapshot;
import com.swp391.scms.reports.repository.ReportSnapshotRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class RevenueReportService {

    private final PaymentRepository paymentRepository;
    private final MembershipSubscriptionRepository subscriptionRepository;
    private final ReportSnapshotRepository snapshotRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionReportRepository transactionReportRepository;

    public RevenueReportService(PaymentRepository paymentRepository,
                                MembershipSubscriptionRepository subscriptionRepository,
                                ReportSnapshotRepository snapshotRepository,
                                UserRepository userRepository,
                                ObjectMapper objectMapper,
                                Clock clock,
                                TransactionReportRepository transactionReportRepository) {
        this.paymentRepository = paymentRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.snapshotRepository = snapshotRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.transactionReportRepository = transactionReportRepository;
    }

    @Transactional(readOnly = true)
    public List<RecentTransactionDto> getRecentTransactions(LocalDate startDate, LocalDate endDate) {
        LocalDate start = startDate != null ? startDate : LocalDate.now(clock).minusDays(30);
        LocalDate end = endDate != null ? endDate : LocalDate.now(clock);
        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "reports.revenue.invalid_date_range", null,
                    "Start date cannot be after end date");
        }
        return transactionReportRepository.findRecentTransactions(
                start.atStartOfDay(), end.plusDays(1).atStartOfDay(), PageRequest.of(0, 10));
    }

    @Transactional(readOnly = true)
    public List<DailyRevenueDto> getDailyRevenue(LocalDate startDate, LocalDate endDate) {
        LocalDate start = (startDate != null) ? startDate : LocalDate.now(clock).minusDays(30);
        LocalDate end = (endDate != null) ? endDate : LocalDate.now(clock);

        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "reports.revenue.invalid_date_range", null,
                    "Start date cannot be after end date");
        }

        List<Payment> payments = paymentRepository.findByStatusAndPaidAtBetween("success",
                start.atStartOfDay(), end.atTime(23, 59, 59));

        Map<LocalDate, List<Payment>> byDate = payments.stream()
                .filter(p -> p.getPaidAt() != null)
                .collect(Collectors.groupingBy(p -> p.getPaidAt().toLocalDate()));

        List<DailyRevenueDto> result = new ArrayList<>();
        LocalDate cur = start;
        while (!cur.isAfter(end)) {
            List<Payment> list = byDate.getOrDefault(cur, Collections.emptyList());
            BigDecimal sum = list.stream()
                    .map(Payment::getAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            result.add(new DailyRevenueDto(cur, sum, list.size()));
            cur = cur.plusDays(1);
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<PackageRevenueDto> getRevenueByPackage(LocalDate startDate, LocalDate endDate) {
        LocalDate start = (startDate != null) ? startDate : LocalDate.now(clock).minusDays(30);
        LocalDate end = (endDate != null) ? endDate : LocalDate.now(clock);

        if (start.isAfter(end)) {
            throw new BadRequestException("INVALID_DATE_RANGE", "reports.revenue.invalid_date_range", null,
                    "Start date cannot be after end date");
        }

        List<Payment> payments = paymentRepository.findByStatusAndPaidAtBetween("success",
                start.atStartOfDay(), end.atTime(23, 59, 59));

        Map<Long, BigDecimal> revenueMap = new HashMap<>();
        Map<Long, Integer> countMap = new HashMap<>();
        Map<Long, String> nameMap = new HashMap<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;

        for (Payment payment : payments) {
            if (payment.getSubscriptionId() != null && subscriptionRepository != null) {
                Optional<MembershipSubscription> subOpt = subscriptionRepository.findById(payment.getSubscriptionId());
                if (subOpt.isPresent() && subOpt.get().getMembershipPackage() != null) {
                    MembershipPackage pkg = subOpt.get().getMembershipPackage();
                    Long pkgId = pkg.getId();
                    String pkgName = pkg.getName();
                    BigDecimal amount = payment.getAmount() != null ? payment.getAmount() : BigDecimal.ZERO;

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

    public ReportSnapshotDto generateSnapshot(ReportSnapshotCreateDto dto, Long currentUserId) {
        if (dto.getPeriodStart() != null && dto.getPeriodEnd() != null && dto.getPeriodStart().isAfter(dto.getPeriodEnd())) {
            throw new BadRequestException("INVALID_DATE_RANGE", "reports.revenue.invalid_date_range", null,
                    "Start date cannot be after end date");
        }
        try {
            objectMapper.readTree(dto.getData());
        } catch (JsonProcessingException | RuntimeException e) {
            throw new BadRequestException("INVALID_SNAPSHOT_DATA", "reports.snapshot.invalid_json", null,
                    "Snapshot data must be a valid JSON string");
        }

        Long authorId = dto.getGeneratedById() != null ? dto.getGeneratedById() : currentUserId;
        User author = null;
        if (authorId != null) {
            author = userRepository.findByIdAndDeletedAtIsNull(authorId).orElse(null);
        }

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

    @Transactional(readOnly = true)
    public List<ReportSnapshotDto> getSnapshots() {
        return snapshotRepository.findAllByOrderByGeneratedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public ReportSnapshotDto getSnapshotById(Long id) {
        ReportSnapshot snapshot = snapshotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.report_snapshot", id));
        return toDto(snapshot);
    }

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
