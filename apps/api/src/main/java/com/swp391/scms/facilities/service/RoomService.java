package com.swp391.scms.facilities.service;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.dto.CatalogRequests.RoomRequest;
import com.swp391.scms.facilities.dto.CatalogResponses.RoomDto;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.RoomRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nghiệp vụ danh mục phòng tập (SCRUM-59).
 */
@Service
public class RoomService {

    private final RoomRepository rooms;

    /** Constructor Spring dùng. */
    @org.springframework.beans.factory.annotation.Autowired
    public RoomService(RoomRepository rooms) {
        this.rooms = rooms;
    }

    /** Danh sách phòng theo tên. */
    @Transactional(readOnly = true)
    public List<RoomDto> list() {
        return rooms.findAllByOrderByNameAsc().stream().map(RoomDto::of).toList();
    }

    /** Tạo phòng. */
    @Transactional
    public RoomDto create(RoomRequest request) {
        Room room = new Room();
        apply(room, request);
        return RoomDto.of(rooms.save(room));
    }

    /** Sửa phòng; từ chối giảm sức chứa phòng thấp hơn sức chứa lớn nhất của các lớp đang active trong phòng. */
    @Transactional
    public RoomDto update(Long id, RoomRequest request) {
        Room room = rooms.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.room", id));
        if (classes != null) {
            Integer maxActiveClassCapacity = classes.findMaxCapacityByRoomIdAndStatus(id, "active");
            if (maxActiveClassCapacity != null && request.capacity() < maxActiveClassCapacity) {
                String roomName = request.name() != null && !request.name().isBlank()
                        ? request.name().trim()
                        : (room.getName() != null ? room.getName() : ("#" + id));
                throw new com.swp391.scms.common.exception.BadRequestException(
                        "SCHEDULING_CAPACITY_EXCEEDS_ROOM",
                        "error.scheduling.capacity_exceeds_room",
                        new Object[]{maxActiveClassCapacity, roomName, request.capacity()},
                        "Room capacity (" + request.capacity() + ") cannot be less than active class capacity ("
                                + maxActiveClassCapacity + ")");
            }
        }
        apply(room, request);
        return RoomDto.of(room);
    }

    /** Gán dữ liệu phòng: tên, vị trí, sức chứa, trạng thái và hạng phòng (mặc định STANDARD). */
    private void apply(Room room, RoomRequest request) {
        room.setDiscipline(null);
        room.setOpenTime(null);
        room.setCloseTime(null);
        room.setName(request.name().trim());
        room.setLocation(request.location());
        room.setCapacity(request.capacity());
        if (request.status() != null) {
            room.setStatus(request.status());
        }
        if (request.tier() != null && !request.tier().isBlank()) {
            room.setTier(request.tier().trim().toUpperCase(java.util.Locale.ROOT));
        } else if (room.getTier() == null) {
            room.setTier("STANDARD");
        }
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.scheduling.repository.GymClassRepository classes;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.facilities.repository.EquipmentRepository equipment;

    /**
     * Xóa phòng chưa từng được dùng cho lớp học hay thiết bị; phòng đã từng sử dụng được giữ lại (chuyển trạng
     * thái sang closed thay vì xóa).
     */
    @Transactional
    public void delete(Long id) {
        Room room = rooms.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.room", id));
        if ((classes != null && classes.existsByRoomId(id))
                || (equipment != null && equipment.existsByRoomId(id))) {
            throw new com.swp391.scms.common.exception.ConflictException("ROOM_IN_USE", "catalog.room.in_use", null, null);
        }
        rooms.delete(room);
    }
}
