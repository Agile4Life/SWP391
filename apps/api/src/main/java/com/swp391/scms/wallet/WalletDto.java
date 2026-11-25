package com.swp391.scms.wallet;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Ví trả cho client: số dư, thời điểm cập nhật và các giao dịch gần nhất. */
public record WalletDto(
        BigDecimal balance,
        LocalDateTime updatedAt,
        List<WalletTransactionDto> transactions
) {}
