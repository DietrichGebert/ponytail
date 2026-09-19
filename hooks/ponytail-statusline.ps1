# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$Flag = Join-Path $ClaudeDir ".ponytail-active"

# Claude Code pipes this session's JSON on stdin. The session's own mode wins
# over the legacy flag, which another session may have written (#662). Same id
# rule as sessionIdFrom in ponytail-runtime.js.
if ([Console]::IsInputRedirected) {
    try {
        $Sid = [string](([Console]::In.ReadToEnd() | ConvertFrom-Json).session_id) -replace '[^A-Za-z0-9_-]', ''
        if ($Sid.Length -gt 128) { $Sid = $Sid.Substring(0, 128) }
        if ($Sid) {
            $SessionFlag = Join-Path (Join-Path $ClaudeDir ".ponytail-sessions") $Sid
            if (Test-Path -LiteralPath $SessionFlag) { $Flag = $SessionFlag }
        }
    } catch {}
}
if (-not (Test-Path -LiteralPath $Flag)) {
    exit 0
}

$Mode = ""
try {
    $Mode = (Get-Content -LiteralPath $Flag -ErrorAction Stop | Select-Object -First 1).Trim()
} catch {
    exit 0
}
if ($Mode -eq "off") {
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
