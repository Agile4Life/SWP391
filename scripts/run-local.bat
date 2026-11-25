@echo off
chcp 65001 >nul
REM Mục đích: lối tắt cho Windows để gọi run-local.ps1 (chạy API và web local).
title SCMS - Local Runner Launcher
echo =================================================================
echo         SPORTS CENTER MANAGEMENT SYSTEM (SCMS) - LOCAL RUNNER
echo =================================================================
echo Dang khoi chay bo kiem tra va khoi dong he thong...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-local.ps1" %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Co loi xay ra khi khoi chay he thong.
    pause
    exit /b %ERRORLEVEL%
)
