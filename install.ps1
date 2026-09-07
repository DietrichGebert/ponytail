# ponytail -- installer shim for Windows.
#
# Thin wrapper around scripts/install.js, the real installer. It is the
# PowerShell twin of install.sh: both only locate Node and hand off, so there is
# no install logic here to drift out of sync with the bash one.
#
# One-line install:
#   irm https://raw.githubusercontent.com/DietrichGebert/ponytail/main/install.ps1 | iex
#
# With flags, `iex` cannot forward arguments, so run it as a script block:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/DietrichGebert/ponytail/main/install.ps1))) --dry-run
#
# Local clone (Windows PowerShell blocks scripts by default):
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 [flags]
#
# Pin a release with $env:PONYTAIL_REF = '<tag>'.

# Everything lives in a function so the piped form can set a code instead of
# calling exit: under `irm | iex` an exit terminates the caller's whole
# PowerShell session, closing an interactive window before the summary is read.
#
# The code travels in $script:PonytailExit, never through `return`: a returned
# value shares the function's output stream with node's stdout, so assigning the
# call to a variable would swallow every line the installer printed.
function Invoke-PonytailInstall {
  param([string[]] $InstallerArgs)

  $script:PonytailExit = 1

  # Set inside the function, not at top level: under `irm | iex` a top-level
  # assignment overwrites these in the caller's own session and stays there.
  $ErrorActionPreference = 'Stop'
  # Windows PowerShell 5.1 renders a per-chunk progress bar that slows a
  # download by an order of magnitude and can leave a stuck bar behind.
  $ProgressPreference = 'SilentlyContinue'

  $repo = 'DietrichGebert/ponytail'
  $ref = if ($env:PONYTAIL_REF) { $env:PONYTAIL_REF } else { 'main' }

  # ref lands in a URL path, where .NET's Uri normalization collapses dot
  # segments -- a ref inherited from the environment could redirect the download.
  if ($ref -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or $ref -like '*..*') {
    Write-Host "ponytail: refusing PONYTAIL_REF='$ref' -- expected a branch or tag name."
    return
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'ponytail: Node.js (>=18) required. Install from https://nodejs.org or `winget install OpenJS.NodeJS`.'
    return
  }

  # Double quotes outside, single quotes inside -- the same nesting install.sh
  # uses. Windows PowerShell 5.1 does not escape embedded double quotes in a
  # native argument without spaces, so inverting this makes node print nothing
  # and a modern Node read as version 0. Do not "fix" it to match the other
  # order; that is the bug this line exists to avoid.
  $nodeMajor = 0
  [void][int]::TryParse((node -p "process.versions.node.split('.')[0]"), [ref] $nodeMajor)
  if ($nodeMajor -lt 18) {
    Write-Host "ponytail: need Node >=18 (got '$nodeMajor'). Upgrade: https://nodejs.org"
    return
  }

  # Inside a clone: run the local installer -- no download, works offline.
  # $PSScriptRoot is empty under `irm | iex`, the same way BASH_SOURCE is unset
  # under `curl | bash`, so only trust it when it is set. AGENTS.md has to be
  # there too, so a stray scripts/install.js elsewhere is not mistaken for a
  # ponytail checkout. -LiteralPath because [ ] in a path are wildcards.
  if ($PSScriptRoot) {
    $entry = Join-Path $PSScriptRoot 'scripts/install.js'
    if ((Test-Path -LiteralPath $entry) -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'AGENTS.md'))) {
      & node $entry @InstallerArgs
      $script:PonytailExit = $LASTEXITCODE
      return
    }
  }

  # Unpack the repo into a temp dir and run the installer from there. The
  # installer reads .agents/rules/ponytail.md and .kiro/steering/ponytail.md at
  # runtime, and a source archive has the whole repo.
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("ponytail-" + [Guid]::NewGuid().ToString('N'))
  try {
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    $zip = Join-Path $tmp 'ponytail.zip'
    # TLS 1.2 for Windows PowerShell 5.1, whose older builds still default to
    # TLS 1.0 and get refused by GitHub. Harmless on PowerShell 7. This one is
    # process-wide static state, not a preference variable, so it is restored
    # below -- under `irm | iex` it would otherwise outlive the install and
    # change the caller's session.
    $priorTls = [Net.ServicePointManager]::SecurityProtocol
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
      Invoke-WebRequest -Uri "https://codeload.github.com/$repo/zip/$ref" -OutFile $zip -UseBasicParsing
    } catch {
      # A wrong ref is the common case here, and a raw error record buries that.
      Write-Host "ponytail: could not download $repo at '$ref' -- check the ref name. ($($_.Exception.Message))"
      return
    }
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
    $extracted = Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1
    if (-not $extracted) {
      Write-Host "ponytail: the archive for '$ref' unpacked empty."
      return
    }
    $entry = Join-Path $extracted.FullName 'scripts/install.js'
    # A ref older than the installer downloads fine and then has no entry point;
    # without this the user gets Node's MODULE_NOT_FOUND stack instead.
    if (-not (Test-Path -LiteralPath $entry)) {
      Write-Host "ponytail: '$ref' has no scripts/install.js -- that ref predates the installer. Use a newer one."
      return
    }
    & node $entry @InstallerArgs
    $script:PonytailExit = $LASTEXITCODE
    return
  } finally {
    if ($null -ne $priorTls) { [Net.ServicePointManager]::SecurityProtocol = $priorTls }
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Not assigned to a variable: the installer's own stdout flows through here to
# the console, which is the point.
Invoke-PonytailInstall -InstallerArgs $args
# Only a real script invocation may exit. Under `irm | iex` an exit terminates
# whatever is running the pipe -- an interactive session, or a calling script,
# both measured on Windows PowerShell 5.1 and 7.6.5.
#
# $PSCommandPath is the right test because it is empty under `iex` even when
# the `iex` sits inside another .ps1 (measured; $MyInvocation.MyCommand.Path is
# NOT, it reports the calling script there). Running as a file is also the case
# that needs the exit at all: -File does not propagate $LASTEXITCODE on its own,
# so without this the flag-error exit code would be lost.
if ($PSCommandPath) { exit $script:PonytailExit } else { $global:LASTEXITCODE = $script:PonytailExit }
