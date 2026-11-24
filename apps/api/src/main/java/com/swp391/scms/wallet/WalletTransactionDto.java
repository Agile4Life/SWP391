package com.swp391.scms.wallet;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Một giao dịch ví trả cho client: loại, số tiền, số dư sau, loại/mã tham chiếu, mô tả và thời điểm. */
public record WalletTransactionDto(
        Long id,
        String type,
        BigDecimal amount,
        BigDecimal balanceAfter,
        String referenceType,
        String referenceId,
        String description,
        LocalDateTime createdAt
) {}
