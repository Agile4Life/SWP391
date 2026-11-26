package com.swp391.scms.users;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.users.dto.UserCreateDto;
import com.swp391.scms.users.dto.UserDto;
import com.swp391.scms.users.dto.UserUpdateDto;
import com.swp391.scms.users.mapper.UserMapper;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Nghiệp vụ quản trị tài khoản: tạo/sửa/xóa mềm/khôi phục/khóa người dùng, tài khoản nhân viên, kiểm tra trùng
 * email/SĐT, bảo vệ Admin cuối cùng, chặn xóa khi còn cam kết, và tự dọn tài khoản hội viên không hoạt động.
 */
@Service
public class UserService {
    /** Danh sách tài khoản HLV và lễ tân chưa bị xóa (chỉ quản lý trung tâm hoặc Admin). */
    @Transactional(readOnly = true)
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('CENTER_MANAGER', 'ADMIN')")
    public List<UserDto> getStaffAccounts() {
        return userRepository.findAllByDeletedAtIsNullAndRole_CodeInOrderByIdAsc(List.of("COACH", "RECEPTIONIST"))
                .stream().map(userMapper::toDto).toList();
    }

    /**
     * Quản lý tạo tài khoản nhân viên: vai trò chỉ được là COACH hoặc RECEPTIONIST, rồi tạo như người dùng
     * thường.
     */
    @Transactional
    @Audited(action = "STAFF_ACCOUNT_CREATE", entity = "users")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('CENTER_MANAGER', 'ADMIN')")
    public UserDto createStaffAccount(com.swp391.scms.users.dto.StaffAccountCreateDto request) {
        if (request.roleCode() == null || !List.of("COACH", "RECEPTIONIST").contains(request.roleCode())) {
            throw new BadRequestException("INVALID_STAFF_ROLE", "validation.users.staff_role", null, null);
        }
        Role role = roleRepository.findByCode(request.roleCode())
                .orElseThrow(() -> new ResourceNotFoundException("resource.role", request.roleCode()));
        UserCreateDto dto = new UserCreateDto();
        dto.setFullName(request.fullName());
        dto.setEmail(request.email());
        dto.setPhone(request.phone());
        dto.setPassword(request.password());
        dto.setGender(request.gender());
        dto.setRoleId(role.getId());
        return createUser(dto);
    }

    /**
     * Quản lý khóa/mở khóa tài khoản nhân viên; chỉ áp dụng cho HLV và lễ tân.
     *
     * Khóa/mở khóa cấp quản lý, giới hạn ở các tài khoản HLV và lễ tân mà quản lý cấp.
     */
    @Transactional
    @Audited(action = "STAFF_ACCOUNT_STATUS_CHANGE", entity = "users")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('CENTER_MANAGER', 'ADMIN')")
    public UserDto setStaffStatus(Long id, String status) {
        User user = findActiveUser(id);
        String code = user.getRole() == null ? "" : user.getRole().getCode().toUpperCase(Locale.ROOT);
        if (!List.of("COACH", "RECEPTIONIST").contains(code)) {
            throw new BadRequestException("INVALID_STAFF_ROLE", "validation.users.staff_role", null, null);
        }
        return setStatus(id, status);
    }

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;
    private final ReceptionistRepository receptionistRepository;
    private final com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptionRepository;
    private final Clock clock;

    /** Các vai trò có tài khoản do con người quản lý, không bao giờ bị tác vụ quét không hoạt động xử lý. */
    private static final java.util.Set<String> NEVER_AUTO_DELETED =
            java.util.Set.of("ADMIN", "CENTER_MANAGER", "MANAGER", "COACH", "RECEPTIONIST", "STAFF");

    // Các nguồn hoạt động tùy chọn; hội viên quét ở cổng hoặc thanh toán ở quầy vẫn được coi là hoạt động dù
    // chưa đăng nhập ứng dụng.
    @Autowired(required = false)
    com.swp391.scms.attendance.repository.CenterCheckinRepository checkinRepository;

    @Autowired(required = false)
    com.swp391.scms.finance.repository.PaymentRepository paymentRepository;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    com.swp391.scms.scheduling.service.SessionBookingService sessionBookingService;

    @Autowired(required = false)
    com.swp391.scms.common.i18n.MessageService messageService;

