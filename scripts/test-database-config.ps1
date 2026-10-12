$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'database-config.ps1')

$cloud = Resolve-ScmsDatabaseConfig -Profiles 'supabase' -JdbcUrl 'jdbc:postgresql://example.invalid:5432/postgres'
if ($cloud.Provider -ne 'postgresql' -or $cloud.Profiles -ne 'supabase' -or -not $cloud.IsSupabase) {
    throw 'Supabase must select PostgreSQL without local profile.'
}
$pg = Resolve-ScmsDatabaseConfig -Profiles '' -JdbcUrl 'jdbc:postgresql://localhost:5432/scms'
if ($pg.Provider -ne 'postgresql' -or $pg.Profiles -ne 'postgresql,local') { throw 'PostgreSQL local profile resolution failed.' }
$sql = Resolve-ScmsDatabaseConfig -Profiles 'sqlserver' -JdbcUrl 'jdbc:sqlserver://localhost:1433'
if ($sql.Provider -ne 'sqlserver' -or $sql.Profiles -ne 'sqlserver,local') { throw 'SQL Server compatibility failed.' }
foreach ($invalid in @('supabase,local', 'supabase,sqlserver', 'postgresql,sqlserver')) {
    $rejected = $false
    try { Resolve-ScmsDatabaseConfig -Profiles $invalid -JdbcUrl '' | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw "Unsafe profile combination accepted: $invalid" }
}
$rejected = $false
try { Resolve-ScmsDatabaseConfig -Profiles 'sqlserver' -JdbcUrl 'jdbc:postgresql://localhost/test' | Out-Null } catch { $rejected = $true }
if (-not $rejected) { throw 'Conflicting JDBC URL accepted.' }
Write-Output 'Database runner config: 7 cases passed.'
