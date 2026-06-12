$FlagOpenCode = Join-Path $HOME ".config/opencode/.ponytail-active"
$FlagClaude = Join-Path $HOME ".claude/.ponytail-active"

if (Test-Path $FlagOpenCode) {
    $Flag = $FlagOpenCode
} elseif (Test-Path $FlagClaude) {
    $Flag = $FlagClaude
} else {
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
