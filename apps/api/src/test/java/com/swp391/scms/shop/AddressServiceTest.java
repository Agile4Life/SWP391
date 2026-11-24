package com.swp391.scms.shop;

import com.swp391.scms.shop.dto.AddressDtos.AddressRequest;
import com.swp391.scms.shop.entity.MemberAddress;
import com.swp391.scms.shop.repository.MemberAddressRepository;
import com.swp391.scms.shop.service.AddressService;
import com.swp391.scms.shop.service.GeoService;
import com.swp391.scms.shop.service.GeoService.ResolvedRegion;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho service AddressService (address service). */
class AddressServiceTest {
    MemberAddressRepository repo;
    MemberRepository members;
    GeoService geo;
    AddressService service;

    /** Chuẩn bị trước mỗi test: tạo AddressService với repository giả lập. */
    @BeforeEach
    void setup() {
        repo = mock(MemberAddressRepository.class);
        members = mock(MemberRepository.class);
        geo = mock(GeoService.class);
        service = new AddressService(repo, members, geo);

        User u = new User();
        u.setId(1L);
        Member m = new Member();
        m.setUserId(1L);
        m.setUser(u);
        when(members.findByUserIdForUpdate(1L)).thenReturn(Optional.of(m));
        when(geo.resolve("79", "26740")).thenReturn(
                Optional.of(new ResolvedRegion("79", "Thành phố Hồ Chí Minh", "26740", "Phường Sài Gòn")));
        when(repo.save(any(MemberAddress.class))).thenAnswer(inv -> {
            MemberAddress a = inv.getArgument(0);
            if (a.getId() == null) {
                a.setId(100L);
            }
            return a;
        });
    }

    /** Hàm trợ giúp của test: tạo request địa chỉ mẫu. */
    static AddressRequest req(String province, String ward) {
        return new AddressRequest("Nguyễn An", "0901234567", province, ward, "12 Lê Lợi", null, false);
    }

    /** Kiểm thử: địa chỉ đầu tiên thành mặc định và địa chỉ thứ sáu bị từ chối. */
    @Test
    void firstAddressBecomesDefaultAndSixthIsRejected() {
        when(repo.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(1L)).thenReturn(List.of());
        var first = service.create(1L, req("79", "26740"));
        assertThat(first.isDefault()).isTrue();
        assertThat(first.provinceName()).isEqualTo("Thành phố Hồ Chí Minh");
        assertThat(first.wardName()).isEqualTo("Phường Sài Gòn");

        List<MemberAddress> five = new ArrayList<>();
        for (long i = 1; i <= 5; i++) {
            MemberAddress a = new MemberAddress();
            a.setId(i);
            five.add(a);
        }
        when(repo.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(1L)).thenReturn(five);
        assertThatThrownBy(() -> service.create(1L, req("79", "26740")))
                .hasFieldOrPropertyWithValue("errorCode", "ADDRESS_LIMIT_REACHED");
        assertThat(service.createIfRoom(1L, req("79", "26740"))).isEmpty();
    }

    /** Kiểm thử: mã vùng được phân giải từ danh mục đi kèm. */
    @Test
    void regionCodesAreResolvedFromTheBundledCatalogue() {
        when(geo.resolve("79", "26734")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.create(1L, req("79", "26734")))
                .hasFieldOrPropertyWithValue("errorCode", "ADDRESS_INVALID_REGION");
    }

    /** Kiểm thử: xóa địa chỉ mặc định thì địa chỉ mới nhất còn lại lên thay. */
    @Test
    void deletingDefaultPromotesNewestRemaining() {
        MemberAddress def = new MemberAddress();
        def.setId(1L);
        def.setDefault(true);
        def.setCreatedAt(LocalDateTime.of(2026, 11, 1, 10, 0));

        MemberAddress newer = new MemberAddress();
        newer.setId(3L);
        newer.setDefault(false);
        newer.setCreatedAt(LocalDateTime.of(2026, 11, 4, 10, 0));

        MemberAddress older = new MemberAddress();
        older.setId(2L);
        older.setDefault(false);
        older.setCreatedAt(LocalDateTime.of(2026, 11, 2, 10, 0));

        when(repo.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(1L))
                .thenReturn(List.of(def, newer, older));

        var remaining = service.delete(1L, 1L);
        assertThat(remaining).hasSize(2);
        assertThat(remaining.getFirst().id()).isEqualTo(3L);
        assertThat(remaining.getFirst().isDefault()).isTrue();
    }

    /** Kiểm thử: địa chỉ của hội viên khác bị coi là không tìm thấy. */
    @Test
    void anotherMembersAddressIsNotFound() {
        when(repo.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(1L)).thenReturn(List.of());
        when(repo.findByIdAndMember_UserId(99L, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.delete(1L, 99L))
                .hasFieldOrPropertyWithValue("errorCode", "ADDRESS_NOT_FOUND");
    }

    /** Kiểm thử: số điện thoại được chuẩn hóa về dạng bắt đầu bằng 0. */
    @Test
    void phoneIsNormalisedTo0Prefix() {
        when(repo.findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(1L)).thenReturn(List.of());
        var created = service.create(1L, new AddressRequest(
                "Nguyễn An", "+84901234567", "79", "26740", "12 Lê Lợi", "Gọi trước", true));
        assertThat(created.phone()).isEqualTo("0901234567");
    }
}
