package com.swp391.scms.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.reports.dto.ClassUtilizationDto;
import com.swp391.scms.reports.dto.DailyRevenueDto;
import com.swp391.scms.reports.dto.PackageRevenueDto;
import com.swp391.scms.reports.dto.RecentTransactionDto;
import com.swp391.scms.reports.dto.ReportSnapshotCreateDto;
import com.swp391.scms.reports.dto.ReportSnapshotDto;
import com.swp391.scms.reports.service.RevenueReportService;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ReportControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private RevenueReportService reportService;

    @InjectMocks
    private ReportController reportController;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        mockMvc = MockMvcBuilders.standaloneSetup(reportController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/reports/revenue/daily should return 200 OK")
    void shouldGetDailyRevenue() throws Exception {
        DailyRevenueDto dto = new DailyRevenueDto(LocalDate.of(2026, 10, 1), new BigDecimal("1000000.00"), 5);
        when(reportService.getDailyRevenue(any(), any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/reports/revenue/daily?startDate=2026-10-01&endDate=2026-10-05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].transactionCount").value(5));
    }

    @Test
    @DisplayName("GET /api/v1/reports/revenue/by-package should return 200 OK")
    void shouldGetRevenueByPackage() throws Exception {
        PackageRevenueDto dto = new PackageRevenueDto(1L, "Gold", new BigDecimal("5000000.00"), 10, 50.0);
        when(reportService.getRevenueByPackage(any(), any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/reports/revenue/by-package"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].packageName").value("Gold"));
    }

    @Test
    @DisplayName("GET /api/v1/reports/class-utilization should return 200 OK")
    void shouldGetClassUtilization() throws Exception {
        ClassUtilizationDto dto = new ClassUtilizationDto(
                10L, "Morning Yoga", 2L, "Yoga", 20, 15L, 12L, 75.0, 80.0
        );
        when(reportService.getClassUtilization(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), 2L))
                .thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/reports/class-utilization?startDate=2026-10-01&endDate=2026-10-31&disciplineId=2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].className").value("Morning Yoga"))
                .andExpect(jsonPath("$.data[0].utilizationRate").value(75.0))
                .andExpect(jsonPath("$.data[0].attendanceRate").value(80.0));
    }

    @Test
    @DisplayName("POST /api/v1/reports/snapshots/generate should return 201 Created")
    void shouldGenerateSnapshot() throws Exception {
        ReportSnapshotCreateDto request = new ReportSnapshotCreateDto(
                "revenue",
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 5),
                "{\"revenue\": 1000}",
                1L
        );

        ReportSnapshotDto response = new ReportSnapshotDto();
        response.setId(10L);
        response.setReportType("revenue");

        when(reportService.generateSnapshot(any(ReportSnapshotCreateDto.class), any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/reports/snapshots/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(10L));
    }

    @Test
    @DisplayName("GET /api/v1/reports/snapshots should return 200 OK")
    void shouldGetSnapshotsList() throws Exception {
        ReportSnapshotDto dto = new ReportSnapshotDto();
        dto.setId(1L);
        when(reportService.getSnapshots()).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/reports/snapshots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(1L));
    }

    @Test
    void shouldExposeRecentTransactionsForSelectedPeriod() throws Exception {
        var start = LocalDate.of(2026, 10, 1);
        var end = LocalDate.of(2026, 10, 5);
        when(reportService.getRecentTransactions(start, end)).thenReturn(List.of(
                new RecentTransactionDto(78L, "SCMS-78", "Nguyễn An", "Gold",
                        new BigDecimal("750000"), "cash", end.atTime(18, 45, 12))));
        mockMvc.perform(get("/api/v1/reports/transactions/recent?startDate=2026-10-01&endDate=2026-10-05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(78))
                .andExpect(jsonPath("$.data[0].invoiceNumber").value("SCMS-78"))
                .andExpect(jsonPath("$.data[0].memberName").value("Nguyễn An"))
                .andExpect(jsonPath("$.data[0].amount").value(750000));
        verify(reportService).getRecentTransactions(start, end);
    }
}
