package com.swp391.scms.users;

import com.swp391.scms.users.entity.Member;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dọn dữ liệu một lần (chạy lại an toàn): số CCCD/hộ chiếu cũ còn lưu dạng chữ rõ được mã hóa, và cột đọc được
 * thay bằng dạng che (********1234).
 *
 * One-time, idempotent cleanup: identity numbers stored in the clear before encryption existed are encrypted and the
 * readable column is replaced by its masked form.
 */
@Component
@Order(60)
public class KycBackfill implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(KycBackfill.class);
    private final MemberRepository members;
    private final KycCrypto crypto;

    /** Nhận repository hội viên và bộ mã hóa KycCrypto. */
    public KycBackfill(MemberRepository members, KycCrypto crypto) {
        this.members = members;
        this.crypto = crypto;
    }

    /** Duyệt mọi hội viên, mã hóa số giấy tờ chưa được che rồi lưu dạng che; ghi log số bản ghi đã chuyển. */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int converted = 0;
        for (Member member : members.findAll()) {
            String value = member.getCitizenId();
            if (value == null || value.isBlank() || KycCrypto.isMasked(value)) continue;
            member.setCitizenIdEncrypted(crypto.encrypt(value));
            member.setCitizenId(KycCrypto.mask(value));
            members.save(member);
            converted++;
        }
        if (converted > 0) log.info("[Kyc] encrypted {} identity number(s) that were stored in the clear", converted);
    }
}
