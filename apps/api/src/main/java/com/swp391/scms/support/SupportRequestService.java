package com.swp391.scms.support;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.support.dto.CreateSupportRequestDto;
import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.dto.UpdateSupportRequestStatusDto;
import com.swp391.scms.support.entity.SupportRequest;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class SupportRequestService {

    private final SupportRequestRepository supportRequestRepository;
    private final SupportRequestMapper supportRequestMapper;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;

    public SupportRequestService(SupportRequestRepository supportRequestRepository,
                                 SupportRequestMapper supportRequestMapper,
                                 MemberRepository memberRepository,
                                 UserRepository userRepository) {
        this.supportRequestRepository = supportRequestRepository;
        this.supportRequestMapper = supportRequestMapper;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public SupportRequestDto createRequest(Long memberId, CreateSupportRequestDto dto) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));

        SupportRequest request = new SupportRequest(member, dto.subject(), dto.description());
        supportRequestRepository.save(request);
        return supportRequestMapper.toDto(request);
    }

    @Transactional(readOnly = true)
    public Page<SupportRequestDto> getMyRequests(Long memberId, Pageable pageable) {
        return supportRequestRepository.findByMemberUserIdOrderByCreatedAtDesc(memberId, pageable)
                .map(supportRequestMapper::toDto);
    }

    @Transactional(readOnly = true)
    public Page<SupportRequestDto> getAllRequests(String status, Pageable pageable) {
        return supportRequestRepository.findAllByStatus(status, pageable)
                .map(supportRequestMapper::toDto);
    }

    @Transactional
    public SupportRequestDto updateStatus(Long id, UpdateSupportRequestStatusDto dto) {
        SupportRequest request = supportRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.support_request", id));

        if (dto.status() != null) {
            request.setStatus(dto.status());
            if ("resolved".equals(dto.status()) || "closed".equals(dto.status())) {
                if (request.getResolvedAt() == null) {
                    request.setResolvedAt(LocalDateTime.now());
                }
            } else {
                request.setResolvedAt(null);
            }
        }

        if (dto.assignedTo() != null) {
            User assignee = userRepository.findById(dto.assignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.user", dto.assignedTo()));
            request.setAssignedTo(assignee);
        }

        supportRequestRepository.save(request);
        return supportRequestMapper.toDto(request);
    }
}
