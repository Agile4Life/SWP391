package com.swp391.scms.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GoogleOAuthResponse(boolean requiresOtp, String email, AuthTokenResponse authentication,
                                  String message, Integer expiresInMinutes, String debugOtp) { }
