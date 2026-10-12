# =====================================================================
# SCMS - Script khoi tao co so du lieu SportsCenterDB (SQL Server)
# =====================================================================
[CmdletBinding()]
param(
    [string]$Server = "127.0.0.1,1433",
    [string]$User = "sa",
    [string]$Password = "12345",
    [switch]$UseWindowsAuth,
    [switch]$Force
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    SCMS - KHOI TAO CO SO DU LIEU SQL SERVER               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir
. (Join-Path $scriptDir "database-config.ps1")
# Respect process environment first; read only provider settings from .env.
$configuredProfiles = $env:SPRING_PROFILES_ACTIVE
$configuredUrl = $env:SPRING_DATASOURCE_URL
$configFile = Join-Path $rootDir '.env'
if (Test-Path $configFile) {
    foreach ($configLine in Get-Content $configFile) {
        if ($configLine -match '^\s*SPRING_PROFILES_ACTIVE\s*=(.*)$') { $configuredProfiles = $Matches[1].Trim() }
        if ($configLine -match '^\s*SPRING_DATASOURCE_URL\s*=(.*)$') { $configuredUrl = $Matches[1].Trim() }
    }
}
$databaseConfig = Resolve-ScmsDatabaseConfig -Profiles $configuredProfiles -JdbcUrl $configuredUrl
if ($databaseConfig.Provider -ne 'sqlserver') {
    if ($Force) { throw 'Force database reset is only supported by the legacy SQL Server initializer.' }
    Write-Host '[INFO] PostgreSQL: start the API to generate the schema through Hibernate. No T-SQL executed.' -ForegroundColor Cyan
    exit 0
}
$sqlFile = Join-Path $rootDir "db\databaseschema.sql"
if (-not (Test-Path $sqlFile)) {
    $sqlFile = Join-Path $scriptDir "databaseschema.sql"
}

if (-not (Test-Path $sqlFile)) {
    Write-Host "[LOI] Khong tim thay file databaseschema.sql tai $sqlFile" -ForegroundColor Red
    exit 1
}

# Doc cau hinh tu .env neu co
$envFile = Join-Path $rootDir ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            if ($k -eq "SPRING_DATASOURCE_PASSWORD" -and -not $PSBoundParameters.ContainsKey("Password")) {
                $Password = $v
            }
            if ($k -eq "SPRING_DATASOURCE_USERNAME" -and -not $PSBoundParameters.ContainsKey("User")) {
                $User = $v
            }
        }
    }
}

# Kiem tra cong cu sqlcmd
$sqlcmdPath = $null
$foundCmd = Get-Command sqlcmd.exe -ErrorAction SilentlyContinue
if ($foundCmd) {
    $sqlcmdPath = $foundCmd.Source
} else {
    $candidates = @(
        "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
        "C:\Program Files\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "C:\Program Files (x86)\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE",
        "C:\Program Files\Microsoft SQL Server\150\Tools\Binn\SQLCMD.EXE"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $sqlcmdPath = $c
            break
        }
    }
}

if (-not $sqlcmdPath) {
    Write-Host "[CANH BAO] Khong tim thay sqlcmd.exe trong he thong." -ForegroundColor Yellow
    Write-Host "Vui long mo file databaseschema.sql trong SSMS hoac Azure Data Studio va nhan Execute (F5)." -ForegroundColor Yellow
    exit 1
}

Write-Host "-> Kiem tra ket noi SQL Server tai: $Server ..." -ForegroundColor Yellow

$authArgs = @("-C")
if ($UseWindowsAuth) {
    $authArgs += @("-E")
} else {
    $authArgs += @("-U", $User, "-P", $Password)
}

# Kiem tra ket noi thu
$testConn = & $sqlcmdPath -S $Server @authArgs -Q "SELECT @@VERSION" -b 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[THU LAI] Khong the ket noi bang SA qua TCP 1433, thu Windows Authentication..." -ForegroundColor Yellow
    $authArgs = @("-E")
    $testConn = & $sqlcmdPath -S $Server @authArgs -Q "SELECT @@VERSION" -b 2>&1
    if ($LASTEXITCODE -ne 0) {
        $Server = "localhost\SQLEXPRESS"
        $testConn = & $sqlcmdPath -S $Server @authArgs -Q "SELECT @@VERSION" -b 2>&1
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] Khong the ket noi den SQL Server ($Server)." -ForegroundColor Red
    Write-Host "Chi tiet: $testConn" -ForegroundColor Red
    Write-Host "Goi y:" -ForegroundColor Yellow
    Write-Host "  1. Dam bao dich vu SQL Server (MSSQLSERVER hoac MSSQL`$SQLEXPRESS) dang chay."
    Write-Host "  2. Hoac chay 'docker compose up -d sqlserver' neu dung Docker."
    exit 1
}

Write-Host "[OK] Ket noi thanh cong toi SQL Server ($Server)!" -ForegroundColor Green

# Kiem tra xem Database SportsCenterDB da ton tai chua
$dbCheck = & $sqlcmdPath -S $Server @authArgs -Q "SET NOCOUNT ON; SELECT DB_ID(N'SportsCenterDB')" -h -1
$dbCheckStr = ($dbCheck | Out-String).Trim()
$dbExists = ($dbCheckStr -match "^[0-9]+$")

if ($dbExists -and -not $Force) {
    $tableRaw = & $sqlcmdPath -S $Server @authArgs -d SportsCenterDB -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables" -h -1
    $tableCount = ($tableRaw | Out-String).Trim()
    Write-Host "[THONG BAO] Database 'SportsCenterDB' da ton tai voi $tableCount bang." -ForegroundColor Cyan
    Write-Host "-> Neu muon khoi tao lai tu dau, hay chay: .\init-db.ps1 -Force" -ForegroundColor Gray
    exit 0
}

if ($Force) {
    Write-Host "-> Dang xoa database cu de tao moi (-Force)..." -ForegroundColor Yellow
    & $sqlcmdPath -S $Server @authArgs -Q "IF DB_ID(N'SportsCenterDB') IS NOT NULL BEGIN ALTER DATABASE SportsCenterDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE SportsCenterDB; END"
}

Write-Host "-> Dang chay file databaseschema.sql de khoi tao cac bang, trigger va seed data..." -ForegroundColor Yellow
$output = & $sqlcmdPath -S $Server @authArgs -i $sqlFile -b 2>&1

if ($LASTEXITCODE -eq 0) {
    $tableRaw = & $sqlcmdPath -S $Server @authArgs -d SportsCenterDB -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables" -h -1
    $tableCount = ($tableRaw | Out-String).Trim()
    Write-Host "[THANH CONG] Da khoi tao hoan tat SportsCenterDB voi $tableCount bang!" -ForegroundColor Green
} else {
    Write-Host "[LOI] Xay ra loi khi chay schema:" -ForegroundColor Red
    Write-Host ($output | Out-String) -ForegroundColor Red
    exit 1
}
