# Mục đích: đọc và kiểm tra cấu hình kết nối Supabase PostgreSQL từ biến môi trường cho các script chạy trên Windows.
# Supabase PostgreSQL là cơ sở dữ liệu duy nhất được bộ chạy Windows hỗ trợ.
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
