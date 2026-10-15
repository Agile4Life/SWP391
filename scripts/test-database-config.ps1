$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'database-config.ps1')

foreach ($profiles in @('', 'supabase')) {
    $cloud = Resolve-ScmsDatabaseConfig -Profiles $profiles -JdbcUrl 'jdbc:postgresql://example.invalid:5432/postgres'
    if ($cloud.Provider -ne 'postgresql' -or $cloud.Profiles -ne 'supabase' -or -not $cloud.IsSupabase) {
        throw 'The default and Supabase profiles must use PostgreSQL without local settings.'
    }
}
$pg = Resolve-ScmsDatabaseConfig -Profiles 'postgresql' -JdbcUrl 'jdbc:postgresql://localhost:5432/scms'
if ($pg.Provider -ne 'postgresql' -or $pg.Profiles -ne 'postgresql,local') { throw 'Explicit PostgreSQL development profile resolution failed.' }
foreach ($invalid in @('supabase,local', 'legacy-db', 'postgresql,legacy-db')) {
    $rejected = $false
    try { Resolve-ScmsDatabaseConfig -Profiles $invalid -JdbcUrl '' | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw "Unsupported profile combination accepted: $invalid" }
}
$rejected = $false
try { Resolve-ScmsDatabaseConfig -Profiles 'supabase' -JdbcUrl 'jdbc:mysql://localhost/test' | Out-Null } catch { $rejected = $true }
if (-not $rejected) { throw 'A non-PostgreSQL JDBC URL was accepted.' }
Write-Output 'Database runner config: 7 cases passed.'
