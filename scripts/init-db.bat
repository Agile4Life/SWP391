@echo off
chcp 65001 >nul
REM Mục đích: lối tắt cho Windows để gọi init-db.ps1 (khởi tạo/kiểm tra database).
title SCMS - Khoi tao Database
echo ==========================================================
echo          SCMS - CAU HINH SUPABASE POSTGRESQL
echo ==========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0init-db.ps1" %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Khong the khoi tao database tu dong.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo [XONG] Hoan tat khoi tao database!
pause
