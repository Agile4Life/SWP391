package com.swp391.scms.shop.service;

import com.swp391.scms.common.exception.AppException;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.shop.dto.AddressDtos.AddressDto;
import com.swp391.scms.shop.dto.AddressDtos.AddressRequest;
import com.swp391.scms.shop.entity.MemberAddress;
import com.swp391.scms.shop.repository.MemberAddressRepository;
import com.swp391.scms.shop.service.GeoService.ResolvedRegion;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Quản lý sổ địa chỉ giao hàng của hội viên (tối đa 5 địa chỉ, luôn có một địa chỉ mặc định) và tạo snapshot
 * địa chỉ cho đơn hàng.
 */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@Service
@Transactional(readOnly = true)
public class AddressService {
    public static final int MAX_ADDRESSES = 5;
    private static final Pattern PHONE_PATTERN = Pattern.compile("^(0|\\+84)(3|5|7|8|9)\\d{8}$");

    /**
     * Bản chụp địa chỉ giao hàng lưu vào đơn: người nhận, số điện thoại, tỉnh, phường, địa chỉ chi tiết và ghi
     * chú.
     */
    public record ShippingSnapshot(
            String recipientName,
            String phone,
            String provinceName,
            String wardName,
            String streetLine,
            String note
    ) {}

    private final MemberAddressRepository addresses;
    private final MemberRepository members;
    private final GeoService geo;

    /** Khởi tạo với repository địa chỉ, hội viên và GeoService. */
    public AddressService(MemberAddressRepository addresses, MemberRepository members, GeoService geo) {
        this.addresses = addresses;
        this.members = members;
        this.geo = geo;
    }

    /** Danh sách địa chỉ của hội viên: mặc định trước, sau đó mới nhất trước. */
    public List<AddressDto> list(Long userId) {
        return addresses.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(userId).stream()
                .map(AddressService::toDto)
                .toList();
    }

    /** Thêm địa chỉ mới; đã đủ 5 địa chỉ thì báo lỗi ADDRESS_LIMIT_REACHED. */
    @Transactional
    public AddressDto create(Long userId, AddressRequest request) {
        Member member = lockActiveMember(userId);
        List<MemberAddress> existing = new ArrayList<>(
                addresses.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(userId));
        if (existing.size() >= MAX_ADDRESSES) {
            throw new ConflictException("ADDRESS_LIMIT_REACHED", "error.shop.address_limit_reached", null, "Address limit reached");
        }
        return saveNewAddress(member, existing, request);
    }

    /** Thêm địa chỉ nếu còn chỗ (dùng khi đặt hàng có chọn lưu địa chỉ); đủ 5 thì trả rỗng, không báo lỗi. */
    @Transactional
    public Optional<AddressDto> createIfRoom(Long userId, AddressRequest request) {
        Member member = lockActiveMember(userId);
        List<MemberAddress> existing = new ArrayList<>(
                addresses.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(userId));
        if (existing.size() >= MAX_ADDRESSES) {
            return Optional.empty();
        }
        return Optional.of(saveNewAddress(member, existing, request));
    }

    /**
     * Cập nhật địa chỉ của hội viên: kiểm tra dữ liệu, tra cứu tỉnh/phường và đặt làm mặc định nếu được yêu
     * cầu.
     */
    @Transactional
    public AddressDto update(Long userId, Long id, AddressRequest request) {
        lockActiveMember(userId);
        List<MemberAddress> existing = new ArrayList<>(
                addresses.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(userId));
        MemberAddress target = existing.stream()
                .filter(a -> Objects.equals(a.getId(), id))
                .findFirst()
                .orElseGet(() -> addresses.findByIdAndMember_UserId(id, userId).orElseThrow(AddressService::notFound));

        validateFields(request);
        ResolvedRegion region = resolveRegion(request.provinceCode(), request.wardCode());
        applyFields(target, request, region);

        if (request.makeDefault() && !target.isDefault()) {
            for (MemberAddress other : existing) {
                if (!Objects.equals(other.getId(), target.getId()) && other.isDefault()) {
                    other.setDefault(false);
                    addresses.save(other);
                }
            }
            target.setDefault(true);
        }
        MemberAddress saved = addresses.save(target);
        return toDto(saved);
    }

