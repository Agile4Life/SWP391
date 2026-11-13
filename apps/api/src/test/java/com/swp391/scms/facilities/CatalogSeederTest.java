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

@ExtendWith(MockitoExtension.class)
class CatalogSeederTest {

    @Mock DisciplineService disciplines;
    @Mock RoomService rooms;
    @Mock PackageService packages;
    @Mock EquipmentRepository equipmentRepository;
    @Mock RoomRepository roomRepository;
    @InjectMocks CatalogSeeder seeder;

    @BeforeEach
    void existingEquipmentIsNotASeedTarget() {
        org.springframework.test.util.ReflectionTestUtils.setField(seeder, "equipmentRepository", equipmentRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(seeder, "roomRepository", roomRepository);
        org.mockito.Mockito.lenient().when(equipmentRepository.count()).thenReturn(1L);
    }

    @Test
    void doesNotRecreateDeletedDemoEquipmentInAnExistingInventory() {
        org.mockito.Mockito.lenient().when(roomRepository.findAll()).thenReturn(List.of(
                namedRoom("Phòng Gym Tiêu chuẩn"), namedRoom("Phòng Gym VIP")));

        seeder.run(null);

        verify(equipmentRepository, never()).save(any());
    }

    @Test
    void seedsAnEmptyInventoryIntoExistingNamedGymRooms() {
        when(equipmentRepository.count()).thenReturn(0L);
        when(rooms.list()).thenReturn(List.of(
                new RoomDto(1L, "Phòng Gym Tiêu chuẩn", "Tầng 1", 50, "available", null, null, null, null, "STANDARD"),
                new RoomDto(2L, "Phòng Gym VIP", "Tầng 2", 25, "available", null, null, null, null, "PLATINUM")));
        when(roomRepository.findAll()).thenReturn(List.of(
                namedRoom("Phòng Gym Tiêu chuẩn"), namedRoom("Phòng Gym VIP")));

        seeder.run(null);

        var equipment = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.entity.Equipment.class);
        verify(equipmentRepository, times(12)).save(equipment.capture());
        org.assertj.core.api.Assertions.assertThat(equipment.getAllValues())
                .extracting(item -> item.getRoom().getName())
                .containsOnly("Phòng Gym Tiêu chuẩn", "Phòng Gym VIP");
        verify(rooms, times(1)).create(any()); // only the Boxing Studio is missing
    }

    private Room namedRoom(String name) {
        var room = new Room();
        room.setName(name);
        return room;
    }

    @Test
    void seedsEmptyCatalogs() {
        when(disciplines.list()).thenReturn(List.of());
        when(rooms.list()).thenReturn(List.of());
        when(packages.list()).thenReturn(List.of());

        seeder.run(null);

        verify(disciplines, times(6)).create(any());
        verify(rooms, times(6)).create(any());
        var requests = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest.class);
        verify(packages, times(13)).create(requests.capture());
        org.assertj.core.api.Assertions.assertThat(requests.getAllValues().stream().map(r -> r.price().intValue()).toList())
                .containsExactly(0,
                        549000, 990000, 1390000, 1750000,
                        799000, 1440000, 2040000, 2550000,
                        1599000, 2890000, 4090000, 5120000);
    }

    /** Uses the real PackageService so its term validation runs: an empty catalog must seed without errors. */
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
                        org.assertj.core.groups.Tuple.tuple("SILVER 3 THÁNG", 90),
                        org.assertj.core.groups.Tuple.tuple("SILVER 6 THÁNG", 180),
                        org.assertj.core.groups.Tuple.tuple("SILVER 9 THÁNG", 270),
                        org.assertj.core.groups.Tuple.tuple("SILVER 12 THÁNG", 360),
                        org.assertj.core.groups.Tuple.tuple("GOLD 3 THÁNG", 90),
                        org.assertj.core.groups.Tuple.tuple("GOLD 6 THÁNG", 180),
                        org.assertj.core.groups.Tuple.tuple("GOLD 9 THÁNG", 270),
                        org.assertj.core.groups.Tuple.tuple("GOLD 12 THÁNG", 360),
                        org.assertj.core.groups.Tuple.tuple("PLATINUM 3 THÁNG", 90),
                        org.assertj.core.groups.Tuple.tuple("PLATINUM 6 THÁNG", 180),
                        org.assertj.core.groups.Tuple.tuple("PLATINUM 9 THÁNG", 270),
                        org.assertj.core.groups.Tuple.tuple("PLATINUM 12 THÁNG", 360));
    }

    @Test
    void doesNotSeedExistingCatalogs() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Yoga", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of(new PackageDto(1L, "P", null, BigDecimal.ONE, 1, null, "active")));

        seeder.run(null);

        // "Yoga" đã có sẵn nên chỉ 5 bộ môn chuẩn còn lại được tạo thêm
        verify(disciplines, times(5)).create(any());
        verify(disciplines, never()).update(any(), any());
        verify(rooms, times(1)).create(any());
        verify(packages, times(13)).create(any());
    }
    @Test
    void retiresOneMonthPackagesWithoutDeletingThem() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Yoga", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of(
                new PackageDto(1L, "SILVER", null, new BigDecimal("199000"), 30, 1, "active"),
                new PackageDto(2L, "GOLD", null, new BigDecimal("299000"), 30, 2, "inactive"),
                new PackageDto(3L, "PLATINUM", null, new BigDecimal("599000"), 30, 4, "active"),
                new PackageDto(4L, "SILVER 3 THÁNG", null, new BigDecimal("549000"), 90, 3, "active")));

        seeder.run(null);

        verify(packages).updateStatus(1L, "inactive");
        verify(packages, never()).updateStatus(2L, "inactive");
        verify(packages).updateStatus(3L, "inactive");
        verify(packages, never()).updateStatus(4L, "inactive");
        verify(packages, never()).update(any(), any());
    }

    @Test
    void describesShortAndLongTermPackagesWithTheirBenefits() {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Yoga", null)));
        when(rooms.list()).thenReturn(List.of(new RoomDto(1L, "S", null, 1, "available")));
        when(packages.list()).thenReturn(List.of());

        seeder.run(null);

        var requests = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest.class);
        verify(packages, times(13)).create(requests.capture());
        var byName = requests.getAllValues().stream().collect(java.util.stream.Collectors.toMap(
                com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest::name, r -> r));
        var gold12 = byName.get("GOLD 12 THÁNG");
        org.assertj.core.api.Assertions.assertThat(gold12.durationDays()).isEqualTo(360);
        org.assertj.core.api.Assertions.assertThat(gold12.classCreditLimit()).isEqualTo(24);
        org.assertj.core.api.Assertions.assertThat(gold12.description()).contains("Dài hạn").contains("36 buổi tập Personal Trainer");
        org.assertj.core.api.Assertions.assertThat(byName.get("SILVER 3 THÁNG").description()).contains("Ngắn hạn")
                .doesNotContain("Personal Trainer");
        org.assertj.core.api.Assertions.assertThat(byName.get("PLATINUM 9 THÁNG").description()).contains("30 ngày");
    }

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
        verify(disciplines, times(2)).create(any());
    }

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
                new PackageDto(11L, "SILVER 3 THÁNG", "Manager custom", new BigDecimal("450000"), 30, 2, "active")));

        seeder.run(null);

        verify(disciplines, never()).update(any(), any());
        verify(disciplines, never()).create(any());
        verify(packages, never()).update(any(), any());
    }
}
