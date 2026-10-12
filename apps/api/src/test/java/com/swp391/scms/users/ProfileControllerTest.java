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
import java.util.Locale;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().isAssignableFrom(AuthenticatedPrincipal.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            jakarta.servlet.http.HttpServletRequest req = webRequest.getNativeRequest(jakarta.servlet.http.HttpServletRequest.class); String role = req.getHeader("X-Test-Role"); if (role == null) { role = "MEMBER"; if (req.getRequestURI().contains("/coach")) role = "COACH"; if (req.getRequestURI().contains("/receptionist")) role = "RECEPTIONIST"; } return new AuthenticatedPrincipal(101L, "member1", role);
        }
    };

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

        // Setup real MessageService
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        messageService = new MessageService(messageSource);

        profileService = new ProfileService(userRepository, memberRepository, coachRepository, receptionistRepository);
        profileController = new ProfileController(profileService);

        AcceptHeaderLocaleResolver localeResolver = new AcceptHeaderLocaleResolver();
        localeResolver.setDefaultLocale(new Locale("vi"));

        mockMvc = MockMvcBuilders.standaloneSetup(profileController)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .setCustomArgumentResolvers(principalResolver)
                .setLocaleResolver(localeResolver)
                .build();
    }

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

    @Test
    @DisplayName("GET /api/v1/profile returns current authenticated user profile")
    void getMyProfileSuccess() throws Exception {
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(sampleUser()));

        mockMvc.perform(get("/api/v1/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

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
    }

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

    @Test
    @DisplayName("PUT /api/v1/profile/coach creates new coach profile when missing")
    void updateCoachProfileCreateNew() throws Exception {
        CoachProfileUpdateDto request = new CoachProfileUpdateDto(
                "Yoga",
                "10 years experience",
                "Certified Yoga Instructor"
        );
        User coachUser = sampleUser();
        com.swp391.scms.users.entity.Role r = new com.swp391.scms.users.entity.Role(); r.setCode("COACH"); coachUser.setRole(r);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(coachUser));
        when(coachRepository.findById(101L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/v1/profile/coach")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("PUT /api/v1/profile/coach updates existing coach profile")
    void updateCoachProfileUpdateExisting() throws Exception {
        CoachProfileUpdateDto request = new CoachProfileUpdateDto(
                "Yoga",
                "10 years experience",
                "Certified Yoga Instructor"
        );
        User coachUser = sampleUser();
        com.swp391.scms.users.entity.Role r = new com.swp391.scms.users.entity.Role(); r.setCode("COACH"); coachUser.setRole(r);
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

    @Test
    @DisplayName("PUT /api/v1/profile/receptionist updates existing receptionist profile")
    void updateReceptionistProfileSuccess() throws Exception {
        ReceptionistProfileUpdateDto request = new ReceptionistProfileUpdateDto(
                "Morning"
        );
        User recUser = sampleUser();
        com.swp391.scms.users.entity.Role r = new com.swp391.scms.users.entity.Role(); r.setCode("RECEPTIONIST"); recUser.setRole(r);
        when(userRepository.findByIdAndDeletedAtIsNull(101L)).thenReturn(Optional.of(recUser));
        
        Receptionist existingRec = new Receptionist();
        existingRec.setUserId(101L);
        when(receptionistRepository.findById(101L)).thenReturn(Optional.of(existingRec));

        mockMvc.perform(put("/api/v1/profile/receptionist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    

}










