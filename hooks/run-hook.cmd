: <<'CMDBLOCK'
@echo off
where node >nul 2>nul
if errorlevel 1 exit /b 0
node "%~dp0%~1"
exit /b %ERRORLEVEL%
CMDBLOCK

command -v node >/dev/null 2>&1 || exit 0
exec node "${0%/*}/$1"
