package com.swp391.scms.support;

import com.swp391.scms.common.exception.AppException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.support.dto.CreateSupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.dto.UpdateSupportRequestStatusDto;
import com.swp391.scms.support.entity.SupportRequest;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportRequestServiceTest {

    @Mock
    private SupportRequestRepository supportRequestRepository;

    @Mock
    private SupportRequestMapper supportRequestMapper;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SupportRequestService supportRequestService;

    private Member sampleMember;
    private User sampleUser;
    private SupportRequest sampleRequest;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setId(10L);
        sampleUser.setFullName("Nguyễn Văn A");

        sampleMember = new Member();
        sampleMember.setUser(sampleUser);

        sampleRequest = new SupportRequest(sampleMember, "Lỗi tủ đồ", "Tủ số 12 bị kẹt");
        sampleRequest.setStatus("open");
    }

    @Test
    @DisplayName("Tạo yêu cầu hỗ trợ thành công khi member tồn tại")
    void createRequest_Success() {
        CreateSupportRequestDto dto = new CreateSupportRequestDto("Lỗi tủ đồ", "Tủ số 12 bị kẹt");
        SupportRequestDto expectedDto = new SupportRequestDto(
                1L, 10L, "Nguyễn Văn A", null, null, "Lỗi tủ đồ", "Tủ số 12 bị kẹt", "open", LocalDateTime.now(), null
        );

        when(memberRepository.findById(10L)).thenReturn(Optional.of(sampleMember));
        when(supportRequestRepository.save(any(SupportRequest.class))).thenReturn(sampleRequest);
        when(supportRequestMapper.toDto(any(SupportRequest.class))).thenReturn(expectedDto);

        SupportRequestDto result = supportRequestService.createRequest(10L, dto);

        assertThat(result).isNotNull();
        assertThat(result.subject()).isEqualTo("Lỗi tủ đồ");
        verify(supportRequestRepository).save(any(SupportRequest.class));
    }

    @Test
    @DisplayName("Ném ResourceNotFoundException khi tạo yêu cầu với member không tồn tại")
    void createRequest_MemberNotFound() {
        CreateSupportRequestDto dto = new CreateSupportRequestDto("Lỗi tủ đồ", "Tủ số 12 bị kẹt");
        when(memberRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> supportRequestService.createRequest(99L, dto))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("Lấy danh sách yêu cầu của Member có phân trang")
    void getMyRequests_Success() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<SupportRequest> page = new PageImpl<>(List.of(sampleRequest));
        SupportRequestDto expectedDto = new SupportRequestDto(
                1L, 10L, "Nguyễn Văn A", null, null, "Lỗi tủ đồ", "Tủ số 12 bị kẹt", "open", LocalDateTime.now(), null
        );

        when(supportRequestRepository.findByMemberUserIdOrderByCreatedAtDesc(10L, pageable)).thenReturn(page);
        when(supportRequestMapper.toDto(sampleRequest)).thenReturn(expectedDto);

        Page<SupportRequestDto> result = supportRequestService.getMyRequests(10L, pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).subject()).isEqualTo("Lỗi tủ đồ");
    }

    @Test
    @DisplayName("Lấy toàn bộ yêu cầu lọc theo status")
    void getAllRequests_Success() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<SupportRequest> page = new PageImpl<>(List.of(sampleRequest));
        SupportRequestDto expectedDto = new SupportRequestDto(
                1L, 10L, "Nguyễn Văn A", null, null, "Lỗi tủ đồ", "Tủ số 12 bị kẹt", "open", LocalDateTime.now(), null
        );

        when(supportRequestRepository.findAllByStatus("open", pageable)).thenReturn(page);
        when(supportRequestMapper.toDto(sampleRequest)).thenReturn(expectedDto);

        Page<SupportRequestDto> result = supportRequestService.getAllRequests("open", pageable);

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    @DisplayName("Chuyển trạng thái hợp lệ: open -> in_progress")
    void updateStatus_OpenToInProgress_Success() {
        sampleRequest.setStatus("open");
        when(supportRequestRepository.findById(1L)).thenReturn(Optional.of(sampleRequest));
        when(supportRequestRepository.save(sampleRequest)).thenReturn(sampleRequest);
        when(supportRequestMapper.toDto(sampleRequest)).thenReturn(
                new SupportRequestDto(1L, 10L, "Nguyễn Văn A", null, null, "Lỗi", "Desc", "in_progress", LocalDateTime.now(), null)
        );

        UpdateSupportRequestStatusDto updateDto = new UpdateSupportRequestStatusDto("in_progress", null);
        SupportRequestDto result = supportRequestService.updateStatus(1L, updateDto);

        assertThat(sampleRequest.getStatus()).isEqualTo("in_progress");
        assertThat(result.status()).isEqualTo("in_progress");
    }

    @Test
    @DisplayName("Chuyển trạng thái hợp lệ: in_progress -> resolved và ghi nhận resolvedAt")
    void updateStatus_InProgressToResolved_Success() {
        sampleRequest.setStatus("in_progress");
        when(supportRequestRepository.findById(1L)).thenReturn(Optional.of(sampleRequest));
        when(supportRequestRepository.save(sampleRequest)).thenReturn(sampleRequest);
        when(supportRequestMapper.toDto(sampleRequest)).thenReturn(
                new SupportRequestDto(1L, 10L, "Nguyễn Văn A", null, null, "Lỗi", "Desc", "resolved", LocalDateTime.now(), LocalDateTime.now())
        );

        UpdateSupportRequestStatusDto updateDto = new UpdateSupportRequestStatusDto("resolved", null);
        supportRequestService.updateStatus(1L, updateDto);

        assertThat(sampleRequest.getStatus()).isEqualTo("resolved");
        assertThat(sampleRequest.getResolvedAt()).isNotNull();
    }

    @Test
    @DisplayName("Chuyển trạng thái hợp lệ: resolved -> closed")
    void updateStatus_ResolvedToClosed_Success() {
        sampleRequest.setStatus("resolved");
        sampleRequest.setResolvedAt(LocalDateTime.now().minusHours(24));
        when(supportRequestRepository.findById(1L)).thenReturn(Optional.of(sampleRequest));
        when(supportRequestRepository.save(sampleRequest)).thenReturn(sampleRequest);
        when(supportRequestMapper.toDto(sampleRequest)).thenReturn(
                new SupportRequestDto(1L, 10L, "Nguyễn Văn A", null, null, "Lỗi", "Desc", "closed", LocalDateTime.now(), sampleRequest.getResolvedAt())
        );

        UpdateSupportRequestStatusDto updateDto = new UpdateSupportRequestStatusDto("closed", null);
        supportRequestService.updateStatus(1L, updateDto);

        assertThat(sampleRequest.getStatus()).isEqualTo("closed");
    }

    @Test
    @DisplayName("Chuyển trạng thái hợp lệ: in_progress -> open (yêu cầu thêm thông tin)")
    void updateStatus_InProgressToOpen_Success() {
        sampleRequest.setStatus("in_progress");
        when(supportRequestRepository.findById(1L)).thenReturn(Optional.of(sampleRequest));
        when(supportRequestRepository.save(sampleRequest)).thenReturn(sampleRequest);
        when(supportRequestMapper.toDto(sampleRequest)).thenReturn(
                new SupportRequestDto(1L, 10L, "Nguyễn Văn A", null, null, "Lỗi", "Desc", "open", LocalDateTime.now(), null)
        );

        UpdateSupportRequestStatusDto updateDto = new UpdateSupportRequestStatusDto("open", null);
        supportRequestService.updateStatus(1L, updateDto);

        assertThat(sampleRequest.getStatus()).isEqualTo("open");
        assertThat(sampleRequest.getResolvedAt()).isNull();
    }

    @Test
    @DisplayName("Không được phép mở lại hoặc thay đổi ticket đã đóng (closed)")
    void updateStatus_ClosedTicketCannotBeChanged() {
        sampleRequest.setStatus("closed");
        when(supportRequestRepository.findById(1L)).thenReturn(Optional.of(sampleRequest));

        UpdateSupportRequestStatusDto updateDto = new UpdateSupportRequestStatusDto("in_progress", null);

        assertThatThrownBy(() -> supportRequestService.updateStatus(1L, updateDto))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Closed support request cannot be modified");
    }

    @Test
    @DisplayName("Ném AppException khi chuyển trạng thái sai state machine: open -> closed")
    void updateStatus_InvalidTransition_OpenToClosed() {
        sampleRequest.setStatus("open");
        when(supportRequestRepository.findById(1L)).thenReturn(Optional.of(sampleRequest));

        UpdateSupportRequestStatusDto updateDto = new UpdateSupportRequestStatusDto("closed", null);

        assertThatThrownBy(() -> supportRequestService.updateStatus(1L, updateDto))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Invalid state transition from open to closed");
    }

    @Test
    @DisplayName("Cập nhật người phụ trách (assignedTo) thành công")
    void updateStatus_AssignToUser_Success() {
        sampleRequest.setStatus("open");
        User staff = new User();
        staff.setId(20L);
        staff.setFullName("Lễ tân Lan");

        when(supportRequestRepository.findById(1L)).thenReturn(Optional.of(sampleRequest));
        when(userRepository.findById(20L)).thenReturn(Optional.of(staff));
        when(supportRequestRepository.save(sampleRequest)).thenReturn(sampleRequest);
        when(supportRequestMapper.toDto(sampleRequest)).thenReturn(
                new SupportRequestDto(1L, 10L, "Nguyễn Văn A", 20L, "Lễ tân Lan", "Lỗi", "Desc", "open", LocalDateTime.now(), null)
        );

        UpdateSupportRequestStatusDto updateDto = new UpdateSupportRequestStatusDto(null, 20L);
        SupportRequestDto result = supportRequestService.updateStatus(1L, updateDto);

        assertThat(sampleRequest.getAssignedTo()).isEqualTo(staff);
    }
}