    /** Đặt một địa chỉ làm mặc định và bỏ mặc định các địa chỉ khác; trả về danh sách mới. */
    @Transactional
    public List<AddressDto> makeDefault(Long userId, Long id) {
        lockActiveMember(userId);
        List<MemberAddress> existing = new ArrayList<>(
                addresses.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(userId));
        MemberAddress target = existing.stream()
                .filter(a -> Objects.equals(a.getId(), id))
                .findFirst()
                .orElseThrow(AddressService::notFound);

        for (MemberAddress addr : existing) {
            boolean shouldBeDefault = Objects.equals(addr.getId(), target.getId());
            if (addr.isDefault() != shouldBeDefault) {
                addr.setDefault(shouldBeDefault);
                addresses.save(addr);
            }
        }
        existing.sort(Comparator.comparing(MemberAddress::isDefault).reversed()
                .thenComparing(MemberAddress::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(MemberAddress::getId, Comparator.nullsLast(Comparator.reverseOrder())));
        return existing.stream().map(AddressService::toDto).toList();
    }

    /** Xóa địa chỉ; nếu xóa địa chỉ mặc định thì địa chỉ mới nhất còn lại trở thành mặc định. */
    @Transactional
    public List<AddressDto> delete(Long userId, Long id) {
        lockActiveMember(userId);
        List<MemberAddress> existing = new ArrayList<>(
                addresses.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(userId));
        MemberAddress target = existing.stream()
                .filter(a -> Objects.equals(a.getId(), id))
                .findFirst()
                .orElseThrow(AddressService::notFound);

        existing.remove(target);
        addresses.delete(target);

        if (target.isDefault() && !existing.isEmpty()) {
            existing.sort(Comparator.comparing(MemberAddress::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(MemberAddress::getId, Comparator.nullsLast(Comparator.reverseOrder())));
            MemberAddress promoted = existing.getFirst();
            promoted.setDefault(true);
            addresses.save(promoted);
        }
        existing.sort(Comparator.comparing(MemberAddress::isDefault).reversed()
                .thenComparing(MemberAddress::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(MemberAddress::getId, Comparator.nullsLast(Comparator.reverseOrder())));
        return existing.stream().map(AddressService::toDto).toList();
    }

    /** Chụp địa chỉ đã lưu của hội viên để ghi vào đơn; không tìm thấy thì báo lỗi. */
    public ShippingSnapshot snapshot(Long userId, Long addressId) {
        if (addressId == null) {
            throw notFound();
        }
        MemberAddress addr = addresses.findByIdAndMember_UserId(addressId, userId)
                .orElseGet(() -> addresses.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(userId).stream()
                        .filter(a -> Objects.equals(a.getId(), addressId))
                        .findFirst()
                        .orElseThrow(AddressService::notFound));
        return new ShippingSnapshot(
                addr.getRecipientName(),
                addr.getPhone(),
                addr.getProvinceName(),
                addr.getWardName(),
                addr.getStreetLine(),
                addr.getNote()
        );
    }

    /** Chụp địa chỉ nhập mới (chưa lưu) để ghi vào đơn sau khi kiểm tra dữ liệu và tra cứu tỉnh/phường. */
    public ShippingSnapshot snapshot(AddressRequest request) {
        validateFields(request);
        ResolvedRegion region = resolveRegion(request.provinceCode(), request.wardCode());
        return new ShippingSnapshot(
                request.recipientName().trim(),
                normalizePhone(request.phone()),
                region.provinceName(),
                region.wardName(),
                request.streetLine().trim(),
                normalizeNote(request.note())
        );
    }

    /** Lưu địa chỉ mới; địa chỉ đầu tiên hoặc được yêu cầu sẽ thành mặc định (bỏ mặc định các địa chỉ khác). */
    private AddressDto saveNewAddress(Member member, List<MemberAddress> existing, AddressRequest request) {
        validateFields(request);
        ResolvedRegion region = resolveRegion(request.provinceCode(), request.wardCode());
        boolean makeDefault = existing.isEmpty() || request.makeDefault();
        if (makeDefault) {
            for (MemberAddress other : existing) {
                if (other.isDefault()) {
                    other.setDefault(false);
                    addresses.save(other);
                }
            }
        }
        MemberAddress entity = new MemberAddress();
        entity.setMember(member);
        applyFields(entity, request, region);
        entity.setDefault(makeDefault);
        MemberAddress saved = addresses.save(entity);
        return toDto(saved);
    }

    /** Gán dữ liệu từ yêu cầu vào entity (chuẩn hóa số điện thoại, ghi chú và tên tỉnh/phường). */
    private void applyFields(MemberAddress entity, AddressRequest request, ResolvedRegion region) {
        entity.setRecipientName(request.recipientName().trim());
        entity.setPhone(normalizePhone(request.phone()));
        entity.setProvinceCode(region.provinceCode());
        entity.setProvinceName(region.provinceName());
        entity.setWardCode(region.wardCode());
        entity.setWardName(region.wardName());
        entity.setStreetLine(request.streetLine().trim());
        entity.setNote(normalizeNote(request.note()));
    }

    /** Tra cứu cặp mã tỉnh–phường; thiếu hoặc không hợp lệ thì báo lỗi ADDRESS_INVALID_REGION. */
    private ResolvedRegion resolveRegion(String provinceCode, String wardCode) {
        if (provinceCode == null || wardCode == null) {
            throw new BadRequestException("ADDRESS_INVALID_REGION", "error.shop.address_invalid_region", null, "Invalid province or ward");
        }
        return geo.resolve(provinceCode.trim(), wardCode.trim())
                .orElseThrow(() -> new BadRequestException("ADDRESS_INVALID_REGION", "error.shop.address_invalid_region", null, "Invalid province or ward"));
    }

    /**
     * Kiểm tra người nhận 2–80 ký tự, số điện thoại Việt Nam hợp lệ, địa chỉ 5–200 ký tự và ghi chú tối đa 200
     * ký tự.
     */
    private static void validateFields(AddressRequest request) {
        if (request == null
                || request.recipientName() == null
                || request.recipientName().trim().length() < 2
                || request.recipientName().trim().length() > 80
                || request.phone() == null
                || !PHONE_PATTERN.matcher(request.phone().trim()).matches()
                || request.streetLine() == null
                || request.streetLine().trim().length() < 5
                || request.streetLine().trim().length() > 200
                || (request.note() != null && request.note().length() > 200)) {
            throw new BadRequestException("FULFILLMENT_INVALID", "error.shop.fulfillment_invalid", null, "Invalid address details");
        }
    }

    /** Chuẩn hóa số điện thoại: đổi tiền tố +84 thành 0. */
    public static String normalizePhone(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.startsWith("+84")) {
            return "0" + trimmed.substring(3);
        }
        return trimmed;
    }

    /** Chuẩn hóa ghi chú: rỗng thành null, còn lại bỏ khoảng trắng hai đầu. */
    private static String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.trim();
    }

    /** Lấy và khóa dòng hội viên chưa bị xóa; không có thì báo chỉ hội viên được dùng shop. */
    private Member lockActiveMember(Long userId) {
        return members.findByUserIdForUpdate(userId)
                .filter(m -> m.getUser() == null || m.getUser().getDeletedAt() == null)
                .orElseThrow(() -> new ForbiddenException("SHOP_MEMBER_REQUIRED", "error.shop.member_required", null, "Members only"));
    }

    /** Chuyển entity địa chỉ sang DTO. */
    private static AddressDto toDto(MemberAddress a) {
        return new AddressDto(
                a.getId(),
                a.getRecipientName(),
                a.getPhone(),
                a.getProvinceCode(),
                a.getProvinceName(),
                a.getWardCode(),
                a.getWardName(),
                a.getStreetLine(),
                a.getNote(),
                a.isDefault()
        );
    }

    /** Tạo lỗi 404 khi không tìm thấy địa chỉ. */
    private static AppException notFound() {
        return new AppException(HttpStatus.NOT_FOUND, "ADDRESS_NOT_FOUND", "error.shop.address_not_found", null, "Address not found");
    }
}
