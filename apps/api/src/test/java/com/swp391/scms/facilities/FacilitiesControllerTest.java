package com.swp391.scms.facilities;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.facilities.dto.CatalogResponses.DisciplineDto;
import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.dto.CatalogResponses.RoomDto;
import com.swp391.scms.facilities.service.DisciplineService;
import com.swp391.scms.facilities.service.PackageService;
import com.swp391.scms.facilities.service.RoomService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class FacilitiesControllerTest {

    @Mock DisciplineService disciplines;
    @Mock RoomService rooms;
    @Mock PackageService packages;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new DisciplineController(disciplines), new RoomController(rooms), new PackageController(packages))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listDisciplinesReturnsWrappedData() throws Exception {
        when(disciplines.list()).thenReturn(List.of(new DisciplineDto(1L, "Yoga", null)));

        mockMvc.perform(get("/api/v1/disciplines"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].name").value("Yoga"));
    }

    @Test
    void createDisciplineWithBlankNameReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/disciplines").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest());
        verify(disciplines, never()).create(any());
    }

    @Test
    void createRoomReturns201() throws Exception {
        when(rooms.create(any())).thenReturn(new RoomDto(1L, "Studio", "L1", 10, "available"));

        mockMvc.perform(post("/api/v1/rooms").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Studio\",\"location\":\"L1\",\"capacity\":10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.capacity").value(10));
    }

    @Test
    void createRoomWithZeroCapacityReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/rooms").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Studio\",\"capacity\":0}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void patchPackageStatusRejectsUnknownValue() throws Exception {
        mockMvc.perform(patch("/api/v1/packages/1/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"banned\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void patchPackageStatusDelegatesToService() throws Exception {
        when(packages.updateStatus(eq(1L), eq("inactive")))
                .thenReturn(new PackageDto(1L, "Basic", null, BigDecimal.TEN, 30, null, "inactive"));

        mockMvc.perform(patch("/api/v1/packages/1/status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"inactive\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("inactive"));
    }
    @Test
    @org.junit.jupiter.api.DisplayName("PUT /api/v1/packages/{id} returns 403 when not allowed")
    void receptionistCannotEditPackage() throws Exception {
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("Access is denied")).when(packages).update(eq(1L), any());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/packages/1").contentType(org.springframework.http.MediaType.APPLICATION_JSON).content("{\"name\":\"Test\",\"price\":100,\"durationDays\":30,\"status\":\"active\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
