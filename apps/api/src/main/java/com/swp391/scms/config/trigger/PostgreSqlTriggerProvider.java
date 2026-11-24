package com.swp391.scms.config.trigger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Cài trigger cho PostgreSQL: sửa vài ràng buộc cũ, rồi chạy file db/triggers/postgresql-triggers.sql chứa toàn
 * bộ trigger bắt buộc (sức chứa, trùng lịch, gói còn hiệu lực...).
 */
@Component
public class PostgreSqlTriggerProvider implements DatabaseTriggerProvider {

    private static final Logger log = LoggerFactory.getLogger(PostgreSqlTriggerProvider.class);
    private final boolean auditEntityTypeUpgradeEnabled;

    /** Constructor cho test: luôn bật bước nâng cấp CHECK của bảng audit. */
    public PostgreSqlTriggerProvider() {
        this(true);
    }

    /**
     * Constructor Spring dùng: đọc cờ app.database.audit-entity-type-upgrade-enabled để bật/tắt bước nâng cấp
     * CHECK audit.
     */
    @org.springframework.beans.factory.annotation.Autowired
    public PostgreSqlTriggerProvider(
            @org.springframework.beans.factory.annotation.Value("${app.database.audit-entity-type-upgrade-enabled:true}")
            boolean auditEntityTypeUpgradeEnabled) {
        this.auditEntityTypeUpgradeEnabled = auditEntityTypeUpgradeEnabled;
    }

    /** Hỗ trợ khi tên database có chứa "postgresql". */
    @Override
    public boolean supports(String databaseProductName) {
        return databaseProductName != null && databaseProductName.toLowerCase().contains("postgresql");
    }

    /**
     * Thứ tự: bỏ NOT NULL cũ của check-in, nâng cấp CHECK audit (lỗi bước này chỉ ghi log, không chặn khởi
     * động), rồi chạy script trigger. Thiếu script hoặc cài trigger lỗi thì dừng khởi động.
     */
    @Override
    public void applyTriggers(JdbcTemplate jdbcTemplate) {
        CenterCheckinSchemaUpgrade.relaxMemberNullability(jdbcTemplate);
        if (auditEntityTypeUpgradeEnabled) {
            try {
                AuditEntityTypeSchemaUpgrade.allowCoachBookings(jdbcTemplate);
            } catch (RuntimeException failure) {
                // Không bao giờ chặn khởi động vì CHECK của audit: chỉ các thao tác ghi điểm danh 1:1 có audit
                // mới phụ thuộc vào nó.
                log.error("Could not widen the audit entity-type CHECK for coach_bookings; 1:1 attendance changes "
                        + "will fail until it is fixed", failure);
            }
        } else {
            log.info("Audit entity-type CHECK upgrade turned off by app.database.audit-entity-type-upgrade-enabled.");
        }
        // Script trigger nằm trong resources; thiếu file là lỗi cấu hình nghiêm trọng.
        ClassPathResource resource = new ClassPathResource("db/triggers/postgresql-triggers.sql");
        if (!resource.exists()) {
            throw new IllegalStateException("Mandatory PostgreSQL trigger script is missing");
        }
        try (InputStream is = resource.getInputStream()) {
            jdbcTemplate.execute(new String(is.readAllBytes(), StandardCharsets.UTF_8));
            log.info("PostgreSQL invariant triggers installed.");
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read PostgreSQL trigger script", e);
        } catch (DataAccessException e) {
            throw new IllegalStateException("Cannot install mandatory PostgreSQL triggers", e);
        }
    }
}
