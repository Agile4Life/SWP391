# Validate configuration; Hibernate manages the Supabase/PostgreSQL schema on API startup.
[CmdletBinding()]
param([switch]$Force)
$ErrorActionPreference = 'Stop'
if ($Force) { throw 'Automatic database reset is disabled. Hibernate manages the schema when the API starts.' }
. (Join-Path $PSScriptRoot 'database-config.ps1')
$settings = @{}
foreach ($name in @('SPRING_PROFILES_ACTIVE', 'SPRING_DATASOURCE_URL')) {
    $settings[$name] = [Environment]::GetEnvironmentVariable($name)
}
$envFile = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*(SPRING_PROFILES_ACTIVE|SPRING_DATASOURCE_URL)\s*=(.*)$') {
            if ([string]::IsNullOrWhiteSpace($settings[$Matches[1]])) { $settings[$Matches[1]] = $Matches[2].Trim() }
        }
    }
}
$config = Resolve-ScmsDatabaseConfig -Profiles $settings['SPRING_PROFILES_ACTIVE'] -JdbcUrl $settings['SPRING_DATASOURCE_URL']
Write-Host "[INFO] PostgreSQL profile: $($config.Profiles)"
Write-Host '[INFO] Start the API with npm run dev:api to create/update the schema and install mandatory triggers.'
