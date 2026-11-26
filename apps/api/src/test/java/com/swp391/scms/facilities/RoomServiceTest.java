package com.swp391.scms.facilities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.dto.CatalogRequests.RoomRequest;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.facilities.service.RoomService;
import java.time.LocalTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Bộ kiểm thử cho service RoomService (room service). */
@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock RoomRepository rooms;
    @InjectMocks RoomService service;

    /** Kiểm thử: liệt kê mọi phòng mà không lọc theo tên. */
    @Test
    void listsEveryRoomWithoutFilteringByName() {
        Room standard = new Room(); standard.setName("Phòng Gym Tiêu chuẩn");
        Room renamed = new Room(); renamed.setName("Phòng Gym Tầng 2");
        when(rooms.findAllByOrderByNameAsc()).thenReturn(java.util.List.of(standard, renamed));

        assertEquals(java.util.List.of("Phòng Gym Tiêu chuẩn", "Phòng Gym Tầng 2"),
                service.list().stream().map(room -> room.name()).toList());
    }

    /** Kiểm thử: tạo phòng mặc định là khả dụng khi không nêu trạng thái. */
    @Test
    void createDefaultsToAvailableWhenStatusOmitted() {
        when(rooms.save(any(Room.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("available", service.create(new RoomRequest("Studio", "L1", 10, null)).status());
    }

    /** Kiểm thử: cập nhật đổi trạng thái và sức chứa. */
    @Test
    void updateChangesStatusAndCapacity() {
        when(rooms.findById(1L)).thenReturn(Optional.of(new Room()));

        var dto = service.update(1L, new RoomRequest("Studio", "L1", 15, "maintenance"));

        assertEquals("maintenance", dto.status());
        assertEquals(15, dto.capacity());
    }

    /** Kiểm thử: cập nhật phòng không tồn tại ném not found. */
    @Test
    void updateMissingThrowsNotFound() {
        when(rooms.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.update(9L, new RoomRequest("A", null, 1, null)));
    }

    /** Kiểm thử: tạo phòng luôn giữ bộ môn và giờ mở/đóng trống (không còn cấu hình đặt sân). */
    @Test
    void createIgnoresLegacyDisciplineAndOperatingHours() {
        when(rooms.save(any(Room.class))).thenAnswer(i -> i.getArgument(0));

        var dto = service.create(new RoomRequest("Ring Arena 01", "L1", 14, "available",
                2L, LocalTime.of(6, 0), LocalTime.of(22, 0), "STANDARD"));

        assertNull(dto.disciplineId());
        assertNull(dto.openTime());
        assertNull(dto.closeTime());
        assertEquals("STANDARD", dto.tier());
    }

    @Test void deleteRemovesRoomNobodyUses() {
        Room room = new Room();
        var classes = org.mockito.Mockito.mock(com.swp391.scms.scheduling.repository.GymClassRepository.class);
        var equipment = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.EquipmentRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "classes", classes);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "equipment", equipment);
        when(rooms.findById(1L)).thenReturn(Optional.of(room));
        service.delete(1L);
        org.mockito.Mockito.verify(rooms).delete(room);
    }

    @Test void deleteBlockedWhenClassOrEquipmentUsesRoom() {
        var classes = org.mockito.Mockito.mock(com.swp391.scms.scheduling.repository.GymClassRepository.class);
        var equipment = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.EquipmentRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "classes", classes);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "equipment", equipment);
        when(rooms.findById(1L)).thenReturn(Optional.of(new Room()));
        when(classes.existsByRoomId(1L)).thenReturn(true);
        assertThrows(com.swp391.scms.common.exception.ConflictException.class, () -> service.delete(1L));
        when(classes.existsByRoomId(1L)).thenReturn(false);
        when(equipment.existsByRoomId(1L)).thenReturn(true);
        assertThrows(com.swp391.scms.common.exception.ConflictException.class, () -> service.delete(1L));
        org.mockito.Mockito.verify(rooms, org.mockito.Mockito.never()).delete(any(Room.class));
    }

    @Test void deleteMissingRoomThrowsNotFound() {
        when(rooms.findById(9L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.delete(9L));
    }

    /** Kiểm thử P2-BE-23: từ chối giảm sức chứa phòng thấp hơn sức chứa của lớp đang active trong phòng. */
    @Test
    void updateRejectsCapacityBelowMaxActiveClassCapacity() {
        Room room = new Room();
        room.setName("Zen Garden Studio");
        room.setCapacity(20);
        var classes = org.mockito.Mockito.mock(com.swp391.scms.scheduling.repository.GymClassRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "classes", classes);
        when(rooms.findById(1L)).thenReturn(Optional.of(room));
        when(classes.findMaxCapacityByRoomIdAndStatus(1L, "active")).thenReturn(16);

        var ex = assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> service.update(1L, new RoomRequest("Zen Garden Studio", "L2", 12, "available")));
        assertEquals("SCHEDULING_CAPACITY_EXCEEDS_ROOM", ex.getErrorCode());
        assertEquals(20, room.getCapacity());

        // Đặt sức chứa >= max lớp active thì cho phép
        var updated = service.update(1L, new RoomRequest("Zen Garden Studio", "L2", 16, "available"));
        assertEquals(16, updated.capacity());
    }
}
