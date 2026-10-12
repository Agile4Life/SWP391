package com.swp391.scms.users;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.users.dto.UserCreateDto;
import com.swp391.scms.users.dto.UserDto;
import com.swp391.scms.users.dto.UserUpdateDto;
import com.swp391.scms.users.mapper.UserMapper;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;
    private final ReceptionistRepository receptionistRepository;

    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, UserMapper userMapper,
                       ReceptionistRepository receptionistRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.userMapper = userMapper;
        this.receptionistRepository = receptionistRepository;
    }

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAllByDeletedAtIsNullOrderByIdAsc().stream()
                .map(userMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(Long id) {
        return userMapper.toDto(findActiveUser(id));
    }

    @Transactional
    @Audited(action = "USER_CREATE", entity = "users")
    public UserDto createUser(UserCreateDto dto) {
        if (userRepository.findByEmailIgnoreCase(dto.getEmail().trim()).isPresent()) {
            throw new ConflictException("EMAIL_EXISTS", "users.email_exists", null, null);
        }
        if (dto.getPhone() != null && userRepository.findByPhone(dto.getPhone().trim()).isPresent()) {
            throw new ConflictException("PHONE_EXISTS", "users.phone_exists", null, null);
        }

        Role role = findRole(dto.getRoleId());

        User user = new User();
        user.setRole(role);
        user.setFullName(dto.getFullName().trim());
        user.setEmail(dto.getEmail().trim().toLowerCase(Locale.ROOT));
        user.setPhone(dto.getPhone() == null || dto.getPhone().isBlank() ? null : dto.getPhone().trim());
        user.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
        user.setStatus("active");
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        User saved = userRepository.saveAndFlush(user);
        if ("MEMBER".equalsIgnoreCase(role.getCode())) {
            Member member = new Member();
            member.setUser(saved);
            member.setMembershipCode("MEM-" + saved.getId());
            member.setJoinDate(LocalDate.now());
            member.setFitnessLevel("beginner");
            saved.setMember(member);
            userRepository.save(saved);
        }
        return userMapper.toDto(saved);
    }

    @Transactional
    @Audited(action = "USER_UPDATE", entity = "users")
    public UserDto updateUser(Long id, UserUpdateDto dto) {
        User user = findActiveUser(id);

        if (dto.getFullName() != null) {
            user.setFullName(dto.getFullName().trim());
        }
        if (dto.getPhone() != null) {
            String phone = dto.getPhone().isBlank() ? null : dto.getPhone().trim();
            if (phone != null) {
                userRepository.findByPhone(phone)
                        .filter(existing -> !existing.getId().equals(id))
                        .ifPresent(existing -> { throw new ConflictException("PHONE_EXISTS", "users.phone_exists", null, null); });
            }
            user.setPhone(phone);
        }
        if (dto.getRoleId() != null) {
            user.setRole(findRole(dto.getRoleId()));
        }
        user.setUpdatedAt(LocalDateTime.now());
        return userMapper.toDto(userRepository.save(user));
    }

    @Transactional
    @Audited(action = "USER_DELETE", entity = "users")
    public void deleteUser(Long id) {
        User user = findActiveUser(id);
        LocalDateTime now = LocalDateTime.now();
        user.setDeletedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);
    }

    @Transactional
    @Audited(action = "USER_STATUS_CHANGE", entity = "users")
    public UserDto setStatus(Long id, String status) {
        if (!"active".equals(status) && !"locked".equals(status)) {
            throw new BadRequestException("INVALID_USER_STATUS", "users.invalid_status", null, null);
        }
        User user = findActiveUser(id);
        user.setStatus(status);
        user.setUpdatedAt(LocalDateTime.now());
        return userMapper.toDto(userRepository.save(user));
    }

    private Role findRole(Long roleId) {
        return roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.role", roleId));
    }

    private User findActiveUser(Long id) {
        return userRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", id));
    }

    @Transactional
    public void updateReceptionistShift(Long userId, com.swp391.scms.users.dto.ReceptionistProfileUpdateDto request) {
        User user = findActiveUser(userId);
        if (!"RECEPTIONIST".equalsIgnoreCase(user.getRole().getCode())) {
            throw new com.swp391.scms.common.exception.BadRequestException("INVALID_ROLE", "users.not_receptionist", null, null);
        }
        com.swp391.scms.users.entity.Receptionist receptionist = receptionistRepository.findById(userId).orElseGet(() -> {
            com.swp391.scms.users.entity.Receptionist newReceptionist = new com.swp391.scms.users.entity.Receptionist();
            newReceptionist.setUser(user);
            return newReceptionist;
        });
        receptionist.setShift(request.shift());
        receptionistRepository.save(receptionist);
    }
}