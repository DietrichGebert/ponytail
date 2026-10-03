# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$Flag = Join-Path $ClaudeDir ".ponytail-active"

# Claude Code pipes a JSON payload with session_id on stdin; prefer this
# session's own mode file so two sessions in the same repo don't show each
# other's level (#992). The read is time-boxed (same 1s budget as the hooks'
# own stdin fallback, #443/#790) so running this by hand with no piped input
# can't hang the statusline. A missing/unparsable payload, or no matching
# session file, just falls back to the shared flag, as before.
try {
    $Reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
    $ReadTask = $Reader.ReadToEndAsync()
    if ($ReadTask.Wait(1000)) {
        $Payload = $ReadTask.Result | ConvertFrom-Json -ErrorAction Stop
        if ($Payload.session_id) {
            $SafeId = ($Payload.session_id -replace '[^A-Za-z0-9._-]', '_')
            $SessionFlag = Join-Path (Join-Path $ClaudeDir "ponytail-sessions") $SafeId
            if (Test-Path $SessionFlag) {
                $Flag = $SessionFlag
            }
        }
    }
} catch {
    # No stdin, or an unparsable payload — fall back to the shared flag.
}

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
# ultra is the high-intensity mode; flag it amber so it stands out from the
# default green. The level is still in the text, so color is a redundant cue.
$Color = if ($Mode -eq "ultra") { "173" } else { "108" }
if ([string]::IsNullOrEmpty($Mode) -or $Mode -eq "full") {
    [Console]::Write("${Esc}[38;5;${Color}m[PONYTAIL]${Esc}[0m")
} else {
    $Suffix = $Mode.ToUpperInvariant()
    [Console]::Write("${Esc}[38;5;${Color}m[PONYTAIL:$Suffix]${Esc}[0m")
}
