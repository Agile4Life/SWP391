package com.swp391.scms.facilities.dto;

import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.entity.Room;
import java.math.BigDecimal;
import java.time.LocalTime;

/**
 * Nhóm DTO phản hồi cho danh mục gốc; entity không bao giờ rời khỏi tầng service.
 */
public final class CatalogResponses {
    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private CatalogResponses() {}

    /** Bộ môn trả cho client. */
    public record DisciplineDto(Long id, String name, String description) {
        /** Chuyển entity bộ môn sang DTO. */
        public static DisciplineDto of(Discipline d) {
            return new DisciplineDto(d.getId(), d.getName(), d.getDescription());
        }
    }

    /** Phòng trả cho client: tên, vị trí, sức chứa, trạng thái, bộ môn, giờ mở/đóng và hạng. */
    public record RoomDto(Long id, String name, String location, int capacity, String status,
                          Long disciplineId, String disciplineName, LocalTime openTime, LocalTime closeTime,
                          String tier) {
        /** Constructor rút gọn (hạng mặc định STANDARD). */
        public RoomDto(Long id, String name, String location, int capacity, String status) {
            this(id, name, location, capacity, status, null, null, null, null, "STANDARD");
        }
        /** Constructor không có hạng (mặc định STANDARD). */
        public RoomDto(Long id, String name, String location, int capacity, String status,
                       Long disciplineId, String disciplineName, LocalTime openTime, LocalTime closeTime) {
            this(id, name, location, capacity, status, disciplineId, disciplineName, openTime, closeTime, "STANDARD");
        }
        /** Chuyển entity phòng sang DTO. */
        public static RoomDto of(Room r) {
            return new RoomDto(r.getId(), r.getName(), r.getLocation(), r.getCapacity(), r.getStatus(),
                    r.getDiscipline() == null ? null : r.getDiscipline().getId(),
                    r.getDiscipline() == null ? null : r.getDiscipline().getName(), r.getOpenTime(), r.getCloseTime(),
                    r.getTier() != null ? r.getTier() : "STANDARD");
        }
    }

    /** Gói tập trả cho client: tên, mô tả, giá, số ngày, hạn mức buổi lớp, trạng thái và hạng. */
    public record PackageDto(Long id, String name, String description, BigDecimal price, int durationDays,
                             Integer classCreditLimit, String status, String tier) {
        /** Constructor không có hạng (suy ra từ tên). */
        public PackageDto(Long id, String name, String description, BigDecimal price, int durationDays,
                          Integer classCreditLimit, String status) {
            this(id, name, description, price, durationDays, classCreditLimit, status, inferTier(name, null));
        }

        /** Chuyển entity gói sang DTO. */
        public static PackageDto of(MembershipPackage p) {
            return new PackageDto(p.getId(), p.getName(), p.getDescription(), p.getPrice(), p.getDurationDays(),
                    p.getClassCreditLimit(), p.getStatus(), inferTier(p.getName(), p.getTier()));
        }

        /**
         * Xác định hạng gói: dùng hạng đã lưu; không có thì suy từ tên (chứa PLATINUM/VIP là PLATINUM,
         * GOLD/STANDARD là GOLD, còn lại SILVER).
         */
        public static String inferTier(String name, String explicitTier) {
            if (explicitTier != null && !explicitTier.isBlank()) {
                return explicitTier.trim().toUpperCase();
            }
            if (name != null) {
                String upper = name.toUpperCase();
                if (upper.contains("PLATINUM") || upper.contains("VIP")) return "PLATINUM";
                if (upper.contains("GOLD") || upper.contains("STANDARD")) return "GOLD";
            }
            return "SILVER";
        }
    }
}
