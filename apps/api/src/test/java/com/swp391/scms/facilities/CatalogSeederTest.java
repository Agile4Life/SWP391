package com.swp391.scms.facilities;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.scms.facilities.dto.CatalogResponses.DisciplineDto;
import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.dto.CatalogResponses.RoomDto;
import com.swp391.scms.facilities.service.DisciplineService;
import com.swp391.scms.facilities.service.PackageService;
import com.swp391.scms.facilities.service.RoomService;
import com.swp391.scms.facilities.repository.EquipmentRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.facilities.entity.Room;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Bộ kiểm thử cho bộ khởi tạo dữ liệu CatalogSeeder (catalog seeder). */
@ExtendWith(MockitoExtension.class)
class CatalogSeederTest {

    @Mock DisciplineService disciplines;
    @Mock RoomService rooms;
    @Mock PackageService packages;
    @Mock EquipmentRepository equipmentRepository;
    @Mock RoomRepository roomRepository;
    @InjectMocks CatalogSeeder seeder;

    /** Kiểm thử: thiết bị đã có không phải là đích seed. */
    @BeforeEach
    void existingEquipmentIsNotASeedTarget() {
        org.springframework.test.util.ReflectionTestUtils.setField(seeder, "equipmentRepository", equipmentRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(seeder, "roomRepository", roomRepository);
        org.mockito.Mockito.lenient().when(equipmentRepository.count()).thenReturn(1L);
    }

    /** Kiểm thử: không tạo lại thiết bị demo đã xóa trong kho đã có. */
    @Test
    void doesNotRecreateDeletedDemoEquipmentInAnExistingInventory() {
        org.mockito.Mockito.lenient().when(roomRepository.findAll()).thenReturn(List.of(
                namedRoom("Phòng Gym Tiêu chuẩn"), namedRoom("Phòng Gym VIP")));

        seeder.run(null);

        verify(equipmentRepository, never()).save(any());
    }

    /** Kiểm thử: seed kho trống vào các phòng gym đã đặt tên. */
    @Test
    void seedsAnEmptyInventoryIntoExistingNamedGymRooms() {
        when(equipmentRepository.count()).thenReturn(0L);
        when(rooms.list()).thenReturn(List.of(
                new RoomDto(1L, "Phòng Gym Tiêu chuẩn", "Tầng 1", 50, "available", null, null, null, null, "STANDARD"),
                new RoomDto(2L, "Phòng Gym VIP", "Tầng 2", 25, "available", null, null, null, null, "PLATINUM"),
                new RoomDto(3L, "Zen Garden Studio", "Penthouse", 18, "available", null, null, null, null, "STANDARD"),
                new RoomDto(4L, "Ring Arena 01", "Level 1 - East Wing", 14, "available", null, null, null, null, "STANDARD"),
                new RoomDto(5L, "Oasis Lap Pool", "Sub-level Oasis", 20, "available", null, null, null, null, "STANDARD"),
                new RoomDto(6L, "Sân Tennis 01", "Khu thể thao ngoài trời - Sân A", 8, "available", null, null, null, null, "STANDARD"),
                new RoomDto(7L, "Sân Cầu lông 01", "Nhà thi đấu - Tầng 1", 8, "available", null, null, null, null, "STANDARD")));
        when(roomRepository.findAll()).thenReturn(List.of(
                namedRoom("Phòng Gym Tiêu chuẩn"), namedRoom("Phòng Gym VIP")));

        seeder.run(null);

        var equipment = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.entity.Equipment.class);
        verify(equipmentRepository, times(7)).save(equipment.capture());
        org.assertj.core.api.Assertions.assertThat(equipment.getAllValues())
                .extracting(item -> item.getRoom().getName())
                .containsOnly("Phòng Gym Tiêu chuẩn");
        verify(rooms, never()).create(any());
    }

    /** Hàm trợ giúp của test: tạo phòng có tên. */
    private Room namedRoom(String name) {
        var room = new Room();
        room.setName(name);
        return room;
    }

