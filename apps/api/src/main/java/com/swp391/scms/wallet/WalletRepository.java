package com.swp391.scms.wallet;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/** Truy cập bảng wallets. */
@Repository
public interface WalletRepository extends JpaRepository<Wallet, Long> {

    /** Tìm các bản ghi có user_Id = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<Wallet> findByUser_Id(Long userId);

    /** Lấy ví của người dùng và khóa dòng để ghi, để hai giao dịch đồng thời không làm sai số dư. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Wallet w where w.user.id = :userId")
    Optional<Wallet> findByUserIdForUpdate(@Param("userId") Long userId);
}
