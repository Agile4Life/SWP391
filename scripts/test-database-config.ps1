$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'database-config.ps1')

foreach ($profiles in @('', 'supabase')) {
    $cloud = Resolve-ScmsDatabaseConfig -Profiles $profiles -JdbcUrl 'jdbc:postgresql://example.invalid:5432/postgres'
    if ($cloud.Provider -ne 'postgresql' -or $cloud.Profiles -ne 'supabase' -or -not $cloud.IsSupabase) {
        throw 'The default and Supabase profiles must use PostgreSQL without local settings.'
    }
}
foreach ($invalid in @('postgresql', 'local', 'sqlserver', 'h2', 'supabase,local', 'supabase,postgresql', 'legacy-db')) {
    $rejected = $false
    try { Resolve-ScmsDatabaseConfig -Profiles $invalid -JdbcUrl '' | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw "Unsupported profile combination accepted: $invalid" }
}
$rejected = $false
try { Resolve-ScmsDatabaseConfig -Profiles 'supabase' -JdbcUrl 'jdbc:mysql://localhost/test' | Out-Null } catch { $rejected = $true }
if (-not $rejected) { throw 'A non-PostgreSQL JDBC URL was accepted.' }
Write-Output 'Supabase runner config: 10 cases passed.'