    /** Kiểm thử: seed các danh mục trống đủ 6 bộ môn và 7 phòng tập chuẩn. */
    @Test
    void seedsEmptyCatalogs() {
        when(disciplines.list()).thenReturn(List.of());
        when(rooms.list()).thenReturn(List.of());
        when(packages.list()).thenReturn(List.of());

        seeder.run(null);

        verify(disciplines, times(6)).create(any());
        verify(rooms, times(7)).create(any());
        var requests = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest.class);
        verify(packages, times(7)).create(requests.capture());
        org.assertj.core.api.Assertions.assertThat(requests.getAllValues().stream().map(r -> r.price().intValue()).toList())
                .containsExactly(0, 549000, 990000, 799000, 1449000, 1599000, 2899000);
        var legacy = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest.class);
        verify(packages, times(3)).seedLegacyPackage(legacy.capture());
        org.assertj.core.api.Assertions.assertThat(legacy.getAllValues().stream().map(r -> r.price().intValue()).toList())
                .containsExactly(199000, 299000, 599000);
    }

    /**
     * Kiểm thử: seed danh mục trống qua PackageService thật để chạy đầy đủ bước kiểm tra thời hạn;
     * danh mục trống phải được seed thành công mà không phát sinh lỗi.
     */
    @Test
    void seedsAnEmptyCatalogThroughTheValidatingPackageService() {
        var repository = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.MembershipPackageRepository.class);
        var saved = new java.util.ArrayList<com.swp391.scms.facilities.entity.MembershipPackage>();
        when(repository.findAllByOrderByPriceAsc()).thenAnswer(i -> List.copyOf(saved));
        when(repository.save(any())).thenAnswer(i -> {
            com.swp391.scms.facilities.entity.MembershipPackage pkg = i.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(pkg, "id", (long) saved.size() + 1);
            saved.add(pkg);
            return pkg;
        });
        when(disciplines.list()).thenReturn(List.of());
        when(rooms.list()).thenReturn(List.of());
        var realSeeder = new CatalogSeeder(disciplines, rooms, new PackageService(repository));

        org.assertj.core.api.Assertions.assertThatCode(() -> realSeeder.run(null)).doesNotThrowAnyException();

        org.assertj.core.api.Assertions.assertThat(saved)
                .extracting(com.swp391.scms.facilities.entity.MembershipPackage::getName,
                        com.swp391.scms.facilities.entity.MembershipPackage::getDurationDays)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.TRIAL_PACKAGE_NAME, 3),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.SILVER_NAME, 30),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.GOLD_NAME, 30),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.PLATINUM_NAME, 30),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.SILVER_3M_NAME, 90),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.SILVER_6M_NAME, 180),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.GOLD_3M_NAME, 90),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.GOLD_6M_NAME, 180),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.PLATINUM_3M_NAME, 90),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.PLATINUM_6M_NAME, 180));
    }

    /** Kiểm thử: không seed lại danh mục bộ môn và phòng chuẩn đã có đủ. */
    @Test
    void doesNotSeedExistingCatalogs() {
        when(disciplines.list()).thenReturn(List.of(
                new DisciplineDto(1L, "Gym", null),
                new DisciplineDto(2L, "Bơi lội", null),
                new DisciplineDto(3L, "Boxing", null),
                new DisciplineDto(4L, "Tennis", null),
                new DisciplineDto(5L, "Cầu lông", null),
                new DisciplineDto(6L, "Yoga", null)));
        when(rooms.list()).thenReturn(List.of(
                new RoomDto(1L, "Phòng Gym Tiêu chuẩn", "Tầng 1", 50, "available", null, null, null, null, "STANDARD"),
                new RoomDto(2L, "Phòng Gym VIP", "Tầng 2", 25, "available", null, null, null, null, "PLATINUM"),
                new RoomDto(3L, "Zen Garden Studio", "Penthouse", 18, "available", null, null, null, null, "STANDARD"),
                new RoomDto(4L, "Ring Arena 01", "Level 1 - East Wing", 14, "available", null, null, null, null, "STANDARD"),
                new RoomDto(5L, "Oasis Lap Pool", "Sub-level Oasis", 20, "available", null, null, null, null, "STANDARD"),
                new RoomDto(6L, "Sân Tennis 01", "Khu thể thao ngoài trời - Sân A", 8, "available", null, null, null, null, "STANDARD"),
                new RoomDto(7L, "Sân Cầu lông 01", "Nhà thi đấu - Tầng 1", 8, "available", null, null, null, null, "STANDARD")));
        when(packages.list()).thenReturn(List.of(new PackageDto(1L, "P", null, BigDecimal.ONE, 1, null, "active")));

        seeder.run(null);

        verify(disciplines, never()).create(any());
        verify(disciplines, never()).update(any(), any());
        verify(rooms, never()).create(any());
        verify(packages, times(7)).create(any());
        verify(packages, times(3)).seedLegacyPackage(any());
    }
    /** Kiểm thử: sửa giá gốc của danh mục mà không đổi điều khoản hay giá do quản lý đặt. */
    @Test
    void correctsOriginalCatalogPricesWithoutChangingTermsOrManagerPrices() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Yoga", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of(
                new PackageDto(1L, "The Essential", "8 classes", new BigDecimal("2800000"), 30, 8, "active"),
                new PackageDto(2L, "The Sanctuary VIP", "Unlimited", new BigDecimal("7500000"), 90, null, "active"),
                new PackageDto(3L, "The Sovereign Annual", "Annual", new BigDecimal("26000000"), 365, null, "active"),
                new PackageDto(4L, "Manager package", null, new BigDecimal("450000"), 45, 3, "active")));
        seeder.run(null);
        var requests = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest.class);
        verify(packages, times(3)).update(any(), requests.capture());
        org.assertj.core.api.Assertions.assertThat(requests.getAllValues().stream().map(r -> r.price().intValue()).toList())
                .containsExactly(299000, 499000, 999000);
        org.assertj.core.api.Assertions.assertThat(requests.getAllValues().stream().map(r -> r.durationDays()).toList())
                .containsExactly(30, 90, 365);
        org.assertj.core.api.Assertions.assertThat(requests.getAllValues().getFirst().classCreditLimit()).isEqualTo(8);
    }

    /** Kiểm thử: giữ thay đổi của quản lý trên gói đã seed. */
    @Test
    void preservesManagerChangesToSeededPackage() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Yoga", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of(new PackageDto(1L, CatalogSeeder.SILVER_NAME,
                "Manager terms", new BigDecimal("450000"), 45, 3, "inactive")));
        seeder.run(null);
        verify(packages, never()).update(any(), any());
    }

    /** Kiểm thử: không đụng vào trạng thái gói do quản lý kiểm soát. */
    @Test
    void leavesManagerControlledPackageStatusAlone() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Yoga", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of(
                new PackageDto(7L, "SILVER 6 THÁNG", null, new BigDecimal("999000"), 180, 2, "active"),
                new PackageDto(9L, "GOLD 12 THÁNG", null, new BigDecimal("1799000"), 365, 2, "active"),
                new PackageDto(10L, CatalogSeeder.SILVER_3M_NAME, null, new BigDecimal("549000"), 90, 6, "inactive")));

        seeder.run(null);

        verify(packages, never()).updateStatus(any(), any());
        verify(packages, never()).update(any(), any());
    }

    /** Kiểm thử: đổi tên bộ môn cũ sang danh sách chuẩn mà không tạo trùng. */
    @Test
    void renamesLegacyDisciplinesToTheCanonicalListWithoutDuplicatingThem() {
        when(disciplines.list()).thenReturn(List.of(
                new DisciplineDto(1L, "Olympic Strength", "Tạ"),
                new DisciplineDto(2L, "Thermal Aquatics", null),
                new DisciplineDto(3L, "Boxing & Kickfit", "Đấm"),
                new DisciplineDto(4L, "Tennis", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of());

        seeder.run(null);

        var requests = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.DisciplineRequest.class);
        verify(disciplines, times(3)).update(any(), requests.capture());
        org.assertj.core.api.Assertions.assertThat(requests.getAllValues().stream().map(r -> r.name()).toList())
                .containsExactly("Gym", "Bơi lội", "Boxing");
        org.assertj.core.api.Assertions.assertThat(requests.getAllValues().getFirst().description()).isEqualTo("Tạ");
        var created = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.DisciplineRequest.class);
        verify(disciplines, times(2)).create(created.capture());
        org.assertj.core.api.Assertions.assertThat(created.getAllValues().stream().map(r -> r.name()).toList())
                .containsExactly("Cầu lông", "Yoga");
    }

    /** Kiểm thử: không đổi tên bí danh cũ khi bộ môn hoặc gói chuẩn đã tồn tại. */
    @Test
    void doesNotRenameLegacyAliasWhenCanonicalDisciplineOrPackageAlreadyExistsLaterInSortedList() {
        when(disciplines.list()).thenReturn(List.of(
                new DisciplineDto(1L, "Bơi lội", null),
                new DisciplineDto(2L, "Boxing", null),
                new DisciplineDto(3L, "Cầu lông", null),
                new DisciplineDto(4L, "Gym", null),
                new DisciplineDto(5L, "Mindful Yoga", "Legacy"),
                new DisciplineDto(6L, "Tennis", null),
                new DisciplineDto(7L, "Yoga", "Canonical")));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of(
                new PackageDto(10L, "The Essential", "Old alias", new BigDecimal("150000"), 30, 2, "inactive"),
                new PackageDto(11L, CatalogSeeder.SILVER_NAME, "Manager custom", new BigDecimal("450000"), 30, 2, "active")));

        seeder.run(null);

        verify(disciplines, never()).update(any(), any());
        verify(disciplines, never()).create(any());
        verify(packages, never()).update(any(), any());
    }

    /** Kiểm thử: đồng bộ gói 3 và 6 tháng cũ sang mô tả mới và bật lại gói 6 tháng. */
    @Test
    void syncsLegacySeededThreeAndSixMonthPackagesToNewDescriptionsAndReactivatesSixMonth() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Gym", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "Phòng Gym Tiêu chuẩn", null, 50, "available")));
        when(packages.list()).thenReturn(List.of(
                new PackageDto(1L, CatalogSeeder.SILVER_3M_NAME, "BASIC – Đồng hành 3 tháng (Tiết kiệm 8%)\n- 3 lượt đăng ký khóa Group Fitness", new BigDecimal("549000"), 90, 3, "active"),
                new PackageDto(2L, CatalogSeeder.SILVER_6M_NAME, "BASIC – Đồng hành 6 tháng (Tiết kiệm 16%)\n- Old description", new BigDecimal("950000"), 180, 6, "inactive"),
                new PackageDto(3L, CatalogSeeder.GOLD_3M_NAME, "STANDARD – Đồng hành 3 tháng (Tiết kiệm 11%)\n- Sử dụng khu vực máy tập nâng cao", new BigDecimal("799000"), 90, 6, "active"),
                new PackageDto(4L, CatalogSeeder.GOLD_6M_NAME, "STANDARD – Đồng hành 6 tháng (Tiết kiệm 17%)\n- Old description", new BigDecimal("1400000"), 180, 12, "inactive"),
                new PackageDto(5L, CatalogSeeder.PLATINUM_3M_NAME, "VIP – Đồng hành 3 tháng (Tiết kiệm 11%)\n- Đặc quyền sử dụng phòng tập VIP riêng biệt", new BigDecimal("1599000"), 90, 12, "active"),
                new PackageDto(6L, CatalogSeeder.PLATINUM_6M_NAME, "VIP – Đồng hành 6 tháng (Đặc quyền VIP - Tiết kiệm 17%)\n- Old description", new BigDecimal("2800000"), 180, 24, "inactive")
        ));

        seeder.run(null);

        var updated = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest.class);
        verify(packages, times(6)).update(any(), updated.capture());
        org.assertj.core.api.Assertions.assertThat(updated.getAllValues())
                .extracting(com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest::name,
                        com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest::status)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.SILVER_3M_NAME, "active"),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.SILVER_6M_NAME, "active"),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.GOLD_3M_NAME, "active"),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.GOLD_6M_NAME, "active"),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.PLATINUM_3M_NAME, "active"),
                        org.assertj.core.groups.Tuple.tuple(CatalogSeeder.PLATINUM_6M_NAME, "active")
                );
    }

    /** Kiểm thử: giữ trạng thái và giá do quản lý đặt trên gói đã migrate qua các lần khởi động lại. */
    @Test
    void keepsManagerStatusAndPriceOnMigratedPackagesAcrossRestarts() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Gym", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "Phòng Gym Tiêu chuẩn", null, 50, "available")));
        when(packages.list()).thenReturn(List.of(
                new PackageDto(1L, CatalogSeeder.SILVER_3M_NAME, CatalogSeeder.SILVER_3M_DESC, new BigDecimal("499000"), 90, 3, "active"),
                new PackageDto(2L, CatalogSeeder.SILVER_6M_NAME, CatalogSeeder.SILVER_6M_DESC, CatalogSeeder.SILVER_6M_PRICE, 180, 6, "inactive"),
                new PackageDto(3L, CatalogSeeder.GOLD_3M_NAME, "STANDARD – Manager tự viết lại\n- Quyền lợi riêng", CatalogSeeder.GOLD_3M_PRICE, 90, 6, "active"),
                new PackageDto(4L, CatalogSeeder.GOLD_6M_NAME, CatalogSeeder.GOLD_6M_DESC, CatalogSeeder.GOLD_6M_PRICE, 180, 12, "inactive"),
                new PackageDto(5L, CatalogSeeder.PLATINUM_3M_NAME, CatalogSeeder.PLATINUM_3M_DESC, CatalogSeeder.PLATINUM_3M_PRICE, 90, 12, "active"),
                new PackageDto(6L, CatalogSeeder.PLATINUM_6M_NAME, CatalogSeeder.PLATINUM_6M_DESC, CatalogSeeder.PLATINUM_6M_PRICE, 180, 24, "inactive")
        ));

        seeder.run(null);

        verify(packages, never()).update(any(), any());
    }
}
