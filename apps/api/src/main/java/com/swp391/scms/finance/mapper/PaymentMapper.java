package com.swp391.scms.finance.mapper;

import com.swp391.scms.finance.dto.PaymentCreateDto;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.finance.entity.Payment;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.util.List;

/**
 * Mapper (MapStruct tự sinh code) giữa entity Payment và các DTO tương ứng.
 */
@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface PaymentMapper {

    /** Chuyển khoản thanh toán sang DTO. */
    @Mapping(source = "member.userId", target = "memberId")
    @Mapping(source = "member.user.fullName", target = "memberName")
    @Mapping(source = "receivedBy.id", target = "receivedById")
    @Mapping(source = "receivedBy.fullName", target = "receivedByName")
    @Mapping(source = "invoice.invoiceNumber", target = "invoiceNumber")
    @Mapping(target = "hasReceipt", expression = "java(entity.getReceiptImage() != null && !entity.getReceiptImage().isBlank())")
    @Mapping(target = "receiptImage", ignore = true)
    @Mapping(target = "serviceType", ignore = true)
    @Mapping(target = "serviceName", ignore = true)
    @Mapping(target = "vnpayPending", ignore = true)
    PaymentDto toDto(Payment entity);

    /** Chuyển danh sách khoản thanh toán sang DTO. */
    List<PaymentDto> toDtoList(List<Payment> entities);

    /** Tạo entity khoản thanh toán từ dữ liệu tạo mới. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "member", ignore = true)
    @Mapping(target = "receivedBy", ignore = true)
    @Mapping(target = "invoice", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "refundedAmount", ignore = true)
    Payment toEntity(PaymentCreateDto dto);

    /** Cập nhật entity từ DTO (chỉ các trường cho phép). */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "member", ignore = true)
    @Mapping(target = "receivedBy", ignore = true)
    @Mapping(target = "invoice", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "refundedAmount", ignore = true)
    @Mapping(target = "receiptImage", ignore = true)
    @Mapping(target = "coachBookingId", ignore = true)
    @Mapping(target = "productOrderId", ignore = true)
    void updateEntityFromDto(PaymentDto dto, @MappingTarget Payment entity);
}
