package com.swp391.scms.reports.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record RecentTransactionDto(Long id, String invoiceNumber, String memberName,
                                   String packageName, BigDecimal amount, String method,
                                   LocalDateTime paidAt) {
}
