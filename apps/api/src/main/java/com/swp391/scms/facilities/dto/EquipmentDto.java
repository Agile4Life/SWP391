package com.swp391.scms.facilities.dto;

import com.swp391.scms.facilities.entity.Equipment;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Thiết bị trả cho client: tên, mã, loại, phòng, số lượng, trạng thái, ngày mua, ngày bảo trì, ghi chú và thời
 * điểm tạo/cập nhật.
 */
public record EquipmentDto(
        Long id,
        String name,
        String code,
        String category,
        Long roomId,
        String roomName,
        int quantity,
        String status,
        LocalDate purchaseDate,
        LocalDate maintenanceDate,
        String note,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    /** Chuyển entity thiết bị sang DTO. */
    public static EquipmentDto of(Equipment e) {
        return new EquipmentDto(
                e.getId(),
                e.getName(),
                e.getCode(),
                e.getCategory(),
                e.getRoom() != null ? e.getRoom().getId() : null,
                e.getRoom() != null ? e.getRoom().getName() : null,
                e.getQuantity(),
                e.getStatus(),
                e.getPurchaseDate(),
                e.getMaintenanceDate(),
                e.getNote(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}

