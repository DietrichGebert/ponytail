# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }

# Claude Code pipes the session as JSON on stdin; each session keeps its own level in
# .ponytail-active-<session_id> (see ponytail-statusline.sh).
$SessionId = ""
if ([Console]::IsInputRedirected) {
    try {
        $Payload = [Console]::In.ReadToEnd() | ConvertFrom-Json -ErrorAction Stop
        $SessionId = ([string]$Payload.session_id) -replace '[^A-Za-z0-9_-]', ''
        if ($SessionId.Length -gt 64) { $SessionId = $SessionId.Substring(0, 64) }
    } catch { $SessionId = "" }
}

$Flag = $null
$Keyed = Join-Path $ClaudeDir ".ponytail-active-$SessionId"
$Shared = Join-Path $ClaudeDir ".ponytail-active"
if ($SessionId -and (Test-Path $Keyed)) {
    $Flag = $Keyed
} elseif (Test-Path $Shared) {
    $Flag = $Shared
} elseif (-not $SessionId) {
    $Latest = Get-ChildItem -Path $ClaudeDir -Filter ".ponytail-active-*" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($Latest) { $Flag = $Latest.FullName }
}
if (-not $Flag) {
    exit 0
}

$Mode = ""
try {
    $Mode = (Get-Content $Flag -ErrorAction Stop | Select-Object -First 1).Trim()
} catch {
    exit 0
}

# Only a known level is ever printed (see ponytail-statusline.sh).
$Mode = $Mode.ToLowerInvariant()
if (@("", "lite", "full", "ultra", "review") -notcontains $Mode) {
    exit 0
}

$Esc = [char]27
# ultra is the high-intensity mode; flag it amber so it stands out from the
# default green. The level is still in the text, so color is a redundant cue.
$Color = if ($Mode -eq "ultra") { "173" } else { "108" }
if ([string]::IsNullOrEmpty($Mode) -or $Mode -eq "full") {
    [Console]::Write("${Esc}[38;5;${Color}m[PONYTAIL]${Esc}[0m")
} else {
    $Suffix = $Mode.ToUpperInvariant()
    [Console]::Write("${Esc}[38;5;${Color}m[PONYTAIL:$Suffix]${Esc}[0m")
}
