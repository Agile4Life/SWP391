package com.swp391.scms.reports.repository;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.reports.dto.RecentTransactionDto;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Truy vấn báo cáo trên bảng thanh toán (chỉ đọc, tổng hợp trực tiếp tại DB để tránh nạp ảnh biên lai). */
public interface TransactionReportRepository extends Repository<Payment, Long> {

    /** Một dòng doanh thu thực thu theo ngày từ câu truy vấn tổng hợp. */
    interface DailyRevenueRow {
        LocalDate getPaidDate();
        BigDecimal getRevenue();
        Long getTransactionCount();
    }

    /** Một dòng doanh thu thực thu theo gói tập từ câu truy vấn tổng hợp. */
    interface PackageRevenueRow {
        Long getPackageId();
        String getPackageName();
        BigDecimal getRevenue();
        Long getSubscriptionCount();
    }

    @Query("""
            select new com.swp391.scms.reports.dto.RecentTransactionDto(
                p.id,
                i.invoiceNumber,
                u.fullName,
                u.email,
                u.phone,
                case
                    when pkg.name is not null then pkg.name
                    when c.name is not null then c.name
                    when cb.id is not null and d.name is not null then concat('PT 1:1 - ', d.name)
                    when cb.id is not null then 'PT 1:1'
                    else null
                end,
                p.amount,
                p.refundedAmount,
                p.method,
                p.paidAt
            )
            from Payment p
            join p.member m join m.user u
            left join p.invoice i
            left join p.subscription s left join s.membershipPackage pkg
            left join p.classEnrollment e left join e.gymClass c
            left join p.coachBooking cb left join cb.discipline d
            where p.status = 'success'
                and (p.note is null or p.note not like 'WALLET_TOPUP%')
                and p.paidAt >= :start and p.paidAt < :endExclusive
            order by p.paidAt desc, p.id desc
            """)
    /**
     * Các giao dịch thành công trong khoảng nửa mở [start, endExclusive), bỏ qua nạp ví (chỉ là chuyển tiền vào
     * ví), mới nhất trước, có phân trang; kèm số hóa đơn và tên gói/lớp/PT 1:1.
     */
    List<RecentTransactionDto> findRecentTransactions(@Param("start") LocalDateTime start,
                                                      @Param("endExclusive") LocalDateTime endExclusive,
                                                      Pageable pageable);

    @Query("""
            select cast(p.paidAt as LocalDate) as paidDate,
                   sum(case when p.refundedAmount is null then p.amount else p.amount - p.refundedAmount end) as revenue,
                   count(p.id) as transactionCount
            from Payment p
            where p.status = 'success'
              and p.paidAt is not null
              and (p.note is null or p.note not like 'WALLET_TOPUP%')
              and p.paidAt >= :start and p.paidAt < :endExclusive
            group by cast(p.paidAt as LocalDate)
            order by cast(p.paidAt as LocalDate) asc
            """)
    /** Tổng hợp doanh thu thực thu và số giao dịch theo từng ngày trong khoảng nửa mở [start, endExclusive). */
    List<DailyRevenueRow> findDailyRevenue(@Param("start") LocalDateTime start,
                                           @Param("endExclusive") LocalDateTime endExclusive);

    @Query("""
            select pkg.id as packageId,
                   pkg.name as packageName,
                   sum(case when p.refundedAmount is null then p.amount else p.amount - p.refundedAmount end) as revenue,
                   count(p.id) as subscriptionCount
            from Payment p
            join p.subscription s
            join s.membershipPackage pkg
            where p.status = 'success'
              and p.paidAt is not null
              and (p.note is null or p.note not like 'WALLET_TOPUP%')
              and p.paidAt >= :start and p.paidAt < :endExclusive
            group by pkg.id, pkg.name
            order by sum(case when p.refundedAmount is null then p.amount else p.amount - p.refundedAmount end) desc, pkg.id asc
            """)
    /** Tổng hợp doanh thu thực thu và số lượt mua theo từng gói tập trong khoảng nửa mở [start, endExclusive). */
    List<PackageRevenueRow> findRevenueByPackage(@Param("start") LocalDateTime start,
                                                 @Param("endExclusive") LocalDateTime endExclusive);
}
