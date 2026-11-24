package com.swp391.scms.finance.mapper;

import com.swp391.scms.finance.dto.InvoiceCreateDto;
import com.swp391.scms.finance.dto.InvoiceDto;
import com.swp391.scms.finance.dto.InvoiceItemCreateDto;
import com.swp391.scms.finance.dto.InvoiceItemDto;
import com.swp391.scms.finance.entity.Invoice;
import com.swp391.scms.finance.entity.InvoiceItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.util.List;

/**
 * Mapper (MapStruct tự sinh code) giữa hóa đơn/dòng hàng và DTO.
 *
 * MapStruct mapper for Invoice and InvoiceItem entities and DTOs.
 */
@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface InvoiceMapper {

    /** Chuyển hóa đơn sang DTO. */
    @Mapping(source = "payment.id", target = "paymentId")
    @Mapping(source = "items", target = "items")
    InvoiceDto toDto(Invoice entity);

    /** Chuyển danh sách hóa đơn sang DTO. */
    List<InvoiceDto> toDtoList(List<Invoice> entities);

    /** Tạo entity hóa đơn từ dữ liệu tạo mới. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "payment", ignore = true)
    @Mapping(target = "totalAmount", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "items", ignore = true)
    Invoice toEntity(InvoiceCreateDto dto);

    /** Chuyển dòng hàng sang DTO. */
    @Mapping(source = "invoice.id", target = "invoiceId")
    InvoiceItemDto toItemDto(InvoiceItem entity);

    /** Chuyển danh sách dòng hàng sang DTO. */
    List<InvoiceItemDto> toItemDtoList(List<InvoiceItem> entities);

    /** Tạo entity dòng hàng từ dữ liệu tạo mới. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "invoice", ignore = true)
    @Mapping(target = "amount", ignore = true)
    InvoiceItem toItemEntity(InvoiceItemCreateDto dto);

    /** Tạo danh sách entity dòng hàng. */
    List<InvoiceItem> toItemEntityList(List<InvoiceItemCreateDto> dtos);
}
