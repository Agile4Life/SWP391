package com.swp391.scms.common.api;

import java.time.Instant;
import java.util.Map;

/** Bản ghi mô tả một lỗi API (thời điểm, mã HTTP, mã lỗi, thông báo và lỗi từng trường). */
public record ApiError(Instant timestamp, int status, String code, String message, Map<String, String> details) { }
