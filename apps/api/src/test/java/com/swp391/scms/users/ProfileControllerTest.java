package com.swp391.scms.users;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.dto.CoachProfileUpdateDto;
import com.swp391.scms.users.dto.ProfileDto;
import com.swp391.scms.users.dto.ReceptionistProfileUpdateDto;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Receptionist;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.time.LocalDate;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Bộ kiểm thử cho controller ProfileController (profile controller). */
@ExtendWith(MockitoExtension.class)
class ProfileControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private UserRepository userRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private CoachRepository coachRepository;

    @Mock
    private ReceptionistRepository receptionistRepository;

    private ProfileService profileService;
    private ProfileController profileController;
    private MessageService messageService;

    private final HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
        /** Bộ phân giải tham số giả của test: cho biết có hỗ trợ tham số này không. */
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        /** Bộ phân giải tham số giả của test: cấp principal đã đăng nhập cho tham số controller. */
        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            jakarta.servlet.http.HttpServletRequest req = webRequest.getNativeRequest(jakarta.servlet.http.HttpServletRequest.class);
            String role = req.getHeader("X-Test-Role");
            if (role == null) {
                role = "MEMBER";
                if (req.getRequestURI().contains("/coach")) role = "COACH";
                if (req.getRequestURI().contains("/receptionist")) role = "RECEPTIONIST";
            }
            return new AuthenticatedPrincipal(101L, "member1", role);
        }
    };

    /** Chuẩn bị trước mỗi test: dựng MockMvc và phụ thuộc cho controller hồ sơ. */
    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        messageService = new MessageService(messageSource);

        profileService = new ProfileService(userRepository, memberRepository, coachRepository, receptionistRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(profileService, "kycCrypto", new KycCrypto("test-only-secret"));
        profileController = new ProfileController(profileService, messageService);

        AcceptHeaderLocaleResolver localeResolver = new AcceptHeaderLocaleResolver();
        localeResolver.setDefaultLocale(new Locale("vi"));

        mockMvc = MockMvcBuilders.standaloneSetup(profileController)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .setCustomArgumentResolvers(principalResolver)
                .setLocaleResolver(localeResolver)
                .build();
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (sample profile). */
    private ProfileDto sampleProfile() {
        return new ProfileDto(
                101L,
                "Nguyen Van A",
                "a@gmail.com",
                "0912345678",
                LocalDate.of(1990, 1, 1),
                "MALE",
                null,
                "Hanoi",
                "MB-001",
                "None",
                "Stay healthy",
                "INTERMEDIATE",
                "Nguyen Van B",
                "0987654321"
        );
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (sample user). */
    private User sampleUser() {
        User user = new User();
        user.setId(101L);
        user.setUsername("member1");
        com.swp391.scms.users.entity.Role role = new com.swp391.scms.users.entity.Role();
        role.setCode("MEMBER");
        user.setRole(role);
        user.setDeletedAt(null);
        return user;
    }

    /** Kiểm thử: lấy hồ sơ của tôi thành công. */
    @Test
    @DisplayName("GET /api/v1/profile returns current authenticated user profile including Coach & Receptionist details")
    void getMyProfileSuccess() throws Exception {
        User user = sampleUser();
        user.setAvatarUrl("data:image/png;base64,aGVsbG8=");
        Coach coach = new Coach();
        coach.setSpecialization("Pilates");
        coach.setBio("5 years");
        coach.setCertification("CPT");
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));
        when(coachRepository.findById(101L)).thenReturn(Optional.of(coach));

        mockMvc.perform(get("/api/v1/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.avatarUrl").value("data:image/png;base64,aGVsbG8="))
                .andExpect(jsonPath("$.data.specialization").value("Pilates"))
                .andExpect(jsonPath("$.data.certification").value("CPT"));
    }

    /** Kiểm thử: cập nhật hồ sơ của tôi thành công (hỗ trợ họ tên dài tới 150 ký tự khớp DB). */
    @Test
    @DisplayName("PUT /api/v1/profile updates profile and returns 200")
    void updateMyProfileSuccess() throws Exception {
        ProfileDto request = sampleProfile();
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(sampleUser()));

        mockMvc.perform(put("/api/v1/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        var longNamePayload = objectMapper.valueToTree(sampleProfile());
        ((com.fasterxml.jackson.databind.node.ObjectNode) longNamePayload).put("fullName", "A".repeat(120));
        mockMvc.perform(put("/api/v1/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(longNamePayload.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    /** Kiểm thử: từ chối giới tính không hợp lệ thay vì âm thầm xóa. */
    @Test
    void rejectsInvalidGenderInsteadOfSilentlyClearingIt() throws Exception {
        User user = sampleUser();
        user.setGender("male");
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));
        var payload = objectMapper.valueToTree(sampleProfile());
        ((com.fasterxml.jackson.databind.node.ObjectNode) payload).put("gender", "invalid");
        mockMvc.perform(put("/api/v1/profile").header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON).content(payload.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_GENDER"))
                .andExpect(jsonPath("$.message").value("Invalid gender. Allowed values: male, female, other"));
    }

    /** Kiểm thử: từ chối mức thể lực không hợp lệ thay vì báo lưu thành công. */
    @Test
    void rejectsInvalidFitnessLevelInsteadOfReportingSuccessfulSave() throws Exception {
        var member = new com.swp391.scms.users.entity.Member();
        member.setFitnessLevel("beginner");
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(sampleUser()));
        when(memberRepository.findById(101L)).thenReturn(Optional.of(member));
        var payload = objectMapper.valueToTree(sampleProfile());
        ((com.fasterxml.jackson.databind.node.ObjectNode) payload).put("fitnessLevel", "expert");
        mockMvc.perform(put("/api/v1/profile").header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON).content(payload.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FITNESS_LEVEL"))
                .andExpect(jsonPath("$.message").value("Fitness level must be beginner, intermediate or advanced"));
    }

    /** Tạo header WebP VP8L tối giản hợp lệ với kích thước width x height (dùng kiểm thử không giải nén pixel). */
    private static byte[] minimalWebpVp8l(int width, int height) {
        int bits = ((width - 1) & 0x3FFF) | (((height - 1) & 0x3FFF) << 14);
        return new byte[]{
                'R', 'I', 'F', 'F', 18, 0, 0, 0,
                'W', 'E', 'B', 'P',
                'V', 'P', '8', 'L', 6, 0, 0, 0,
                0x2F,
                (byte) (bits & 0xFF),
                (byte) ((bits >>> 8) & 0xFF),
                (byte) ((bits >>> 16) & 0xFF),
                (byte) ((bits >>> 24) & 0xFF),
                0
        };
    }

    /** Tạo header PNG IHDR với kích thước tùy ý (dùng kiểm thử chống bom giải nén 30000x30000 mà không cấp phát pixel). */
    private static byte[] minimalPngHeader(int width, int height) {
        return new byte[]{
                (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A,
                0, 0, 0, 13,
                'I', 'H', 'D', 'R',
                (byte) (width >>> 24), (byte) (width >>> 16), (byte) (width >>> 8), (byte) width,
                (byte) (height >>> 24), (byte) (height >>> 16), (byte) (height >>> 8), (byte) height,
                8, 2, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
                'I', 'E', 'N', 'D',
                (byte) 0xAE, 0x42, 0x60, (byte) 0x82
        };
    }

    /** Kiểm thử P1-BE-10: kiểm tra ràng buộc thật (magic bytes, kích thước header, chống bom giải nén & chặn URL ngoài). */
    @Test
    @DisplayName("POST /api/v1/profile/avatar validates magic bytes, header dimensions, size limit and internal path only")
    void validateAvatarUploadConstraints() throws Exception {
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(sampleUser()));

        String validWebpDataUrl = "data:image/webp;base64," + Base64.getEncoder().encodeToString(minimalWebpVp8l(120, 120));
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(validWebpDataUrl))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").value(validWebpDataUrl));

        // Giả mạo MIME image/webp với byte rác phải bị từ chối thay vì lọt qua.
        String forgedWebp = "data:image/webp;base64," + Base64.getEncoder().encodeToString(new byte[]{1, 2, 3, 4});
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(forgedWebp))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AVATAR_DATA"));

        String invalidMime = "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString("<svg/>".getBytes());
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(invalidMime))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AVATAR_FORMAT"));

        byte[] oversized = new byte[2 * 1024 * 1024 + 10];
        String oversizedDataUrl = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(oversized);
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(oversizedDataUrl))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("AVATAR_TOO_LARGE"));

        // Bom giải nén PNG 30000x30000 phải bị chặn ngay ở bước đọc header IHDR mà không gây OOM.
        String bombPng = "data:image/png;base64," + Base64.getEncoder().encodeToString(minimalPngHeader(30000, 30000));
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(bombPng))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AVATAR_DIMENSIONS"));

        // URL ngoài và protocol-relative bị chặn; chỉ cho phép đường dẫn nội bộ /images/...
        for (String external : java.util.List.of("https://evil.example/a.png", "http://169.254.169.254/latest", "//evil.example/a.png", "/images/../secret.png")) {
            mockMvc.perform(post("/api/v1/profile/avatar")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(external))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_AVATAR_URL"));
        }
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest("/images/default-avatar.png"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").value("/images/default-avatar.png"));

        java.awt.image.BufferedImage tinyImg = new java.awt.image.BufferedImage(10, 10, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream tinyOut = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(tinyImg, "png", tinyOut);
        String tinyDataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(tinyOut.toByteArray());
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(tinyDataUrl))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AVATAR_DIMENSIONS"))
                .andExpect(jsonPath("$.message").value("Avatar image dimensions must be between 100x100 px and 4096x4096 px."));

        java.awt.image.BufferedImage validImg = new java.awt.image.BufferedImage(120, 120, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream validOut = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(validImg, "png", validOut);
        String validPngDataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(validOut.toByteArray());
        mockMvc.perform(post("/api/v1/profile/avatar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProfileController.AvatarUploadRequest(validPngDataUrl))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").value(validPngDataUrl));
    }

    /** Kiểm thử: cập nhật hồ sơ giữ nguyên ảnh đại diện tùy chỉnh khi gửi null. */
    @Test
    @DisplayName("PUT /api/v1/profile preserves existing custom avatar when request avatarUrl is null")
    void updateMyProfilePreservesExistingCustomAvatarWhenNull() throws Exception {
        User user = sampleUser();
        user.setAvatarUrl("https://cdn.example.com/custom-avatar.png");
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));

        mockMvc.perform(put("/api/v1/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleProfile())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").value("https://cdn.example.com/custom-avatar.png"));
    }

    /** Kiểm thử: cập nhật hồ sơ HLV của tài khoản đã xóa bị từ chối. */
    @Test
    @DisplayName("PUT /api/v1/profile/coach returns 404 when user is deleted")
    void updateCoachProfileDeletedUser() throws Exception {
        CoachProfileUpdateDto request = new CoachProfileUpdateDto(
                "Yoga",
                "10 years experience",
                "Certified Yoga Instructor"
        );
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/v1/profile/coach")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("User not found with identifier: 101"));
    }

    /** Kiểm thử: cập nhật hồ sơ HLV sai vai trò trả thông báo tiếng Anh. */
    @Test
    @DisplayName("PUT /api/v1/profile/coach returns 403 when wrong role (Test with English Accept-Language)")
    void updateCoachProfileWrongRoleEnglish() throws Exception {
        CoachProfileUpdateDto request = new CoachProfileUpdateDto(
                "Yoga",
                "10 years experience",
                "Certified Yoga Instructor"
        );

        mockMvc.perform(put("/api/v1/profile/coach")
                        .header("Accept-Language", "en").header("X-Test-Role", "MEMBER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Only Coach can update professional profile"));
    }

    /** Kiểm thử: cập nhật hồ sơ HLV tạo mới khi chưa có. */
    @Test
    @DisplayName("PUT /api/v1/profile/coach creates new coach profile when missing")
    void updateCoachProfileCreateNew() throws Exception {
        CoachProfileUpdateDto request = new CoachProfileUpdateDto(
                "Yoga",
                "10 years experience",
                "Certified Yoga Instructor"
        );
        User coachUser = sampleUser();
        com.swp391.scms.users.entity.Role r = new com.swp391.scms.users.entity.Role();
        r.setCode("COACH");
        coachUser.setRole(r);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(coachUser));
        when(coachRepository.findById(101L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/v1/profile/coach")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    /** Kiểm thử: cập nhật hồ sơ HLV đã có. */
    @Test
    @DisplayName("PUT /api/v1/profile/coach updates existing coach profile")
    void updateCoachProfileUpdateExisting() throws Exception {
        CoachProfileUpdateDto request = new CoachProfileUpdateDto(
                "Yoga",
                "10 years experience",
                "Certified Yoga Instructor"
        );
        User coachUser = sampleUser();
        com.swp391.scms.users.entity.Role r = new com.swp391.scms.users.entity.Role();
        r.setCode("COACH");
        coachUser.setRole(r);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(coachUser));

        Coach existingCoach = new Coach();
        existingCoach.setUserId(101L);
        when(coachRepository.findById(101L)).thenReturn(Optional.of(existingCoach));

        mockMvc.perform(put("/api/v1/profile/coach")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    /** Kiểm thử: cập nhật hồ sơ lễ tân thành công. */
    @Test
    @DisplayName("PUT /api/v1/profile/receptionist updates existing receptionist profile")
    void updateReceptionistProfileSuccess() throws Exception {
        ReceptionistProfileUpdateDto request = new ReceptionistProfileUpdateDto("Morning");
        User recUser = sampleUser();
        com.swp391.scms.users.entity.Role r = new com.swp391.scms.users.entity.Role();
        r.setCode("RECEPTIONIST");
        recUser.setRole(r);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(recUser));

        Receptionist existingRec = new Receptionist();
        existingRec.setUserId(101L);
        when(receptionistRepository.findById(101L)).thenReturn(Optional.of(existingRec));

        mockMvc.perform(put("/api/v1/profile/receptionist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Cập nhật hồ sơ Lễ tân thành công"));
    }

    /** Kiểm thử: cập nhật hồ sơ lễ tân sai vai trò bị từ chối. */
    @Test
    @DisplayName("PUT /api/v1/profile/receptionist returns 403 when wrong role")
    void updateReceptionistProfileWrongRole() throws Exception {
        ReceptionistProfileUpdateDto request = new ReceptionistProfileUpdateDto("Morning");

        mockMvc.perform(put("/api/v1/profile/receptionist")
                        .header("X-Test-Role", "MEMBER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    /** Kiểm thử: ca làm việc của lễ tân quá dài bị từ chối. */
    @Test
    @DisplayName("PUT /api/v1/profile/receptionist returns 400 when shift exceeds max length")
    void updateReceptionistProfileShiftTooLong() throws Exception {
        ReceptionistProfileUpdateDto request = new ReceptionistProfileUpdateDto("A".repeat(60));

        mockMvc.perform(put("/api/v1/profile/receptionist")
                        .header("X-Test-Role", "RECEPTIONIST")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    /** Kiểm thử: gửi KYC bằng CCCD thành công. */
    @Test
    @DisplayName("POST /api/v1/profile/kyc successfully verifies CCCD and synchronizes full name")
    void submitKycCccdSuccess() throws Exception {
        User user = sampleUser();
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));
        com.swp391.scms.users.entity.Member member = new com.swp391.scms.users.entity.Member();
        member.setUserId(101L);
        member.setUser(user);
        when(memberRepository.findByUserIdForUpdate(101L)).thenReturn(Optional.of(member));

        com.swp391.scms.users.dto.MemberKycRequest request = new com.swp391.scms.users.dto.MemberKycRequest(
                "CCCD", "012345678901", "NGUYEN VAN A", "Việt Nam", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        );

        mockMvc.perform(post("/api/v1/profile/kyc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fullName").value("NGUYEN VAN A"))
                // Giấy tờ hội viên tự khai báo phải chờ lễ tân duyệt: chưa xác minh ngay cho hội viên.
                .andExpect(jsonPath("$.data.identityVerified").value(false))
                .andExpect(jsonPath("$.data.kycStatus").value("PENDING"));
    }

    /** Kiểm thử: gửi KYC bằng hộ chiếu bị từ chối với thông báo tiếng Việt. */
    @Test
    @DisplayName("POST /api/v1/profile/kyc rejects Vietnamese citizen using passport")
    void submitKycPassportVietnameseRejected() throws Exception {
        User user = sampleUser();
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));
        com.swp391.scms.users.entity.Member member = new com.swp391.scms.users.entity.Member();
        member.setUserId(101L);
        member.setUser(user);
        when(memberRepository.findByUserIdForUpdate(101L)).thenReturn(Optional.of(member));

        com.swp391.scms.users.dto.MemberKycRequest request = new com.swp391.scms.users.dto.MemberKycRequest(
                "PASSPORT", "P12345678", "JOHN DOE", "Vietnam", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", null
        );

        mockMvc.perform(post("/api/v1/profile/kyc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TRIAL_PASSPORT_FOREIGN_ONLY"));
    }

    /** Kiểm thử: đổi mật khẩu thành công. */
    @Test
    @DisplayName("POST /api/v1/profile/password updates password and sends notification")
    void changePasswordSuccess() throws Exception {
        User user = sampleUser();
        user.setEmail("member1@example.com");
        user.setPasswordHash("old-hash");
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(user));

        var passwordEncoder = org.mockito.Mockito.mock(org.springframework.security.crypto.password.PasswordEncoder.class);
        var notificationService = org.mockito.Mockito.mock(com.swp391.scms.notifications.NotificationService.class);
        when(passwordEncoder.matches("OldPass123", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("NewPass456")).thenReturn("new-hash");

        ProfileService svcWithDeps = new ProfileService(
                userRepository, memberRepository, coachRepository, receptionistRepository,
                passwordEncoder, notificationService, messageService
        );
        MockMvc customMvc = MockMvcBuilders.standaloneSetup(new ProfileController(svcWithDeps, messageService))
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .setCustomArgumentResolvers(principalResolver)
                .build();

        ProfileController.ChangePasswordRequest req = new ProfileController.ChangePasswordRequest("OldPass123", "NewPass456");

        customMvc.perform(post("/api/v1/profile/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        org.junit.jupiter.api.Assertions.assertEquals("new-hash", user.getPasswordHash());
        org.mockito.Mockito.verify(notificationService).send(
                org.mockito.ArgumentMatchers.eq(101L),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq("password_changed"),
                org.mockito.ArgumentMatchers.eq("user"),
                org.mockito.ArgumentMatchers.eq(101L)
        );
    }
}
