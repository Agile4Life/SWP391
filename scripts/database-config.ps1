# Shared provider selection for the Windows runner and legacy SQL Server initializer.
function Resolve-ScmsDatabaseConfig {
    param([string]$Profiles, [string]$JdbcUrl)
    $selected = @($Profiles.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
    $isSupabase = $selected -contains 'supabase'
    $hasPostgres = $isSupabase -or ($selected -contains 'postgresql')
    $hasSqlServer = $selected -contains 'sqlserver'
    if (($hasPostgres -and $hasSqlServer) -or ($isSupabase -and ($selected -contains 'local'))) {
        throw 'Do not combine database profiles, or supabase with local.'
    }
    $urlProvider = if ($JdbcUrl -match '^jdbc:postgresql:') { 'postgresql' }
        elseif ($JdbcUrl -match '^jdbc:sqlserver:') { 'sqlserver' }
        elseif ([string]::IsNullOrWhiteSpace($JdbcUrl)) { '' }
        else { throw 'Unsupported JDBC URL; use PostgreSQL or SQL Server.' }
    $provider = if ($hasPostgres) { 'postgresql' } elseif ($hasSqlServer) { 'sqlserver' }
        elseif ($urlProvider) { $urlProvider } else { 'postgresql' }
    if ($urlProvider -and $urlProvider -ne $provider) { throw 'JDBC URL and database profile disagree.' }
    if (-not $hasPostgres -and -not $hasSqlServer) { $selected += $provider }
    if (-not $isSupabase -and $selected -notcontains 'local') { $selected += 'local' }
    [pscustomobject]@{ Provider = $provider; Profiles = ($selected -join ','); IsSupabase = $isSupabase }
}
