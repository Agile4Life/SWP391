package com.swp391.scms.users;

import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.users.dto.PermissionDto;
import com.swp391.scms.users.dto.RoleDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Bộ kiểm thử cho controller RoleController (role controller). */
@ExtendWith(MockitoExtension.class)
class RoleControllerTest {

    private MockMvc mockMvc;

    @Mock
    private RoleService roleService;

    @InjectMocks
    private RoleController roleController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(roleController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (make role). */
    private RoleDto makeRole(Long id, String code, String name) {
        RoleDto r = new RoleDto();
        r.setId(id);
        r.setCode(code);
        r.setName(name);
        return r;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (make perm). */
    private PermissionDto makePerm(Long id, String code, String name, String module) {
        PermissionDto p = new PermissionDto();
        p.setId(id);
        p.setCode(code);
        p.setName(name);
        p.setModule(module);
        return p;
    }

    @Test
    @DisplayName("GET /api/v1/roles returns all core roles")
    void getAllRolesSuccess() throws Exception {
        when(roleService.getAllRoles()).thenReturn(List.of(
                makeRole(1L, "CENTER_MANAGER", "Quan ly"),
                makeRole(2L, "COACH", "HLV")
        ));

        mockMvc.perform(get("/api/v1/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].code").value("CENTER_MANAGER"));
    }

    @Test
    @DisplayName("GET /api/v1/roles/permissions returns all system permissions")
    void getAllPermissionsSuccess() throws Exception {
        when(roleService.getAllPermissions()).thenReturn(List.of(
                makePerm(10L, "USER_MANAGE", "Quan ly user", "USER"),
                makePerm(11L, "CLASS_MANAGE", "Quan ly lop", "CLASS")
        ));

        mockMvc.perform(get("/api/v1/roles/permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].code").value("USER_MANAGE"));
    }

    @Test
    @DisplayName("GET /api/v1/roles/{id}/permissions returns permissions of role")
    void getPermissionsByRoleIdSuccess() throws Exception {
        when(roleService.getPermissionsByRoleId(2L)).thenReturn(List.of(
                makePerm(11L, "CLASS_MANAGE", "Quan ly lop", "CLASS")
        ));

        mockMvc.perform(get("/api/v1/roles/2/permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(11));
    }

    @Test
    @DisplayName("PUT /api/v1/roles/{id}/permissions/{permId} grants permission to role")
    void grantPermissionSuccess() throws Exception {
        when(roleService.grantPermission(2L, 10L))
                .thenReturn(makePerm(10L, "USER_MANAGE", "Quan ly user", "USER"));

        mockMvc.perform(put("/api/v1/roles/2/permissions/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("USER_MANAGE"));
    }

    @Test
    @DisplayName("DELETE /api/v1/roles/{id}/permissions/{permId} revokes permission from role")
    void revokePermissionSuccess() throws Exception {
        when(roleService.revokePermission(2L, 10L))
                .thenReturn(makePerm(10L, "USER_MANAGE", "Quan ly user", "USER"));

        mockMvc.perform(delete("/api/v1/roles/2/permissions/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("USER_MANAGE"));
    }
}
