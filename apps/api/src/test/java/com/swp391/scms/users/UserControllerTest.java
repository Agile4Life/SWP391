package com.swp391.scms.users;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.users.dto.UserCreateDto;
import com.swp391.scms.users.dto.UserDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController userController;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        mockMvc = MockMvcBuilders.standaloneSetup(userController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private UserDto sampleUser(Long id, String roleCode, String status) {
        UserDto u = new UserDto();
        u.setId(id);
        u.setRoleCode(roleCode);
        u.setFullName("User " + id);
        u.setEmail("u" + id + "@test.com");
        u.setPhone("0901234567");
        u.setStatus(status);
        u.setCreatedAt(LocalDateTime.now());
        return u;
    }

    @Test
    @DisplayName("GET /api/v1/users returns all active users")
    void getAllUsersSuccess() throws Exception {
        when(userService.getAllUsers()).thenReturn(List.of(
                sampleUser(1L, "CENTER_MANAGER", "active"),
                sampleUser(2L, "COACH", "active")
        ));

        mockMvc.perform(get("/api/v1/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].roleCode").value("CENTER_MANAGER"));
    }

    @Test
    @DisplayName("GET /api/v1/users/{id} returns user detail")
    void getUserByIdSuccess() throws Exception {
        when(userService.getUserById(1L)).thenReturn(sampleUser(1L, "CENTER_MANAGER", "active"));

        mockMvc.perform(get("/api/v1/users/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.fullName").value("User 1"));
    }

    @Test
    @DisplayName("POST /api/v1/users creates new user and returns 201")
    void createUserSuccess() throws Exception {
        UserCreateDto createDto = new UserCreateDto();
        createDto.setRoleId(2L);
        createDto.setFullName("Coach Anh");
        createDto.setEmail("anh@fit.vn");
        createDto.setPhone("0987654321");
        createDto.setPassword("Pass@1234");

        when(userService.createUser(any())).thenReturn(sampleUser(3L, "COACH", "active"));

        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(3));
    }

    @Test
    @DisplayName("PATCH /api/v1/users/{id}/lock calls setStatus locked")
    void lockUserSuccess() throws Exception {
        when(userService.setStatus(eq(2L), eq("locked"))).thenReturn(sampleUser(2L, "COACH", "locked"));

        mockMvc.perform(patch("/api/v1/users/2/lock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("locked"));
    }

    @Test
    @DisplayName("PATCH /api/v1/users/{id}/unlock calls setStatus active")
    void unlockUserSuccess() throws Exception {
        when(userService.setStatus(eq(2L), eq("active"))).thenReturn(sampleUser(2L, "COACH", "active"));

        mockMvc.perform(patch("/api/v1/users/2/unlock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("active"));
    }

    @Test
    @DisplayName("DELETE /api/v1/users/{id} calls deleteUser")
    void deleteUserSuccess() throws Exception {
        mockMvc.perform(delete("/api/v1/users/4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(userService).deleteUser(4L);
    }

    @Test
    @DisplayName("PUT /api/v1/users/{id}/receptionist updates receptionist shift")
    void updateReceptionistProfileSuccess() throws Exception {
        com.swp391.scms.users.dto.ReceptionistProfileUpdateDto request = new com.swp391.scms.users.dto.ReceptionistProfileUpdateDto("Morning");

        mockMvc.perform(put("/api/v1/users/5/receptionist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        verify(userService).updateReceptionistShift(eq(5L), any());
    }


    @Test
    @DisplayName("DELETE /api/v1/users/{id} returns 403 when not allowed")
    void receptionistCannotDeleteUser() throws Exception {
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("Access is denied")).when(userService).deleteUser(4L);
        mockMvc.perform(delete("/api/v1/users/4"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
