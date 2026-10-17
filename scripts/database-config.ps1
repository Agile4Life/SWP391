# Supabase PostgreSQL is the only database supported by the Windows runner.
function Resolve-ScmsDatabaseConfig {
    param([string]$Profiles, [string]$JdbcUrl)
    $selected = @($Profiles.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
    if ($selected.Count -eq 0) { $selected = @('supabase') }
    if (@($selected | Where-Object { $_ -ne 'supabase' }).Count -gt 0) {
        throw 'Unsupported database profile; use supabase only.'
    }
    if (-not [string]::IsNullOrWhiteSpace($JdbcUrl) -and $JdbcUrl -notmatch '^jdbc:postgresql:') {
        throw 'Unsupported JDBC URL; use PostgreSQL.'
    }
    [pscustomobject]@{ Provider = 'postgresql'; Profiles = 'supabase'; IsSupabase = $true }
}
