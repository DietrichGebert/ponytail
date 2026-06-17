# Mirror ponytail-config.getClaudeDir(): honor CLAUDE_CONFIG_DIR, else ~/.claude.
$ConfigDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$Flag = Join-Path $ConfigDir ".ponytail-active"
if (-not (Test-Path $Flag)) {
    exit 0
}

$Mode = ""
try {
    $Mode = (Get-Content $Flag -ErrorAction Stop | Select-Object -First 1).Trim()
} catch {
    exit 0
}

$Esc = [char]27
if ([string]::IsNullOrEmpty($Mode) -or $Mode -eq "full") {
    [Console]::Write("${Esc}[38;5;108m[PONYTAIL]${Esc}[0m")
} else {
    $Suffix = $Mode.ToUpperInvariant()
    [Console]::Write("${Esc}[38;5;108m[PONYTAIL:$Suffix]${Esc}[0m")
}