    // Các nguồn cam kết được kiểm tra trước khi một tài khoản bị xóa hoặc đổi vai trò.
    @Autowired(required = false)
    com.swp391.scms.scheduling.repository.ClassEnrollmentRepository classEnrollmentRepository;

    @Autowired(required = false)
    com.swp391.scms.scheduling.repository.SessionBookingRepository sessionBookingRepository;

    @Autowired(required = false)
    com.swp391.scms.scheduling.repository.ClassSessionRepository classSessionRepository;

    @Autowired(required = false)
    com.swp391.scms.coaching.repository.CoachBookingRepository coachBookingRepository;

    @Autowired(required = false)
    com.swp391.scms.membership.repository.MembershipCancellationRequestRepository cancellationRequestRepository;

    /** Constructor cho test, không có repository gói tập. */
    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, UserMapper userMapper,
                       ReceptionistRepository receptionistRepository) {
        this(userRepository, roleRepository, passwordEncoder, userMapper, receptionistRepository, null, Clock.systemDefaultZone());
    }

    /** Constructor cho test, dùng đồng hồ hệ thống. */
    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, UserMapper userMapper,
                       ReceptionistRepository receptionistRepository,
                       com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptionRepository) {
        this(userRepository, roleRepository, passwordEncoder, userMapper, receptionistRepository, subscriptionRepository, Clock.systemDefaultZone());
    }

    /** Constructor Spring dùng; repository gói tập và Clock là tùy chọn. */
    @org.springframework.beans.factory.annotation.Autowired
    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, UserMapper userMapper,
                       ReceptionistRepository receptionistRepository,
                       @org.springframework.beans.factory.annotation.Autowired(required = false)
                       com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptionRepository,
                       @org.springframework.beans.factory.annotation.Autowired(required = false)
                       Clock clock) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.userMapper = userMapper;
        this.receptionistRepository = receptionistRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    /** Danh sách người dùng chưa bị xóa; với hội viên có thêm cờ "đang bảo lưu gói" (frozen). */
    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAllByDeletedAtIsNullOrderByIdAsc().stream()
                .map(u -> {
                    UserDto dto = userMapper.toDto(u);
                    if (subscriptionRepository != null && u.getRole() != null && "MEMBER".equalsIgnoreCase(u.getRole().getCode())) {
                        dto.setSubscriptionFrozen(subscriptionRepository.existsByMemberUserIdAndStatus(u.getId(), "frozen"));
                    }
                    return dto;
                })
                .toList();
    }

    /** Chi tiết người dùng chưa bị xóa; với hội viên có thêm cờ "đang bảo lưu gói". */
    @Transactional(readOnly = true)
    public UserDto getUserById(Long id) {
        User u = findActiveUser(id);
        UserDto dto = userMapper.toDto(u);
        if (subscriptionRepository != null && u.getRole() != null && "MEMBER".equalsIgnoreCase(u.getRole().getCode())) {
            dto.setSubscriptionFrozen(subscriptionRepository.existsByMemberUserIdAndStatus(u.getId(), "frozen"));
        }
        return dto;
    }

    /**
     * Chuẩn hóa SĐT: bỏ khoảng trắng, dấu chấm, gạch, ngoặc; đổi +84xxxxxxxxx hoặc 84xxxxxxxxx về 0xxxxxxxxx.
     * Chuỗi rỗng trả null.
     */
    public static String normalizePhone(String rawPhone) {
        if (rawPhone == null) return null;
        String compact = rawPhone.trim().replaceAll("[\\s.\\-()]+", "");
        if (compact.isEmpty()) return null;
        if (compact.startsWith("+84") && compact.length() == 12 && compact.substring(3).chars().allMatch(Character::isDigit)) {
            return "0" + compact.substring(3);
        }
        if (compact.startsWith("84") && compact.length() == 11 && compact.chars().allMatch(Character::isDigit)) {
            return "0" + compact.substring(2);
        }
        return compact;
    }

    /**
     * Email đã có người dùng chưa (so không phân biệt hoa thường và bỏ khoảng trắng; tính cả tài khoản đã xóa).
     * Có nhiều kết quả cũng coi là đã tồn tại.
     */
    public static boolean emailExists(UserRepository userRepository, String rawEmail) {
        if (rawEmail == null || rawEmail.isBlank()) return false;
        String clean = rawEmail.trim();
        try {
            if (userRepository.findByEmailIgnoreCase(clean).isPresent()) return true;
        } catch (org.springframework.dao.IncorrectResultSizeDataAccessException ex) {
            return true;
        }
        return userRepository.existsByNormalizedEmail(clean);
    }

    /**
     * SĐT đã có người khác dùng chưa (trừ người có id excludeUserId): thử mọi cách viết tương đương (0...,
     * +84..., 84...) và cả dạng đã bỏ ký tự phân cách.
     */
    public static boolean phoneExists(UserRepository userRepository, String rawPhone, Long excludeUserId) {
        String normalized = normalizePhone(rawPhone);
        if (normalized == null) return false;
        String trimmed = rawPhone.trim();
        java.util.LinkedHashSet<String> candidates = new java.util.LinkedHashSet<>();
        candidates.add(normalized);
        candidates.add(trimmed);
        if (normalized.startsWith("0") && normalized.length() == 10 && normalized.chars().allMatch(Character::isDigit)) {
            candidates.add("+84" + normalized.substring(1));
            candidates.add("84" + normalized.substring(1));
        }
        for (String candidate : candidates) {
            try {
                var found = userRepository.findByPhone(candidate);
                if (found.isPresent() && (excludeUserId == null || !java.util.Objects.equals(found.get().getId(), excludeUserId))) {
                    return true;
                }
            } catch (org.springframework.dao.IncorrectResultSizeDataAccessException ex) {
                return true;
            }
        }
        var compactMatches = userRepository.findAllByCompactPhoneIn(candidates);
        return compactMatches != null && compactMatches.stream()
                .anyMatch(u -> excludeUserId == null || !java.util.Objects.equals(u.getId(), excludeUserId));
    }

    /**
     * Tạo người dùng: email và SĐT không trùng, mật khẩu băm BCrypt, email chữ thường, ảnh mặc định, trạng thái
     * active. Tạo kèm hồ sơ HLV/lễ tân theo vai trò, và hồ sơ hội viên (mã MEM-<id>) nếu là MEMBER.
     */
    @Transactional
    @Audited(action = "USER_CREATE", entity = "users")
    public UserDto createUser(UserCreateDto dto) {
        if (emailExists(userRepository, dto.getEmail())) {
            throw new ConflictException("EMAIL_EXISTS", "users.email_exists", null, null);
        }
        String normalizedPhone = normalizePhone(dto.getPhone());
        if (normalizedPhone != null && phoneExists(userRepository, dto.getPhone(), null)) {
            throw new ConflictException("PHONE_EXISTS", "users.phone_exists", null, null);
        }

        Role role = findRole(dto.getRoleId());

        User user = new User();
        user.setRole(role);
        user.setFullName(dto.getFullName().trim());
        user.setEmail(dto.getEmail().trim().toLowerCase(Locale.ROOT));
        user.setPhone(normalizedPhone);
        user.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
        user.setGender(dto.getGender() != null && !dto.getGender().isBlank()
                ? dto.getGender().trim().toLowerCase(Locale.ROOT)
                : null);
        user.setAvatarUrl(User.DEFAULT_AVATAR_URL);
        user.setStatus("active");
        user.setCreatedAt(LocalDateTime.now(clock));
        user.setUpdatedAt(LocalDateTime.now(clock));

        User saved = userRepository.saveAndFlush(user);
        initializeStaffProfile(saved);
        if ("MEMBER".equalsIgnoreCase(role.getCode())) {
            Member member = new Member();
            member.setUser(saved);
            member.setMembershipCode("MEM-" + saved.getId());
            member.setJoinDate(LocalDate.now(clock));
            member.setFitnessLevel("beginner");
            saved.setMember(member);
            userRepository.save(saved);
        }
        if (saved.getCoach() != null || saved.getReceptionist() != null) {
            userRepository.save(saved);
        }
        return userMapper.toDto(saved);
    }

    /** Tạo hồ sơ HLV hoặc lễ tân (ngày vào làm là hôm nay) nếu vai trò yêu cầu mà chưa có. */
    private void initializeStaffProfile(User user) {
        if ("COACH".equalsIgnoreCase(user.getRole().getCode()) && user.getCoach() == null) {
            var coach = new com.swp391.scms.users.entity.Coach();
            coach.setUser(user);
            coach.setHireDate(LocalDate.now(clock));
            user.setCoach(coach);
        }
        if ("RECEPTIONIST".equalsIgnoreCase(user.getRole().getCode()) && user.getReceptionist() == null) {
            var receptionist = new com.swp391.scms.users.entity.Receptionist();
            receptionist.setUser(user);
            receptionist.setHireDate(LocalDate.now(clock));
            user.setReceptionist(receptionist);
        }
    }

    /**
     * Sửa người dùng: họ tên, SĐT (không trùng), giới tính. Khi đổi vai trò: không được bỏ Admin cuối cùng,
     * không được đổi khi còn cam kết (gói tập, lịch đặt, lịch dạy), và tạo hồ sơ còn thiếu cho vai trò mới.
     */
    @Transactional
    @Audited(action = "USER_UPDATE", entity = "users")
    public UserDto updateUser(Long id, UserUpdateDto dto) {
        User user = findActiveUser(id);

        if (dto.getFullName() != null) {
            user.setFullName(dto.getFullName().trim());
        }
        if (dto.getPhone() != null) {
            String phone = normalizePhone(dto.getPhone());
            if (phone != null && phoneExists(userRepository, dto.getPhone(), id)) {
                throw new ConflictException("PHONE_EXISTS", "users.phone_exists", null, null);
            }
            user.setPhone(phone);
        }
        if (dto.getGender() != null && !dto.getGender().isBlank()) {
            user.setGender(dto.getGender().trim().toLowerCase(Locale.ROOT));
        }
        if (dto.getRoleId() != null) {
            Role newRole = findRole(dto.getRoleId());
            if (!"ADMIN".equalsIgnoreCase(newRole.getCode())) {
                protectLastActiveAdmin(user);
            }
            if (user.getRole() == null || !newRole.getCode().equalsIgnoreCase(user.getRole().getCode())) {
                ensureNoOpenCommitments(user);
            }
            user.setRole(newRole);
            initializeStaffProfile(user);
            if ("MEMBER".equalsIgnoreCase(newRole.getCode()) && user.getMember() == null) {
                Member member = new Member();
                member.setUser(user);
                member.setMembershipCode("MEM-" + user.getId());
                member.setJoinDate(LocalDate.now(clock));
                member.setFitnessLevel("beginner");
                user.setMember(member);
            }
        }
        user.setUpdatedAt(LocalDateTime.now(clock));
        return userMapper.toDto(userRepository.save(user));
    }

    /**
     * Xóa mềm người dùng (đặt deletedAt) sau khi kiểm tra không phải Admin active cuối cùng và không còn cam
     * kết dang dở.
     */
    @Transactional
    @Audited(action = "USER_DELETE", entity = "users")
    public void deleteUser(Long id) {
        User user = findActiveUser(id);
        protectLastActiveAdmin(user);
        ensureNoOpenCommitments(user);
        LocalDateTime now = LocalDateTime.now(clock);
        user.setDeletedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);
    }

    /** Danh sách người dùng đã bị xóa mềm, mới xóa trước. */
    @Transactional(readOnly = true)
    public List<UserDto> getDeletedUsers() {
        return userRepository.findAllByDeletedAtIsNotNullOrderByIdDesc().stream()
                .map(userMapper::toDto)
                .toList();
    }

    /** Khôi phục người dùng đã xóa mềm và đặt lại trạng thái active; người chưa bị xóa thì báo lỗi 400. */
    @Transactional
    @Audited(action = "USER_RESTORE", entity = "users")
    public UserDto restoreUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", id));
        if (user.getDeletedAt() == null) {
            throw new BadRequestException("USER_NOT_DELETED", "users.not_deleted", null, null);
        }
        user.setDeletedAt(null);
        user.setStatus("active");
        user.setUpdatedAt(LocalDateTime.now(clock));
        return userMapper.toDto(userRepository.save(user));
    }

    /**
     * Đặt trạng thái active hoặc locked. Không được khóa Admin active cuối cùng. Khi khóa: giải phóng các lịch
     * còn treo (xem releaseCommitmentsOnLock).
     */
    @Transactional
    @Audited(action = "USER_STATUS_CHANGE", entity = "users")
    public UserDto setStatus(Long id, String status) {
        if (!"active".equals(status) && !"locked".equals(status)) {
            throw new BadRequestException("INVALID_USER_STATUS", "users.invalid_status", null, null);
        }
        User user = findActiveUser(id);
        if (!"active".equals(status)) protectLastActiveAdmin(user);
        if ("locked".equals(status) && !"locked".equals(user.getStatus())) releaseCommitmentsOnLock(user);
        user.setStatus(status);
        user.setUpdatedAt(LocalDateTime.now(clock));
        return userMapper.toDto(userRepository.save(user));
    }

    /**
     * Chặn xóa/đổi vai trò khi còn cam kết: hội viên còn gói hiệu lực/đang bảo lưu/chờ thanh toán hoặc còn lịch
     * đặt sắp tới, hoặc HLV còn dạy lớp hay buổi 1:1 sắp tới thì phải giữ nguyên tài khoản và vai trò cho tới
     * khi quản lý xử lý xong trước. Riêng hội viên đã có yêu cầu hủy gói được duyệt thì các gói còn lại được
     * chuyển sang cancelled trước.
     */
    private void ensureNoOpenCommitments(User user) {
        if (user.getRole() == null || user.getId() == null) return;
        String role = user.getRole().getCode().toUpperCase(Locale.ROOT);
        Long id = user.getId();
        LocalDate today = LocalDate.now(clock);
        if ("MEMBER".equals(role)) {
            if (subscriptionRepository != null && cancellationRequestRepository != null
                    && cancellationRequestRepository.existsByMemberUserIdAndStatus(id, "APPROVED")) {
                List<MembershipSubscription> remaining = subscriptionRepository.findByMemberUserId(id).stream()
                        .filter(s -> List.of("active", "frozen", "pending_payment").contains(s.getStatus()))
                        .toList();
                for (MembershipSubscription rem : remaining) {
                    rem.setStatus("cancelled");
                    rem.setUpdatedAt(LocalDateTime.now(clock));
                    subscriptionRepository.save(rem);
                }
            }
            if (subscriptionRepository != null && subscriptionRepository.existsByMemberUserIdAndStatusInAndEndDateGreaterThanEqual(
                    id, List.of("active", "frozen", "pending_payment"), today)) {
                throw new ConflictException("USER_HAS_OPEN_COMMITMENTS", "users.blocked.membership", null, null);
            }
            if ((classEnrollmentRepository != null && classEnrollmentRepository.existsUpcomingBookedForMember(id, today))
                    || (sessionBookingRepository != null && sessionBookingRepository.existsUpcomingBookedForMember(id, today))
                    || (coachBookingRepository != null && coachBookingRepository.existsUpcomingForMember(id, today))) {
                throw new ConflictException("USER_HAS_OPEN_COMMITMENTS", "users.blocked.bookings", null, null);
            }
        } else if ("COACH".equals(role)) {
            if (classSessionRepository != null && classSessionRepository.existsScheduledForCoachFrom(id, today)) {
                throw new ConflictException("USER_HAS_OPEN_COMMITMENTS", "users.blocked.coach_classes", null, null);
            }
            if (coachBookingRepository != null && coachBookingRepository.existsUpcomingForCoach(id, today)) {
                throw new ConflictException("USER_HAS_OPEN_COMMITMENTS", "users.blocked.coach_sessions", null, null);
            }
        }
    }

    /**
     * Khi khóa tài khoản: HLV phải bàn giao lớp/buổi PT trước (kiểm tra như khi xóa); hội viên được hủy các chỗ
     * đặt theo buổi sắp tới để người khác đặt. Các mục đã trả tiền để quầy hủy và hoàn tiền.
     *
     * Việc khóa không được để lại lịch: HLV trước hết bàn giao các lớp và buổi 1:1 sắp tới; chỗ theo buổi sắp
     * tới của hội viên được nhả để người khác đặt. Các mục đã trả tiền (khóa học, 1:1) để quầy hủy và
     * hoàn tiền.
     */
    private void releaseCommitmentsOnLock(User user) {
        String role = user.getRole() == null ? "" : user.getRole().getCode().toUpperCase(Locale.ROOT);
        if ("COACH".equals(role)) {
            ensureNoOpenCommitments(user);
        } else if ("MEMBER".equals(role) && sessionBookingService != null) {
            String reason = messageService != null
                    ? messageService.getMessage("scheduling.booking.cancelled_by_account_lock") : "Account locked";
            sessionBookingService.cancelFutureForMember(user.getId(), reason, date -> false);
        }
    }

    /** Lấy vai trò theo id; không thấy thì báo 404. */
    private Role findRole(Long roleId) {
        return roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.role", roleId));
    }

    /**
     * Không cho khóa/xóa/đổi vai trò Admin active cuối cùng. Khóa dòng vai trò ADMIN trước khi đếm để hai
     * request song song không cùng gỡ hai Admin cuối.
     */
    private void protectLastActiveAdmin(User user) {
        if (user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().getCode())
                && "active".equalsIgnoreCase(user.getStatus())) {
            // Tuần tự hóa các thao tác gỡ trên dòng vai trò dùng chung để các request đồng thời không gỡ được
            // cả hai Admin.
            roleRepository.lockByCode("ADMIN");
            if (userRepository.countByRole_CodeAndDeletedAtIsNullAndStatus("ADMIN", "active") <= 1) {
                throw new ConflictException("LAST_ACTIVE_ADMIN", "users.last_active_admin", null, null);
            }
        }
    }

    /** Lấy người dùng chưa bị xóa; không thấy thì báo 404. */
    private User findActiveUser(Long id) {
        return userRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.user", id));
    }

    /** Cập nhật ca làm của lễ tân (người dùng phải có vai trò RECEPTIONIST); chưa có hồ sơ thì tạo mới. */
    @Transactional
    @Audited(action = "RECEPTIONIST_PROFILE_UPDATE", entity = "receptionists")
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

    /**
     * Tự động xóa mềm tài khoản không đăng nhập quá 6 tháng (180 ngày).
     * Ngoại trừ: Tài khoản Quản lý trung tâm (CENTER_MANAGER) và các tài khoản hội viên đang có gói bảo lưu tập (frozen).
     */
    @Transactional
    @Audited(action = "USER_CLEANUP_INACTIVE", entity = "users")
    public int cleanupInactiveUsers() {
        LocalDateTime sixMonthsAgo = LocalDateTime.now(clock).minusMonths(6);
        List<User> users = userRepository.findAllByDeletedAtIsNullOrderByIdAsc();
        int count = 0;
        for (User user : users) {
            // Tài khoản nhân viên do quản lý cho nghỉ, không bao giờ do tác vụ quét; vai trò lạ không bị đoán.
            if (user.getRole() == null || user.getRole().getCode() == null
                    || NEVER_AUTO_DELETED.contains(user.getRole().getCode().toUpperCase(Locale.ROOT))) {
                continue;
            }

            LocalDateTime refTime = user.getLastLoginAt() != null ? user.getLastLoginAt() : user.getCreatedAt();
            if (refTime == null || !refTime.isBefore(sixMonthsAgo)) {
                continue;
            }
            if (user.getId() == null || hasRecentUseOrEntitlement(user.getId(), sixMonthsAgo)) {
                continue;
            }
            LocalDateTime now = LocalDateTime.now(clock);
            user.setDeletedAt(now);
            user.setUpdatedAt(now);
            userRepository.save(user);
            count++;
        }
        return count;
    }

    /**
     * Hội viên còn (hoặc gần đây còn) gói tập, hoặc đã check-in hay thanh toán trong khoảng thời gian xét thì
     * coi là còn hoạt động. Không kiểm tra được gói tập thì giữ tài khoản cho an toàn.
     *
     * True khi hội viên còn (hoặc vừa có) membership, hoặc đã quét vào hay thanh toán trong khoảng thời gian.
     * Thiếu nguồn subscription thì không xác minh được gì, nên giữ tài khoản.
     */
    private boolean hasRecentUseOrEntitlement(Long userId, LocalDateTime since) {
        if (subscriptionRepository == null
                || subscriptionRepository.existsEntitlementEndingOnOrAfter(userId, since.toLocalDate())) {
            return true;
        }
        if (checkinRepository != null && checkinRepository.existsByMemberUserIdAndCheckInTimeGreaterThanEqual(userId, since)) {
            return true;
        }
        return paymentRepository != null && paymentRepository.existsByMemberUserIdAndPaidAtGreaterThanEqual(userId, since);
    }

    /**
     * Tác vụ tự động quét dọn dẹp chạy định kỳ hàng ngày vào 02:00 sáng.
     */
    @Transactional
    @Audited(action = "USER_CLEANUP_INACTIVE", entity = "users")
    @org.springframework.scheduling.annotation.Scheduled(cron = "${app.users.cleanup.cron:0 0 2 * * ?}")
    public void scheduleInactiveUsersCleanup() {
        cleanupInactiveUsers();
    }
}
