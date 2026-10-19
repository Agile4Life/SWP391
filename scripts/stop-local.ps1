# =====================================================================
# SCMS - Script dung cac tien trinh dang chay local (Port 8080 & 5173)
# =====================================================================
[CmdletBinding()]
param(
    [int[]]$Ports = @(8080, 5173)
)

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "    SCMS - DUNG TIEN TRINH LOCAL (API & WEB)              " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

$stoppedAny = $false

foreach ($port in $Ports) {
    Write-Host "-> Kiem tra port $port ..." -ForegroundColor Gray
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            try {
                $proc = Get-Process -Id $processId -ErrorAction Stop
                Write-Host "  -> Dang tat tien trinh '$($proc.ProcessName)' (PID: $processId) tren port $port ..." -ForegroundColor Yellow
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                Write-Host "  [OK] Da giai phong port $port!" -ForegroundColor Green
                $stoppedAny = $true
            } catch {
                Write-Host "  [!] Khong the tat PID $($processId): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  [INFO] Port $port dang trong." -ForegroundColor DarkGray
    }
}

if ($stoppedAny) {
    Write-Host "`n[HOAN TAT] Tat ca server local da duoc dung!" -ForegroundColor Green
} else {
    Write-Host "`n[INFO] Khong co server nao dang chay tren cac port nay." -ForegroundColor Cyan
}
