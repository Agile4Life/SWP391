# PostgreSQL configuration for the Windows runner; Supabase is the default.
function Resolve-ScmsDatabaseConfig {
    param([string]$Profiles, [string]$JdbcUrl)
    $selected = @($Profiles.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
    if ($selected.Count -eq 0) { $selected = @('supabase') }
    if (@($selected | Where-Object { $_ -notin @('supabase', 'postgresql', 'local') }).Count -gt 0) {
        throw 'Unsupported database profile; use supabase or postgresql,local.'
    }
    $isSupabase = $selected -contains 'supabase'
    if ($isSupabase -and ($selected -contains 'local')) {
        throw 'Do not combine supabase with local.'
    }
    if (-not [string]::IsNullOrWhiteSpace($JdbcUrl) -and $JdbcUrl -notmatch '^jdbc:postgresql:') {
        throw 'Unsupported JDBC URL; use PostgreSQL.'
    }
    if (-not $isSupabase -and $selected -notcontains 'postgresql') { $selected += 'postgresql' }
    if (-not $isSupabase -and $selected -notcontains 'local') { $selected += 'local' }
    [pscustomobject]@{ Provider = 'postgresql'; Profiles = ($selected -join ','); IsSupabase = $isSupabase }
}
