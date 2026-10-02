# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$Flag = Join-Path $ClaudeDir ".ponytail-active"
if (-not (Test-Path $Flag -PathType Container)) {
    exit 0
}

$Mode = ""
try {
    $Payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $SessionId = [string]$Payload.session_id
    if ([string]::IsNullOrWhiteSpace($SessionId) -or $SessionId.Length -gt 512) { exit 0 }
    $Sha256 = [System.Security.Cryptography.SHA256]::Create()
    try { $Hash = $Sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($SessionId.Trim())) }
    finally { $Sha256.Dispose() }
    $Key = ([BitConverter]::ToString($Hash)).Replace("-", "").ToLowerInvariant()
    $Mode = (Get-Content (Join-Path $Flag $Key) -ErrorAction Stop | Select-Object -First 1).Trim()
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
